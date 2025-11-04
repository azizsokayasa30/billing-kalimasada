const express = require('express');
const router = express.Router();
const { adminAuth } = require('./adminAuth');
const { getRadiusConfig, saveRadiusConfig } = require('../config/radiusConfig');
const logger = require('../config/logger');
const { getRadiusConnection } = require('../config/mikrotik');

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
        radius_user: 'billing',
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
      radius_user: radius_user ? radius_user.trim() : 'billing',
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

// GET: Test koneksi RADIUS
router.get('/radius/test', adminAuth, async (req, res) => {
  try {
    const settings = await getRadiusConfig();
    
    if (settings.user_auth_mode !== 'radius') {
      return res.json({
        success: false,
        message: 'Mode bukan RADIUS. Test hanya untuk mode RADIUS.',
        mode: settings.user_auth_mode
      });
    }
    
    // Test koneksi database
    const conn = await getRadiusConnection();
    
    // Test query sederhana
    const [testRows] = await conn.execute('SELECT 1 as test');
    const testResult = testRows[0]?.test;
    
    // Get statistics untuk verify
    const [userCount] = await conn.execute(`
      SELECT COUNT(DISTINCT username) as total
      FROM radcheck
      WHERE attribute = 'Cleartext-Password'
    `);
    const totalUsers = userCount[0]?.total || 0;
    
    // Get active connections
    const [activeCount] = await conn.execute(`
      SELECT COUNT(DISTINCT username) as active
      FROM radacct
      WHERE acctstoptime IS NULL
    `);
    const activeConnections = activeCount[0]?.active || 0;
    
    await conn.end();
    
    res.json({
      success: true,
      message: 'Koneksi ke RADIUS database berhasil!',
      connection: {
        host: settings.radius_host || 'localhost',
        database: settings.radius_database || 'radius',
        user: settings.radius_user || 'radius',
        status: 'connected'
      },
      statistics: {
        totalUsers: totalUsers,
        activeConnections: activeConnections,
        offlineUsers: Math.max(totalUsers - activeConnections, 0)
      },
      testQuery: testResult === 1 ? 'OK' : 'FAILED'
    });
  } catch (error) {
    logger.error('Error testing RADIUS connection:', error);
    res.json({
      success: false,
      message: 'Gagal koneksi ke RADIUS database: ' + error.message,
      error: error.message,
      connection: {
        status: 'failed'
      }
    });
  }
});

module.exports = router;


