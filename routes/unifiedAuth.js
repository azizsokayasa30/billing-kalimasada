const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { getSetting } = require('../config/settingsManager');
const billingManager = require('../config/billing');
const AgentManager = require('../config/agentManager');
const { isLicenseValid, isTrialExpired } = require('../config/licenseManager');

const dbPath = path.join(__dirname, '../data/billing.db');
const db = new sqlite3.Database(dbPath);
const agentManager = new AgentManager();

const JWT_SECRET = getSetting('jwt_secret', 'alijaya-billing-secret-2025');

function jsonAfterSessionSave(req, res, payload) {
    req.session.save((err) => {
        if (err) {
            console.error('Unified login session save failed:', err);
            return res.status(500).json({ success: false, message: 'Gagal menyimpan sesi. Silakan coba lagi.' });
        }
        res.json(payload);
    });
}

// GET: Unified Login Page
router.get('/', async (req, res) => {
    try {
        const logoFilename = getSetting('logo_filename', 'logo.png');
        const companyHeader = getSetting('company_header', 'Billing System');
        const appSettings = {
            logo_filename: logoFilename,
            company_header: companyHeader,
            company_name: getSetting('company_name', 'Billing System'),
            footer_info: getSetting('footer_info', '© 2025 CV Lintas Multimedia'),
            contact_phone: getSetting('contact_phone', ''),
        };

        res.render('login-unified', {
            appSettings,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Error rendering unified login:', error);
        res.status(500).send('Internal Server Error');
    }
});

// POST: Unified Login Process
router.post('/', async (req, res) => {
    const { role, username, password, phone, otp } = req.body;
    const settings = {
        customerPortalOtp: getSetting('customerPortalOtp', false),
        otp_length: getSetting('otp_length', '6'),
        otp_expiry_minutes: getSetting('otp_expiry_minutes', '5')
    };

    try {
        // 1. Admin Login
        if (role === 'admin') {
            const adminUsername = getSetting('admin_username', 'admin');
            const adminPassword = getSetting('admin_password', 'admin');

            if (username === adminUsername && password === adminPassword) {
                req.session.isAdmin = true;
                req.session.adminUser = username;
                return jsonAfterSessionSave(req, res, { success: true, redirect: '/admin/dashboard' });
            }
        }

        // 2. Collector Login
        if (role === 'collector') {
            const collector = await new Promise((resolve) => {
                db.get('SELECT * FROM collectors WHERE (phone = ? OR email = ?) AND status = "active"', [username || phone, username || phone], (err, row) => {
                    resolve(row);
                });
            });

            if (collector && collector.password && bcrypt.compareSync(password, collector.password)) {
                const token = jwt.sign(
                    { id: collector.id, name: collector.name, phone: collector.phone, role: 'collector' },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                req.session.collectorToken = token;
                // Collector dashboard might expect other session vars
                req.session.collectorId = collector.id;
                req.session.collectorName = collector.name;
                return jsonAfterSessionSave(req, res, { success: true, redirect: '/collector/dashboard' });
            }
        }

        // 3. Agent Login
        if (role === 'agent') {
            const result = await agentManager.authenticateAgent(username || phone, password);
            if (result.success) {
                req.session.agentId = result.agent.id;
                req.session.agentName = result.agent.name;
                req.session.agentUsername = result.agent.username;
                return jsonAfterSessionSave(req, res, { success: true, redirect: '/agent/dashboard' });
            }
        }

        // Technician Login
        if (role === 'technician') {
            const technician = await new Promise((resolve) => {
                db.get('SELECT * FROM technicians WHERE (phone = ? OR email = ?) AND is_active = 1', [username || phone, username || phone], (err, row) => resolve(row));
            });

            if (technician && technician.password && bcrypt.compareSync(password, technician.password)) {
                const { authManager } = require('./technicianAuth');
                const sess = await authManager.createTechnicianSession(technician, req);
                req.session.technicianSessionId = sess.sessionId;
                req.session.technicianId = technician.id;
                return jsonAfterSessionSave(req, res, { success: true, redirect: '/technician/dashboard' });
            }
        }

        // 4. Customer / Member Login via Password
        if (role === 'customer' && password && !otp) {
            const targetPhone = normalizePhone(username || phone);
            const variants = [targetPhone, '+' + targetPhone, '0' + targetPhone.slice(2)];
            const placeholders = variants.map(() => '?').join(',');

            // Cek di tabel customers
            const customer = await new Promise(resolve => {
                db.get(`SELECT * FROM customers WHERE (username = ? OR phone IN (${placeholders}) OR customer_id = ?) AND status = 'active'`,
                    [username || phone, ...variants, username || phone], (err, row) => resolve(row));
            });

            if (customer && customer.password && bcrypt.compareSync(password, customer.password)) {
                req.session.phone = customer.phone;
                req.session.customer_username = customer.username;
                req.session.customer_id = customer.customer_id || customer.id;
                req.session.is_member = false;
                return jsonAfterSessionSave(req, res, { success: true, redirect: '/customer/dashboard' });
            }

            // Cek di tabel members
            const member = await new Promise(resolve => {
                db.get(`SELECT * FROM members WHERE (username = ? OR phone IN (${placeholders}) OR hotspot_username = ?) AND status = 'active'`,
                    [username || phone, ...variants, username || phone], (err, row) => resolve(row));
            });

            if (member && member.password && bcrypt.compareSync(password, member.password)) {
                req.session.phone = member.phone;
                req.session.member_id = member.id;
                req.session.member_phone = member.phone;
                req.session.member_username = member.hotspot_username || member.username;
                req.session.customer_username = member.hotspot_username || member.username;
                req.session.is_member = true;
                return jsonAfterSessionSave(req, res, { success: true, redirect: '/customer/billing/dashboard' });
            }
        }

        // OTP Based Roles (Technician, Customer)
        if (otp && (phone || username)) {
            const targetPhone = normalizePhone(phone || username);
            

            // 6. Customer / Member Login via OTP
            if (role === 'customer') {
                const apiAuth = require('./api/auth');
                const isValid = apiAuth.verifyOTP(targetPhone, otp);
                
                if (isValid) {
                    const user = await apiAuth.findUserByPhone(targetPhone);
                    
                    if (user && (user.role === 'customer' || user.role === 'member')) {
                        req.session.phone = targetPhone;
                        if (user.role === 'customer') {
                            const customer = await new Promise(resolve => {
                                db.get('SELECT * FROM customers WHERE id = ?', [user.id], (err, row) => resolve(row));
                            });
                            req.session.customer_username = customer.username;
                            req.session.customer_id = customer.customer_id || customer.id;
                            req.session.is_member = false;
                        } else {
                            const member = await new Promise(resolve => {
                                db.get('SELECT * FROM members WHERE id = ?', [user.id], (err, row) => resolve(row));
                            });
                            req.session.member_id = member.id;
                            req.session.member_phone = member.phone;
                            req.session.member_username = member.hotspot_username || member.username;
                            req.session.customer_username = member.hotspot_username || member.username;
                            req.session.is_member = true;
                        }
                        return jsonAfterSessionSave(req, res, { success: true, redirect: user.role === 'customer' ? '/customer/dashboard' : '/customer/billing/dashboard' });
                    }
                }
            }
        }

        return res.status(401).json({ success: false, message: 'Kredensial tidak valid' });

    } catch (error) {
        console.error('Unified login error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem' });
    }
});

function normalizePhone(phone) {
    if (!phone) return '';
    let p = String(phone).trim();
    p = p.replace(/\D/g, '');
    if (p.startsWith('0')) p = '62' + p.slice(1);
    if (!p.startsWith('62')) p = '62' + p;
    return p;
}

module.exports = router;
