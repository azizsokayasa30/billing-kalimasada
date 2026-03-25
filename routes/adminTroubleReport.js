const express = require('express');
const router = express.Router();
const { adminAuth } = require('./adminAuth');
const { 
  getAllTroubleReports, 
  getTroubleReportById, 
  updateTroubleReportStatus 
} = require('../config/troubleReport');

// Middleware admin auth untuk semua route
router.use(adminAuth);

// GET: Halaman daftar semua laporan gangguan
router.get('/', async (req, res) => {
  try {
    // Dapatkan semua laporan gangguan
    const reports = await getAllTroubleReports();
    
    // Hitung jumlah laporan berdasarkan status
    const stats = {
      total: reports.length,
      open: reports.filter(r => r.status === 'open').length,
      inProgress: reports.filter(r => r.status === 'in_progress').length,
      resolved: reports.filter(r => r.status === 'resolved').length,
      closed: reports.filter(r => r.status === 'closed').length
    };
    
    // Render halaman admin laporan gangguan
    res.render('admin/trouble-reports', {
      reports,
      stats,
      title: 'Manajemen Laporan Gangguan'
    });
  } catch (error) {
    console.error('Error loading trouble reports:', error);
    res.status(500).send('Internal Server Error: ' + error.message);
  }
});

// GET: Halaman detail laporan gangguan
router.get('/detail/:id', async (req, res) => {
  try {
    const reportId = req.params.id;
    
    // Dapatkan detail laporan
    const report = await getTroubleReportById(reportId);
    
    // Validasi laporan ditemukan
    if (!report) {
      req.flash('error', 'Laporan gangguan tidak ditemukan');
      return res.redirect('/admin/trouble');
    }
    
    // Render halaman detail laporan
    res.render('admin/trouble-report-detail', {
      report,
      title: `Detail Laporan #${reportId}`
    });
  } catch (error) {
    console.error('Error loading trouble report detail:', error);
    res.status(500).send('Internal Server Error: ' + error.message);
  }
});

// POST: Update status laporan gangguan
router.post('/update-status/:id', async (req, res) => {
  const reportId = req.params.id;
  const { status, notes, sendNotification } = req.body;
  
  // Validasi status
  const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status tidak valid'
    });
  }
  
  // Update status laporan dengan parameter sendNotification
  const updatedReport = await updateTroubleReportStatus(reportId, status, notes, {}, sendNotification);
  
  if (!updatedReport) {
    return res.status(500).json({
      success: false,
      message: 'Gagal mengupdate status laporan'
    });
  }
  
  res.json({
    success: true,
    message: 'Status laporan berhasil diupdate',
    report: updatedReport
  });
});

// POST: Tambah catatan pada laporan tanpa mengubah status
router.post('/add-note/:id', async (req, res) => {
  const reportId = req.params.id;
  const { notes } = req.body;
  
  // Dapatkan detail laporan untuk mendapatkan status saat ini
  const report = await getTroubleReportById(reportId);
  
  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Laporan tidak ditemukan'
    });
  }
  
  // Update laporan dengan catatan baru tanpa mengubah status
  const updatedReport = await updateTroubleReportStatus(reportId, report.status, notes);
  
  if (!updatedReport) {
    return res.status(500).json({
      success: false,
      message: 'Gagal menambahkan catatan'
    });
  }
  
  res.json({
    success: true,
    message: 'Catatan berhasil ditambahkan',
    report: updatedReport
  });
});

module.exports = router;
