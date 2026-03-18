const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const os = require('os');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// API: GET /api/status
router.get('/status', verifyToken, (req, res) => {
    try {
        const status = {
            success: true,
            system: {
                platform: os.platform(),
                arch: os.arch(),
                uptime: os.uptime(),
                totalMemory: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                freeMemory: (os.freemem() / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                cpuCount: os.cpus().length,
                loadAverage: os.loadavg()
            },
            process: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version
            },
            timestamp: new Date().toISOString()
        };
        res.json(status);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API: GET /api/system/stats
router.get('/stats', verifyToken, async (req, res) => {
    try {
        const dbPath = path.join(__dirname, '../../data/billing.db');
        const db = new sqlite3.Database(dbPath);
        
        // 1. Total Revenue (Paid Invoices)
        const revenue = await new Promise((resolve) => {
            db.get("SELECT SUM(amount) as total FROM invoices WHERE status = 'paid'", (err, row) => {
                resolve(row ? (row.total || 0) : 0);
            });
        });
        
        // 2. Active Customers & Members count
        const activeCustomers = await new Promise((resolve) => {
            db.get("SELECT COUNT(*) as count FROM customers WHERE status = 'active'", (err, row) => {
                resolve(row ? (row.count || 0) : 0);
            });
        });
        
        const activeMembers = await new Promise((resolve) => {
            db.get("SELECT COUNT(*) as count FROM members WHERE status = 'active'", (err, row) => {
                resolve(row ? (row.count || 0) : 0);
            });
        });
        
        db.close();

        // 3. Complaint Tickets (Total open/in_progress from database)
        const complaintCount = await new Promise((resolve) => {
            const db2 = new sqlite3.Database(dbPath);
            db2.get("SELECT COUNT(*) as count FROM trouble_reports WHERE status IN ('open', 'in_progress')", (err, row) => {
                db2.close();
                resolve(row ? (row.count || 0) : 0);
            });
        });

        const stats = {
            success: true,
            data: {
                total_revenue: revenue,
                active_customers: activeCustomers + activeMembers,
                complaint_tickets: complaintCount,
                server_status: 'ONLINE',
                timestamp: new Date().toISOString()
            }
        };
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
