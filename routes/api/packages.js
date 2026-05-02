const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { verifyToken } = require('./auth');

// Database helper
const getDB = () => new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));

// API: GET /api/packages
router.get('/', verifyToken, (req, res) => {
    const db = getDB();
    const query = 'SELECT * FROM packages ORDER BY name';
    
    db.all(query, [], (err, rows) => {
        db.close();
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, data: rows });
    });
});

module.exports = router;
