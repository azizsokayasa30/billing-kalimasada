const express = require('express');
const router = express.Router();
const { adminAuth } = require('./adminAuth');
const { getRadiusConfig, saveRadiusConfig } = require('../config/radiusConfig');
const logger = require('../config/logger');
const { getRadiusConnection } = require('../config/mikrotik');
const { parseClientsConf, writeClientsConf, restartFreeRADIUS, validateClient } = require('../config/radiusClients');

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

// GET: Halaman Manage RADIUS Clients
router.get('/radius/clients', adminAuth, async (req, res) => {
  try {
    const clients = parseClientsConf();
    const settings = await getRadiusConfig();
    
    res.render('adminRadiusClients', {
      clients,
      settings,
      page: 'setting-radius-clients',
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    logger.error('Error loading RADIUS clients:', error);
    res.render('adminRadiusClients', {
      clients: [],
      settings: {},
      page: 'setting-radius-clients',
      error: 'Gagal memuat daftar clients: ' + error.message,
      success: null
    });
  }
});

// GET: API - Get all clients
router.get('/radius/clients/api', adminAuth, async (req, res) => {
  try {
    const clients = parseClientsConf();
    res.json({ success: true, clients });
  } catch (error) {
    logger.error('Error getting clients:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST: Add new client
router.post('/radius/clients/add', adminAuth, async (req, res) => {
  try {
    const { name, ipaddr, secret, nas_type, require_message_authenticator, comment } = req.body;

    // Validate
    const validation = validateClient({ name, ipaddr, secret });
    if (!validation.valid) {
      return res.json({ success: false, message: validation.errors.join(', ') });
    }

    // Get existing clients
    const clients = parseClientsConf();

    // Check duplicate name
    if (clients.some(c => c.name === name.trim())) {
      return res.json({ success: false, message: 'Client dengan nama tersebut sudah ada' });
    }

    // Check duplicate IP
    if (clients.some(c => c.ipaddr === ipaddr.trim())) {
      return res.json({ success: false, message: 'Client dengan IP tersebut sudah ada' });
    }

    // Add new client
    clients.push({
      name: name.trim(),
      ipaddr: ipaddr.trim(),
      secret: secret.trim(),
      nas_type: nas_type || 'other',
      require_message_authenticator: require_message_authenticator || 'no',
      comment: comment || null
    });

    // Write to file
    writeClientsConf(clients);

    // Restart FreeRADIUS
    const restartResult = restartFreeRADIUS();

    res.json({
      success: true,
      message: 'Client berhasil ditambahkan' + (restartResult.success ? ' dan FreeRADIUS berhasil direstart' : ''),
      client: clients[clients.length - 1],
      restart: restartResult
    });
  } catch (error) {
    logger.error('Error adding client:', error);
    res.status(500).json({ success: false, message: 'Gagal menambah client: ' + error.message });
  }
});

// POST: Update client
router.post('/radius/clients/edit', adminAuth, async (req, res) => {
  try {
    const { oldName, name, ipaddr, secret, nas_type, require_message_authenticator, comment } = req.body;

    // Validate
    const validation = validateClient({ name, ipaddr, secret });
    if (!validation.valid) {
      return res.json({ success: false, message: validation.errors.join(', ') });
    }

    // Get existing clients
    const clients = parseClientsConf();

    // Find client index
    const clientIndex = clients.findIndex(c => c.name === oldName);
    if (clientIndex === -1) {
      return res.json({ success: false, message: 'Client tidak ditemukan' });
    }

    // Check duplicate name (if name changed)
    if (name !== oldName && clients.some(c => c.name === name.trim() && c.name !== oldName)) {
      return res.json({ success: false, message: 'Client dengan nama tersebut sudah ada' });
    }

    // Check duplicate IP (if IP changed)
    if (ipaddr !== clients[clientIndex].ipaddr && clients.some(c => c.ipaddr === ipaddr.trim() && c.name !== oldName)) {
      return res.json({ success: false, message: 'Client dengan IP tersebut sudah ada' });
    }

    // Update client
    clients[clientIndex] = {
      name: name.trim(),
      ipaddr: ipaddr.trim(),
      secret: secret.trim(),
      nas_type: nas_type || 'other',
      require_message_authenticator: require_message_authenticator || 'no',
      comment: comment || null
    };

    // Write to file
    writeClientsConf(clients);

    // Restart FreeRADIUS
    const restartResult = restartFreeRADIUS();

    res.json({
      success: true,
      message: 'Client berhasil diupdate' + (restartResult.success ? ' dan FreeRADIUS berhasil direstart' : ''),
      client: clients[clientIndex],
      restart: restartResult
    });
  } catch (error) {
    logger.error('Error updating client:', error);
    res.status(500).json({ success: false, message: 'Gagal update client: ' + error.message });
  }
});

// POST: Delete client
router.post('/radius/clients/delete', adminAuth, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.json({ success: false, message: 'Client name diperlukan' });
    }

    // Get existing clients
    const clients = parseClientsConf();

    // Filter out the client to delete
    const filteredClients = clients.filter(c => c.name !== name);

    if (filteredClients.length === clients.length) {
      return res.json({ success: false, message: 'Client tidak ditemukan' });
    }

    // Write to file
    writeClientsConf(filteredClients);

    // Restart FreeRADIUS
    const restartResult = restartFreeRADIUS();

    res.json({
      success: true,
      message: 'Client berhasil dihapus' + (restartResult.success ? ' dan FreeRADIUS berhasil direstart' : ''),
      restart: restartResult
    });
  } catch (error) {
    logger.error('Error deleting client:', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus client: ' + error.message });
  }
});

module.exports = router;


