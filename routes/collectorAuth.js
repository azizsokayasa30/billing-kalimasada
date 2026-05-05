/**
 * Collector Authentication Routes
 * Routes untuk login dan logout tukang tagih
 */

const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { getSetting } = require('../config/settingsManager');

// Middleware untuk mengecek session tukang tagih
const collectorAuth = (req, res, next) => {
    const token = req.session.collectorToken;
    
    if (!token) {
        return res.redirect('/login');
    }
    
    try {
        const secret = getSetting('jwt_secret', 'alijaya-billing-secret-2025');
        const decoded = jwt.verify(token, secret);
        req.collector = decoded;
        next();
    } catch (error) {
        console.error('Collector auth verification failed:', error);
        req.session.collectorToken = null;
        return res.redirect('/login');
    }
};

// Login page
router.get('/login', async (req, res) => {
    res.redirect('/login');
});

// Login process
router.post('/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        
        if (!phone || !password) {
            return res.json({
                success: false,
                message: 'Nomor telepon dan password harus diisi'
            });
        }
        
        const dbPath = path.join(__dirname, '../data/billing.db');
        const db = new sqlite3.Database(dbPath);
        
        // Find collector by phone
        const collector = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM collectors WHERE phone = ? AND status = "active"', [phone], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!collector) {
            db.close();
            return res.json({
                success: false,
                message: 'Nomor telepon tidak ditemukan atau akun tidak aktif'
            });
        }
        
        // Check password using bcrypt
        const validPassword = collector.password ? bcrypt.compareSync(password, collector.password) : false;
        
        if (!validPassword) {
            db.close();
            return res.json({
                success: false,
                message: 'Password salah'
            });
        }
        
        // Create JWT token
        const secret = getSetting('jwt_secret', 'alijaya-billing-secret-2025');
        const token = jwt.sign(
            { 
                id: collector.id, 
                name: collector.name, 
                phone: collector.phone,
                role: 'collector'
            },
            secret,
            { expiresIn: '24h' }
        );
        
        // Store token in session
        req.session.collectorToken = token;
        
        db.close();
        
        res.json({
            success: true,
            message: 'Login berhasil',
            collector: {
                id: collector.id,
                name: collector.name,
                phone: collector.phone
            }
        });
        
    } catch (error) {
        console.error('Error in collector login:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server'
        });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.collectorToken = null;
    res.json({
        success: true,
        message: 'Logout berhasil'
    });
});

// Logout redirect
router.get('/logout', (req, res) => {
    req.session.collectorToken = null;
    res.redirect('/login');
});

// Helper function to get app settings
async function getAppSettings() {
    try {
        return {
            companyHeader: getSetting('company_header', 'Sistem Billing'),
            companyName: getSetting('company_name', 'Sistem Billing'),
            footerInfo: getSetting('footer_info', ''),
            logoFilename: getSetting('logo_filename', 'logo.png'),
            company_slogan: getSetting('company_slogan', ''),
            company_website: getSetting('company_website', ''),
            invoice_notes: getSetting('invoice_notes', ''),
            contact_phone: getSetting('contact_phone', ''),
            contact_email: getSetting('contact_email', ''),
            contact_address: getSetting('contact_address', ''),
            contact_whatsapp: getSetting('contact_whatsapp', '')
        };
    } catch (error) {
        console.error('Error getting app settings:', error);
        return {
            companyHeader: 'Sistem Billing',
            companyName: 'Sistem Billing'
        };
    }
}

module.exports = { router, collectorAuth };
