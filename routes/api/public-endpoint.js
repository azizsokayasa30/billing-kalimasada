'use strict';

const express = require('express');
const router = express.Router();
const { getPublicEndpointConfig } = require('../../config/public-endpoint');

/**
 * GET /api/public/client
 * Tanpa auth — supaya aplikasi Android bisa baca base URL setelah user isi host di konfigurasi,
 * atau setelah resolve DNS ke server Anda.
 */
router.get('/client', (req, res) => {
  try {
    res.json({
      success: true,
      ...getPublicEndpointConfig(),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Config error' });
  }
});

module.exports = router;
