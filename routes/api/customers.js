const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { verifyToken } = require('./auth');

// Database helper
const getDB = () => new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));

const { getCustomerDeviceData } = require('../../config/deviceManager');

// API: GET /api/customers
router.get('/', verifyToken, (req, res) => {
    const db = getDB();
    const query = 'SELECT * FROM members ORDER BY name';
    
    db.all(query, [], (err, rows) => {
        db.close();
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, data: rows });
    });
});

// API: GET /api/customers/:id
router.get('/:id', verifyToken, (req, res) => {
    const db = getDB();
    const query = 'SELECT * FROM members WHERE id = ?';
    
    db.get(query, [req.params.id], (err, row) => {
        db.close();
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        if (!row) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        res.json({ success: true, data: row });
    });
});

// API: GET /api/customers/invoices/:customerId
router.get('/invoices/:customerId', verifyToken, (req, res) => {
    const db = getDB();
    const role = req.user.role;
    const targetId = req.params.customerId;
    
    // Determine which column to filter by based on user role
    const idColumn = (role === 'member') ? 'member_id' : 'customer_id';
    const query = `SELECT * FROM invoices WHERE ${idColumn} = ? ORDER BY due_date DESC`;
    
    db.all(query, [targetId], (err, rows) => {
        db.close();
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, data: rows });
    });
});

// API: GET /api/customers/packages/active
router.get('/packages/active', verifyToken, (req, res) => {
    const db = getDB();
    const userId = req.user.id;
    const role = req.user.role;

    if (role === 'customer') {
        const query = `
            SELECT p.* 
            FROM customers c 
            JOIN packages p ON c.package_id = p.id 
            WHERE c.id = ?
        `;
        db.get(query, [userId], (err, row) => {
            db.close();
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, data: row });
        });
    } else if (role === 'member') {
        const query = `
            SELECT p.* 
            FROM members m 
            JOIN member_packages p ON m.package_id = p.id 
            WHERE m.id = ?
        `;
        db.get(query, [userId], (err, row) => {
            db.close();
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, data: row });
        });
    } else {
        db.close();
        res.status(403).json({ success: false, message: 'Invalid role for this endpoint' });
    }
});

// API: GET /api/customers/device-info
router.get('/device-info', verifyToken, async (req, res) => {
    try {
        const phone = req.user.phone || req.user.username; // Use phone from token, fallback to username
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number NOT found in session' });
        }
        
        const deviceData = await getCustomerDeviceData(phone);
        res.json({ success: true, data: deviceData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
