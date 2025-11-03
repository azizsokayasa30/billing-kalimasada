const express = require('express');
const router = express.Router();
const { adminAuth } = require('./adminAuth');
const { getRadiusConfig, saveRadiusConfig } = require('../config/radiusConfig');
const logger = require('../config/logger');

// GET: Halaman Setting RADIUS
router.get('/radius', adminAuth, async (req, res) => {
  try {
    // Ambil dari database, bukan settings.json
    const settings = await getRadiusConfig();
    res.render('adminRadius', {
      settings,
      page: 'setting-radius',
      error: null,
      success: null
    });
  } catch (e) {
    logger.error('Error loading radius config:', e);
    res.render('adminRadius', {
      settings: {
        user_auth_mode: 'mikrotik',
        radius_host: 'localhost',
        radius_user: 'radius',
        radius_password: '',
        radius_database: 'radius'
      },
      page: 'setting-radius',
      error: 'Gagal memuat pengaturan RADIUS',
      success: null
    });
  }
});

// POST: Simpan Setting RADIUS
router.post('/radius', adminAuth, async (req, res) => {
  try {
    const { user_auth_mode, radius_host, radius_user, radius_password, radius_database } = req.body;

    // Simpan ke database (app_settings table)
    await saveRadiusConfig({
      user_auth_mode: user_auth_mode || 'radius',
      radius_host: radius_host ? radius_host.trim() : 'localhost',
      radius_user: radius_user ? radius_user.trim() : 'radius',
      radius_password: radius_password || '',
      radius_database: radius_database ? radius_database.trim() : 'radius'
    });

    // Reload untuk ditampilkan
    const settings = await getRadiusConfig();
    
    res.render('adminRadius', {
      settings,
      page: 'setting-radius',
      error: null,
      success: 'Pengaturan RADIUS berhasil disimpan ke database'
    });
  } catch (e) {
    logger.error('Error saving radius config:', e);
    const settings = await getRadiusConfig().catch(() => ({
      user_auth_mode: 'mikrotik',
      radius_host: 'localhost',
      radius_user: 'radius',
      radius_password: '',
      radius_database: 'radius'
    }));
    
    res.render('adminRadius', {
      settings,
      page: 'setting-radius',
      error: 'Gagal menyimpan pengaturan RADIUS: ' + e.message,
      success: null
    });
  }
});

module.exports = router;


