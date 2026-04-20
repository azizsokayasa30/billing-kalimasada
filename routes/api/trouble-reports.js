const express = require('express');
const router = express.Router();
const { 
  getAllTroubleReports, 
  getTroubleReportById, 
  updateTroubleReportStatus 
} = require('../../config/troubleReport');
const { verifyToken } = require('./auth');

// API: GET /api/trouble-reports
router.get('/', verifyToken, async (req, res) => {
    try {
        const reports = await getAllTroubleReports();
        res.json({ success: true, data: reports });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// API: GET /api/trouble-reports/:id
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const report = await getTroubleReportById(req.params.id);
        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }
        res.json({ success: true, data: report });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// API: PATCH /api/trouble-reports/:id
router.patch('/:id', verifyToken, async (req, res) => {
    try {
        const { status, notes, sendNotification } = req.body;
        const updatedReport = await updateTroubleReportStatus(req.params.id, status, notes, sendNotification);
        
        if (!updatedReport) {
            return res.status(500).json({ success: false, message: 'Failed to update report' });
        }
        
        res.json({ success: true, data: updatedReport });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
