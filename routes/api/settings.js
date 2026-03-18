const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { getSettingsWithCache } = require('../../config/settingsManager');
const fs = require('fs').promises;
const path = require('path');

const settingsPath = path.join(process.cwd(), 'settings.json');

// API: GET /api/settings
router.get('/', verifyToken, (req, res) => {
    try {
        const settings = getSettingsWithCache();
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API: PUT /api/settings
router.put('/', verifyToken, async (req, res) => {
    try {
        const newSettings = req.body;
        if (!newSettings || typeof newSettings !== 'object') {
            return res.status(400).json({ success: false, message: 'Invalid settings data' });
        }

        const oldSettings = getSettingsWithCache();
        const mergedSettings = { ...oldSettings, ...newSettings };

        await fs.writeFile(settingsPath, JSON.stringify(mergedSettings, null, 2), 'utf8');
        
        // Clear cache if needed (settingsManager might need a reload function)
        // For now, assuming standard fs write is enough if settingsManager reads on demand or resets
        
        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
