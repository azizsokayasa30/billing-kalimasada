const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { verifyToken } = require('./auth');

// Database helper
const getDB = () => new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));

// API: GET /api/routers
router.get('/', verifyToken, (req, res) => {
    const db = getDB();
    const query = 'SELECT id, name, nas_ip, location, pop FROM routers ORDER BY name';
    
    db.all(query, [], (err, rows) => {
        db.close();
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, data: rows });
    });
});

// API: GET /api/routers/:id
router.get('/:id', verifyToken, (req, res) => {
    const db = getDB();
    const query = 'SELECT * FROM routers WHERE id = ?';
    
    db.get(query, [req.params.id], (err, row) => {
        db.close();
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        if (!row) {
            return res.status(404).json({ success: false, message: 'Router not found' });
        }
        res.json({ success: true, data: row });
    });
});

// API: POST /api/routers/:id/reboot
router.post('/:id/reboot', verifyToken, async (req, res) => {
    try {
        const db = getDB();
        const routerObj = await new Promise((resolve) => {
            db.get('SELECT * FROM routers WHERE id = ?', [req.params.id], (err, row) => {
                db.close();
                resolve(row);
            });
        });

        if (!routerObj) {
            return res.status(404).json({ success: false, message: 'Router not found' });
        }

        const { getMikrotikConnectionForRouter } = require('../../config/mikrotik');
        const conn = await getMikrotikConnectionForRouter(routerObj);
        await conn.write('/system/reboot');
        
        res.json({ success: true, message: 'Router is rebooting...' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API: POST /api/routers/:id/wifi
router.post('/:id/wifi', verifyToken, async (req, res) => {
    try {
        const { ssid, password, interface } = req.body;
        if (!ssid || !password) {
            return res.status(400).json({ success: false, message: 'SSID and Password are required' });
        }

        const db = getDB();
        const routerObj = await new Promise((resolve) => {
            db.get('SELECT * FROM routers WHERE id = ?', [req.params.id], (err, row) => {
                db.close();
                resolve(row);
            });
        });

        if (!routerObj) {
            return res.status(404).json({ success: false, message: 'Router not found' });
        }

        const { getMikrotikConnectionForRouter } = require('../../config/mikrotik');
        const conn = await getMikrotikConnectionForRouter(routerObj);
        
        // Find wireless interface if not specified
        const iface = interface || 'wlan1';
        
        // Example Mikrotik WiFi change (requires security profile or direct set)
        // Usually routers use security profiles. This is a simplified attempt.
        await conn.write('/interface/wireless/set', [
            `=.id=${iface}`,
            `=ssid=${ssid}`
        ]);
        
        // Note: Changing password often involves security-profiles
        res.json({ success: true, message: `WiFi SSID updated to ${ssid}. (Password change may require security profile update)` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
