const express = require('express');
const router = express.Router();
const { adminAuth } = require('./adminAuth');
const logger = require('../config/logger'); // Add logger
const { 
    addPPPoEUser, 
    editPPPoEUser, 
    deletePPPoEUser, 
    getPPPoEProfiles, 
    addPPPoEProfile, 
    editPPPoEProfile, 
    deletePPPoEProfile, 
    getPPPoEProfileDetail,
    getHotspotProfiles,
    addHotspotProfile,
    editHotspotProfile,
    deleteHotspotProfile,
    getHotspotProfileDetail,
    getMikrotikConnectionForRouter
} = require('../config/mikrotik');
const { kickPPPoEUser } = require('../config/mikrotik2');
const fs = require('fs');
const path = require('path');
const { getSettingsWithCache } = require('../config/settingsManager');
const { getVersionInfo, getVersionBadge } = require('../config/version-utils');

// Helper function untuk konversi timeout ke detik (untuk RADIUS)
function convertToSeconds(value, unit) {
  const numValue = parseInt(value);
  if (isNaN(numValue) || numValue <= 0) return 0;
  
  const unitLower = String(unit).toLowerCase();
  const unitMap = {
    's': 1,           // detik (standar Mikrotik)
    'detik': 1,       // kompatibilitas backward
    'm': 60,          // menit (standar Mikrotik) - lowercase untuk waktu
    'menit': 60,      // kompatibilitas backward
    'men': 60,        // kompatibilitas backward
    'h': 3600,        // jam (standar Mikrotik)
    'jam': 3600,      // kompatibilitas backward
    'd': 86400,       // hari (standar Mikrotik)
    'hari': 86400     // kompatibilitas backward
  };
  
  const multiplier = unitMap[unitLower] || 1;
  return numValue * multiplier;
}

// GET: List User PPPoE
router.get('/mikrotik', adminAuth, async (req, res) => {
  try {
    // Check auth mode
    const { getUserAuthModeAsync, getPPPoEUsersRadius, getActivePPPoEConnectionsRadius } = require('../config/mikrotik');
    const authMode = await getUserAuthModeAsync();
    
    logger.info(`Loading PPPoE users in ${authMode} mode`);
    
    let combined = [];
    let routers = [];
    
    if (authMode === 'radius') {
      // RADIUS mode: Get users from RADIUS database
      logger.info('RADIUS mode: Loading users from RADIUS database');
      try {
        const users = await getPPPoEUsersRadius();
        logger.info(`Found ${users.length} users in RADIUS database`);
        
        const activeConnections = await getActivePPPoEConnectionsRadius();
        logger.info(`Found ${activeConnections.length} active connections in RADIUS`);
        
        const activeNames = new Set(activeConnections.map(a => a.name));
        
        combined = users.map(user => ({
          id: user.name, // Use username as ID for RADIUS
          name: user.name,
          password: user.password,
          profile: user.profile || 'default',
          active: activeNames.has(user.name),
          nas_name: 'RADIUS',
          nas_ip: 'RADIUS Server'
        }));
        
        logger.info(`Mapped ${combined.length} users for display`);
      } catch (radiusError) {
        logger.error(`Error loading users from RADIUS: ${radiusError.message}`, radiusError);
        // Return empty array but log the error
        combined = [];
      }
      // No routers needed for RADIUS mode
    } else {
      // Mikrotik API mode: Get users from routers
      logger.info('Mikrotik API mode: Loading users from routers');
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
      routers = await new Promise((resolve) => db.all('SELECT * FROM routers ORDER BY id', (err, rows) => resolve(rows || [])));
      db.close();

      logger.info(`Found ${routers.length} routers configured`);

      // Aggregate across all NAS
      for (const r of routers) {
        try {
          const conn = await getMikrotikConnectionForRouter(r);
          const [secrets, active] = await Promise.all([
            conn.write('/ppp/secret/print'),
            conn.write('/ppp/active/print')
          ]);
          const activeNames = new Set((active || []).map(a => a.name));
          (secrets || []).forEach(sec => {
            combined.push({
              id: sec['.id'],
              name: sec.name,
              password: sec.password,
              profile: sec.profile,
              active: activeNames.has(sec.name),
              nas_name: r.name,
              nas_ip: r.nas_ip
            });
          });
          logger.info(`Loaded ${secrets?.length || 0} users from router ${r.name}`);
        } catch (e) {
          logger.error(`Error getting users from router ${r.name}:`, e.message);
          // Skip this NAS on error
        }
      }
    }
    
    logger.info(`Total users to display: ${combined.length}`);
    
    // Debug: Log first few users
    if (combined.length > 0) {
      logger.info(`Sample users: ${JSON.stringify(combined.slice(0, 3).map(u => ({ name: u.name, profile: u.profile })))}`);
    } else {
      logger.warn('No users found to display!');
    }
    
    const settings = getSettingsWithCache();
    res.render('adminMikrotik', { 
      users: combined, 
      routers: routers,
      authMode: authMode, // Pass auth mode to view
      settings,
      versionInfo: getVersionInfo(),
      versionBadge: getVersionBadge()
    });
  } catch (err) {
    logger.error('Error loading PPPoE users:', err);
    logger.error('Error stack:', err.stack);
    const settings = getSettingsWithCache();
    res.render('adminMikrotik', { 
      users: [], 
      routers: [],
      authMode: 'mikrotik',
      error: `Gagal mengambil data user PPPoE: ${err.message}`, 
      settings,
      versionInfo: getVersionInfo(),
      versionBadge: getVersionBadge()
    });
  }
});

// POST: Tambah User PPPoE
router.post('/mikrotik/add-user', adminAuth, async (req, res) => {
  try {
    const { username, password, profile, router_id } = req.body;
    
    // Check auth mode
    const { getUserAuthModeAsync } = require('../config/mikrotik');
    const authMode = await getUserAuthModeAsync();
    
    if (authMode === 'radius') {
      // RADIUS mode: Save to radcheck and radusergroup
      logger.info('RADIUS mode: Adding user to RADIUS database');
      const result = await addPPPoEUser({ username, password, profile });
      if (result.success) {
        return res.json({ success: true, message: result.message });
      } else {
        return res.json({ success: false, message: result.message });
      }
    }
    
    // Mikrotik API mode: Need router_id
    if (!router_id) {
      return res.json({ success: false, message: 'Pilih NAS (router) terlebih dahulu' });
    }
    
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
    const router = await new Promise((resolve) => db.get('SELECT * FROM routers WHERE id=?', [parseInt(router_id)], (err, row) => resolve(row || null)));
    db.close();
    if (!router) {
      return res.json({ success: false, message: 'Router tidak ditemukan' });
    }
    
    await addPPPoEUser({ username, password, profile, routerObj: router });
    res.json({ success: true });
  } catch (err) {
    logger.error('Error adding PPPoE user:', err);
    res.json({ success: false, message: err.message });
  }
});

// POST: Edit User PPPoE
router.post('/mikrotik/edit-user', adminAuth, async (req, res) => {
  try {
    const { id, username, password, profile } = req.body;
    
    // Validasi: id harus ada untuk edit
    if (!id) {
      return res.json({ success: false, message: 'ID user tidak ditemukan. Pastikan Anda mengedit user yang sudah ada.' });
    }
    
    // Check auth mode
    const { getUserAuthModeAsync } = require('../config/mikrotik');
    const authMode = await getUserAuthModeAsync();
    
    if (authMode === 'radius') {
      // RADIUS mode: Update in radcheck and radusergroup
      // id adalah username lama di mode RADIUS
      logger.info(`RADIUS mode: Updating user in RADIUS database. Old username: ${id}, New username: ${username}`);
      const result = await editPPPoEUser({ id, username, password, profile });
      if (result.success) {
        return res.json({ success: true, message: result.message });
      } else {
        return res.json({ success: false, message: result.message });
      }
    }
    
    // Mikrotik API mode: id adalah Mikrotik ID
    logger.info(`Mikrotik API mode: Updating user. ID: ${id}, Username: ${username}`);
    const result = await editPPPoEUser({ id, username, password, profile });
    if (result.success) {
      return res.json({ success: true, message: result.message || 'User berhasil di-update' });
    } else {
      return res.json({ success: false, message: result.message || 'Gagal mengupdate user' });
    }
  } catch (err) {
    logger.error('Error editing PPPoE user:', err);
    logger.error('Error stack:', err.stack);
    res.json({ success: false, message: err.message || 'Terjadi kesalahan saat mengupdate user' });
  }
});

// POST: Hapus User PPPoE
router.post('/mikrotik/delete-user', adminAuth, async (req, res) => {
  try {
    const { id } = req.body;
    
    // Check auth mode
    const { getUserAuthModeAsync } = require('../config/mikrotik');
    const authMode = await getUserAuthModeAsync();
    
    if (authMode === 'radius') {
      // RADIUS mode: Delete from radcheck and radusergroup
      logger.info('RADIUS mode: Deleting user from RADIUS database');
      const result = await deletePPPoEUser(id); // In RADIUS mode, id is username
      if (result.success) {
        return res.json({ success: true, message: result.message });
      } else {
        return res.json({ success: false, message: result.message });
      }
    }
    
    // Mikrotik API mode
    await deletePPPoEUser(id);
    res.json({ success: true });
  } catch (err) {
    logger.error('Error deleting PPPoE user:', err);
    res.json({ success: false, message: err.message });
  }
});

// GET: List Profile PPPoE
router.get('/mikrotik/profiles', adminAuth, async (req, res) => {
  try {
    // Check auth mode
    const { getUserAuthModeAsync } = require('../config/mikrotik');
    const authMode = await getUserAuthModeAsync();
    
    let profiles = [];
    let routers = [];
    
    if (authMode === 'radius') {
      // RADIUS mode: Get profiles from RADIUS database
      logger.info('RADIUS mode: Loading profiles from RADIUS database');
      const result = await getPPPoEProfiles();
      if (result.success) {
        profiles = result.data || [];
      }
      // No routers needed for RADIUS mode
    } else {
      // Mikrotik API mode: Get profiles from routers
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
      routers = await new Promise((resolve) => db.all('SELECT * FROM routers ORDER BY id', (err, rows) => resolve(rows || [])));
      db.close();

      // Aggregate profiles from all NAS
      for (const router of routers) {
        try {
          const result = await getPPPoEProfiles(router);
          if (result.success && Array.isArray(result.data)) {
            result.data.forEach(prof => {
              profiles.push({
                ...prof,
                nas_id: router.id,
                nas_name: router.name,
                nas_ip: router.nas_ip
              });
            });
          }
        } catch (e) {
          logger.error(`Error getting profiles from ${router.name}:`, e.message);
        }
      }
    }

    const settings = getSettingsWithCache();
    res.render('adminMikrotikProfiles', { 
      profiles: profiles, 
      routers: routers,
      authMode: authMode, // Pass auth mode to view
      settings,
      versionInfo: getVersionInfo(),
      versionBadge: getVersionBadge()
    });
  } catch (err) {
    logger.error('Error loading PPPoE profiles:', err);
    const settings = getSettingsWithCache();
    res.render('adminMikrotikProfiles', { 
      profiles: [], 
      routers: [],
      authMode: 'mikrotik',
      error: 'Gagal mengambil data profile PPPoE.', 
      settings,
      versionInfo: getVersionInfo(),
      versionBadge: getVersionBadge()
    });
  }
});

// GET: API Daftar Profile PPPoE (untuk dropdown)
router.get('/mikrotik/profiles/api', adminAuth, async (req, res) => {
  try {
    const { router_id } = req.query;
    
    // Check if system is in RADIUS mode
    const { getUserAuthModeAsync } = require('../config/mikrotik');
    const authMode = await getUserAuthModeAsync();
    
    if (authMode === 'radius') {
      // In RADIUS mode, return profiles from RADIUS database
      logger.info('RADIUS mode: Returning profiles from RADIUS database');
      const result = await getPPPoEProfiles();
      if (result.success) {
        return res.json({ 
          success: true, 
          profiles: result.data || [],
          message: `Ditemukan ${result.data?.length || 0} profile dari RADIUS`
        });
      } else {
        return res.json({ 
          success: true, 
          profiles: [], 
          message: result.message || 'Tidak ada profile ditemukan di RADIUS'
        });
      }
    }
    
    // If router_id is provided, only fetch from that router
    if (router_id) {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
      const routerObj = await new Promise((resolve) => db.get('SELECT * FROM routers WHERE id=?', [parseInt(router_id)], (err, row) => {
        db.close();
        resolve(row || null);
      }));
      
      if (!routerObj) {
        return res.json({ success: false, profiles: [], message: 'Router tidak ditemukan' });
      }
      
      try {
        const result = await getPPPoEProfiles(routerObj);
        if (result.success) {
          return res.json({ success: true, profiles: result.data || [] });
        } else {
          // Return empty array instead of error to prevent UI blocking
          logger.warn(`Failed to get profiles from router ${routerObj.name}: ${result.message}`);
          return res.json({ success: true, profiles: [], message: `Tidak dapat mengambil profile dari ${routerObj.name}. Pastikan router dapat diakses.` });
        }
      } catch (profileError) {
        logger.error(`Error getting profiles from router ${routerObj.name}:`, profileError.message);
        return res.json({ success: true, profiles: [], message: `Error: ${profileError.message}` });
      }
    } else {
      // Fetch from all routers (aggregate)
      // First, check if there are any routers configured
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
      const routers = await new Promise((resolve) => db.all('SELECT * FROM routers ORDER BY id', (err, rows) => {
        db.close();
        resolve(rows || []);
      }));
      
      if (!routers || routers.length === 0) {
        return res.json({ 
          success: true, 
          profiles: [], 
          message: 'Tidak ada router yang dikonfigurasi. Silakan tambahkan router terlebih dahulu.' 
        });
      }
      
      // Try to fetch from routers, aggregate results
      let allProfiles = [];
      let errors = [];
      
      for (const router of routers) {
        try {
          const result = await getPPPoEProfiles(router);
          if (result.success && Array.isArray(result.data)) {
            allProfiles = allProfiles.concat(result.data.map(prof => ({
              ...prof,
              nas_id: router.id,
              nas_name: router.name,
              nas_ip: router.nas_ip
            })));
          } else {
            errors.push(`${router.name}: ${result.message || 'Unknown error'}`);
          }
        } catch (routerError) {
          logger.warn(`Error getting profiles from router ${router.name}:`, routerError.message);
          errors.push(`${router.name}: ${routerError.message}`);
        }
      }
      
      // Return profiles even if some routers failed
      if (allProfiles.length > 0 || errors.length === 0) {
        return res.json({ 
          success: true, 
          profiles: allProfiles,
          message: errors.length > 0 ? `Beberapa router tidak dapat diakses: ${errors.join(', ')}` : undefined
        });
      } else {
        // All routers failed, but return empty array to prevent UI blocking
        return res.json({ 
          success: true, 
          profiles: [], 
          message: `Tidak dapat mengambil profile dari router: ${errors.join(', ')}. Pastikan router dapat diakses dan kredensial benar.` 
        });
      }
    }
  } catch (err) {
    logger.error('Error in /mikrotik/profiles/api:', err);
    // Return empty array instead of error to prevent UI blocking
    res.json({ 
      success: true, 
      profiles: [], 
      message: `Error: ${err.message || 'Gagal mengambil daftar profile PPPOE'}` 
    });
  }
});

// GET: API Detail Profile PPPoE
router.get('/mikrotik/profile/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getPPPoEProfileDetail(id);
    if (result.success) {
      res.json({ success: true, profile: result.data });
    } else {
      res.json({ success: false, profile: null, message: result.message });
    }
  } catch (err) {
    res.json({ success: false, profile: null, message: err.message });
  }
});

// POST: Tambah Profile PPPoE
router.post('/mikrotik/add-profile', adminAuth, async (req, res) => {
  try {
    const { router_id, ...profileData } = req.body;
    
    // Check auth mode
    const { getUserAuthModeAsync } = require('../config/mikrotik');
    const authMode = await getUserAuthModeAsync();
    
    if (authMode === 'radius') {
      // RADIUS mode: Save to radgroupreply
      logger.info('RADIUS mode: Adding profile to RADIUS database');
      const result = await addPPPoEProfile(profileData);
      if (result.success) {
        return res.json({ success: true, message: result.message });
      } else {
        return res.json({ success: false, message: result.message });
      }
    }
    
    // Mikrotik API mode: Need router_id
    if (!router_id) {
      return res.json({ success: false, message: 'Pilih NAS (router) terlebih dahulu' });
    }
    
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
    const routerObj = await new Promise((resolve) => db.get('SELECT * FROM routers WHERE id=?', [parseInt(router_id)], (err, row) => {
      db.close();
      resolve(row || null);
    }));
    
    if (!routerObj) {
      return res.json({ success: false, message: 'Router tidak ditemukan' });
    }
    
    const result = await addPPPoEProfile(profileData, routerObj);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: result.message });
    }
  } catch (err) {
    logger.error('Error adding PPPoE profile:', err);
    res.json({ success: false, message: err.message });
  }
});

// POST: Edit Profile PPPoE
router.post('/mikrotik/edit-profile', adminAuth, async (req, res) => {
  try {
    const { router_id, ...profileData } = req.body;
    
    // Check auth mode
    const { getUserAuthModeAsync } = require('../config/mikrotik');
    const authMode = await getUserAuthModeAsync();
    
    if (authMode === 'radius') {
      // RADIUS mode: Update in radgroupreply
      logger.info('RADIUS mode: Updating profile in RADIUS database');
      const result = await editPPPoEProfile(profileData);
      if (result.success) {
        return res.json({ success: true, message: result.message });
      } else {
        return res.json({ success: false, message: result.message });
      }
    }
    
    // Mikrotik API mode: Need router_id
    if (!router_id) {
      return res.json({ success: false, message: 'Pilih NAS (router) terlebih dahulu' });
    }
    
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
    const routerObj = await new Promise((resolve) => db.get('SELECT * FROM routers WHERE id=?', [parseInt(router_id)], (err, row) => {
      db.close();
      resolve(row || null);
    }));
    
    if (!routerObj) {
      return res.json({ success: false, message: 'Router tidak ditemukan' });
    }
    
    const result = await editPPPoEProfile(profileData, routerObj);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: result.message });
    }
  } catch (err) {
    logger.error('Error editing PPPoE profile:', err);
    res.json({ success: false, message: err.message });
  }
});

// POST: Hapus Profile PPPoE
router.post('/mikrotik/delete-profile', adminAuth, async (req, res) => {
  try {
    const { id, router_id } = req.body;
    
    // Check auth mode
    const { getUserAuthModeAsync } = require('../config/mikrotik');
    const authMode = await getUserAuthModeAsync();
    
    if (authMode === 'radius') {
      // RADIUS mode: Delete from radgroupreply
      logger.info('RADIUS mode: Deleting profile from RADIUS database');
      const result = await deletePPPoEProfile(id);
      if (result.success) {
        return res.json({ success: true, message: result.message });
      } else {
        return res.json({ success: false, message: result.message });
      }
    }
    
    // Mikrotik API mode
    let routerObj = null;
    if (router_id) {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
      routerObj = await new Promise((resolve) => db.get('SELECT * FROM routers WHERE id=?', [parseInt(router_id)], (err, row) => {
        db.close();
        resolve(row || null);
      }));
    }
    const result = await deletePPPoEProfile(id, routerObj);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: result.message });
    }
  } catch (err) {
    logger.error('Error deleting PPPoE profile:', err);
    res.json({ success: false, message: err.message });
  }
});

// GET: List Profile Hotspot
router.get('/mikrotik/hotspot-profiles', adminAuth, async (req, res) => {
  try {
    // Check auth mode - RADIUS atau Mikrotik API
    const { getUserAuthModeAsync } = require('../config/mikrotik');
    const { getRadiusConfigValue } = require('../config/radiusConfig');
    let userAuthMode = 'mikrotik';
    try {
      const mode = await getRadiusConfigValue('user_auth_mode', null);
      userAuthMode = mode !== null && mode !== undefined ? mode : 'mikrotik';
    } catch (e) {
      // Fallback
    }

    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
    const routers = await new Promise((resolve) => db.all('SELECT * FROM routers ORDER BY id', (err, rows) => {
      if (err) {
        console.error('Error fetching routers:', err);
        resolve([]);
      } else {
        resolve(rows || []);
      }
    }));
    db.close();

    // Store userAuthMode untuk digunakan di render
    const userAuthModeForRender = userAuthMode;

    // Untuk mode RADIUS, tidak perlu router - ambil dari RADIUS database
    if (userAuthMode === 'radius') {
      try {
        const { getHotspotProfilesRadius } = require('../config/mikrotik');
        logger.info('RADIUS mode: Loading hotspot profiles from RADIUS database');
        const result = await getHotspotProfilesRadius();
        if (result.success) {
          const profiles = result.data || [];
          const settings = getSettingsWithCache();
          return res.render('adminMikrotikHotspotProfiles', { 
            profiles: profiles, 
            routers: [],
            error: null,
            settings,
            versionInfo: getVersionInfo(),
            versionBadge: getVersionBadge(),
            userAuthMode: 'radius'
          });
        } else {
          throw new Error(result.message || 'Failed to get hotspot profiles');
        }
      } catch (radiusError) {
        logger.error('Error fetching hotspot profiles from RADIUS:', radiusError);
        const settings = getSettingsWithCache();
        return res.render('adminMikrotikHotspotProfiles', { 
          profiles: [], 
          routers: [],
          error: `Gagal mengambil data profile hotspot dari RADIUS: ${radiusError.message}`, 
          settings,
          versionInfo: getVersionInfo(),
          versionBadge: getVersionBadge(),
          userAuthMode: 'radius'
        });
      }
    }

    // Untuk mode Mikrotik API, perlu router
    if (!routers || routers.length === 0) {
      console.warn('No routers found in database');
      const settings = getSettingsWithCache();
      return res.render('adminMikrotikHotspotProfiles', { 
        profiles: [], 
        routers: [],
        error: 'Tidak ada router/NAS yang dikonfigurasi. Silakan tambahkan router terlebih dahulu di menu NAS (RADIUS).', 
        settings,
        versionInfo: getVersionInfo(),
        versionBadge: getVersionBadge(),
        userAuthMode: 'mikrotik'
      });
    }

    let combined = [];
    let errorMessages = [];
    for (const r of routers) {
      try {
        console.log(`=== Attempting to get hotspot profiles from router: ${r.name} (${r.nas_ip}:${r.port || 8728}) ===`);
        console.log(`Router data:`, JSON.stringify({
          id: r.id,
          name: r.name,
          nas_ip: r.nas_ip,
          port: r.port,
          user: r.user ? '***' : 'missing',
          password: r.password ? '***' : 'missing'
        }));
        
        const result = await getHotspotProfiles(r);
        console.log(`Result from ${r.name}:`, {
          success: result.success,
          message: result.message,
          dataCount: result.data ? result.data.length : 0
        });
        
        if (result.success && Array.isArray(result.data)) {
          console.log(`✓ Successfully retrieved ${result.data.length} profiles from ${r.name}`);
          if (result.data.length > 0) {
            console.log(`Profile names:`, result.data.map(p => p.name || p['name'] || 'unnamed').join(', '));
          }
          result.data.forEach(prof => {
            const profileObj = {
              ...prof,
              nas_id: r.id,
              nas_name: r.name,
              nas_ip: r.nas_ip
            };
            combined.push(profileObj);
            console.log(`  - Added profile: ${prof.name || prof['name'] || 'unnamed'} from ${r.name}`);
          });
        } else {
          console.warn(`✗ Failed to get profiles from ${r.name}:`, result.message);
          errorMessages.push(`${r.name}: ${result.message}`);
        }
      } catch (e) {
        console.error(`✗ Error getting hotspot profiles from ${r.name} (${r.nas_ip}:${r.port || 8728}):`, e.message);
        console.error('Full error:', e);
        errorMessages.push(`${r.name}: ${e.message}`);
      }
    }
    
    console.log(`=== Total profiles collected: ${combined.length} ===`);
    
    const settings = getSettingsWithCache();
    res.render('adminMikrotikHotspotProfiles', { 
      profiles: combined, 
      routers,
      settings,
      error: errorMessages.length > 0 ? `Beberapa router gagal: ${errorMessages.join('; ')}` : null,
      versionInfo: getVersionInfo(),
      versionBadge: getVersionBadge(),
      userAuthMode: userAuthModeForRender
    });
  } catch (err) {
    console.error('Error in hotspot profiles GET route:', err);
    // Try to get userAuthMode for error page
    let userAuthMode = 'mikrotik';
    try {
      const { getRadiusConfigValue } = require('../config/radiusConfig');
      const mode = await getRadiusConfigValue('user_auth_mode', null);
      userAuthMode = mode !== null && mode !== undefined ? mode : 'mikrotik';
    } catch (e) {
      // Fallback
    }
    
    const settings = getSettingsWithCache();
    res.render('adminMikrotikHotspotProfiles', { 
      profiles: [], 
      routers: [],
      error: `Gagal mengambil data profile Hotspot: ${err.message}`, 
      settings,
      versionInfo: getVersionInfo(),
      versionBadge: getVersionBadge(),
      userAuthMode: userAuthMode
    });
  }
});

// GET: API Daftar Profile Hotspot
router.get('/mikrotik/hotspot-profiles/api', adminAuth, async (req, res) => {
  try {
    const { router_id } = req.query;
    
    // If router_id is provided, only fetch from that router
    if (router_id) {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
      const routerObj = await new Promise((resolve) => db.get('SELECT * FROM routers WHERE id=?', [parseInt(router_id)], (err, row) => {
        db.close();
        resolve(row || null);
      }));
      if (!routerObj) {
        return res.json({ success: false, profiles: [], message: 'Router tidak ditemukan' });
      }
      const result = await getHotspotProfiles(routerObj);
      if (result.success) {
        // Ensure router info is attached
        const profilesWithRouter = result.data.map(prof => ({
          ...prof,
          nas_id: routerObj.id,
          nas_name: routerObj.name,
          nas_ip: routerObj.nas_ip
        }));
        return res.json({ success: true, profiles: profilesWithRouter });
      } else {
        return res.json({ success: false, profiles: [], message: result.message });
      }
    }
    
    // If no router_id, fetch from ALL routers (same logic as GET route)
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
    const routers = await new Promise((resolve) => db.all('SELECT * FROM routers ORDER BY id', (err, rows) => {
      if (err) {
        console.error('Error fetching routers:', err);
        resolve([]);
      } else {
        resolve(rows || []);
      }
    }));
    db.close();
    
    // Check auth mode untuk API endpoint juga
    const { getUserAuthModeAsync } = require('../config/mikrotik');
    const { getRadiusConfigValue } = require('../config/radiusConfig');
    let userAuthMode = 'mikrotik';
    try {
      const mode = await getRadiusConfigValue('user_auth_mode', null);
      userAuthMode = mode !== null && mode !== undefined ? mode : 'mikrotik';
    } catch (e) {
      // Fallback
    }

    // Untuk mode RADIUS, ambil dari RADIUS database (hotspot profiles)
    if (userAuthMode === 'radius') {
      try {
        const { getHotspotProfilesRadius } = require('../config/mikrotik');
        logger.info('RADIUS mode: Loading hotspot profiles from RADIUS database (API)');
        const result = await getHotspotProfilesRadius();
        if (result.success) {
          return res.json({ success: true, profiles: result.data || [] });
        } else {
          throw new Error(result.message || 'Failed to get hotspot profiles');
        }
      } catch (radiusError) {
        logger.error('Error fetching hotspot profiles from RADIUS (API):', radiusError);
        return res.json({ success: false, profiles: [], message: `Gagal mengambil data profile hotspot dari RADIUS: ${radiusError.message}` });
      }
    }

    // Untuk mode Mikrotik API, perlu router
    if (!routers || routers.length === 0) {
      return res.json({ success: false, profiles: [], message: 'Tidak ada router/NAS yang dikonfigurasi' });
    }
    
    let combined = [];
    let errorMessages = [];
    for (const r of routers) {
      try {
        console.log(`=== API: Attempting to get hotspot profiles from router: ${r.name} (${r.nas_ip}:${r.port || 8728}) ===`);
        const result = await getHotspotProfiles(r);
        console.log(`=== API: Result from ${r.name}:`, {
          success: result.success,
          message: result.message,
          dataCount: result.data ? result.data.length : 0
        });
        
        if (result.success && Array.isArray(result.data)) {
          console.log(`✓ API: Successfully retrieved ${result.data.length} profiles from ${r.name}`);
          result.data.forEach(prof => {
            const profileObj = {
              ...prof,
              nas_id: r.id,
              nas_name: r.name,
              nas_ip: r.nas_ip
            };
            combined.push(profileObj);
            console.log(`  - API: Added profile: ${prof.name || prof['name'] || 'unnamed'} from ${r.name} (nas_id: ${r.id}, nas_name: ${r.name}, nas_ip: ${r.nas_ip})`);
          });
        } else {
          console.warn(`✗ API: Failed to get profiles from ${r.name}:`, result.message);
          errorMessages.push(`${r.name}: ${result.message}`);
        }
      } catch (e) {
        console.error(`✗ API: Error getting hotspot profiles from ${r.name} (${r.nas_ip}:${r.port || 8728}):`, e.message);
        errorMessages.push(`${r.name}: ${e.message}`);
      }
    }
    
    console.log(`=== API: Total profiles collected: ${combined.length} ===`);
    
    res.json({ 
      success: true, 
      profiles: combined,
      error: errorMessages.length > 0 ? `Beberapa router gagal: ${errorMessages.join('; ')}` : null
    });
  } catch (err) {
    console.error('Error in hotspot profiles API route:', err);
    res.json({ success: false, profiles: [], message: err.message });
  }
});

// GET: API Detail Profile Hotspot
router.get('/mikrotik/hotspot-profiles/detail/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { router_id } = req.query;
    let routerObj = null;
    if (router_id) {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
      routerObj = await new Promise((resolve) => db.get('SELECT * FROM routers WHERE id=?', [parseInt(router_id)], (err, row) => {
        db.close();
        resolve(row || null);
      }));
    }
    const result = await getHotspotProfileDetail(id, routerObj);
    if (result.success) {
      res.json({ success: true, profile: result.data });
    } else {
      res.json({ success: false, profile: null, message: result.message });
    }
  } catch (err) {
    res.json({ success: false, profile: null, message: err.message });
  }
});

// POST: Tambah Profile Hotspot
router.post('/mikrotik/hotspot-profiles/add', adminAuth, async (req, res) => {
  try {
    // Check auth mode
    const { getRadiusConfigValue } = require('../config/radiusConfig');
    let userAuthMode = 'mikrotik';
    try {
      const mode = await getRadiusConfigValue('user_auth_mode', null);
      userAuthMode = mode !== null && mode !== undefined ? mode : 'mikrotik';
    } catch (e) {
      // Fallback
    }

    const { router_id, id, name, rateLimit, rateLimitUnit, burstLimit, burstLimitUnit, sessionTimeout, sessionTimeoutUnit, idleTimeout, idleTimeoutUnit, sharedUsers, comment } = req.body;

    // Untuk mode RADIUS, simpan ke RADIUS database
    if (userAuthMode === 'radius') {
      if (!name) {
        return res.json({ success: false, message: 'Nama profile harus diisi' });
      }

      try {
        const { getRadiusConnection, syncPackageLimitsToRadius } = require('../config/mikrotik');
        const conn = await getRadiusConnection();
        const groupname = name.toLowerCase().replace(/\s+/g, '_');

        // Build rate limit string dengan burst limit (jika ada)
        let rateLimitStr = '';
        if (rateLimit && rateLimitUnit) {
          const download = `${rateLimit}${rateLimitUnit.toUpperCase()}`;
          const upload = `${rateLimit}${rateLimitUnit.toUpperCase()}`;
          rateLimitStr = `${download}/${upload}`;
          
          // Tambahkan burst limit jika ada
          if (burstLimit && burstLimitUnit) {
            const burstDownload = `${burstLimit}${burstLimitUnit.toUpperCase()}`;
            const burstUpload = `${burstLimit}${burstLimitUnit.toUpperCase()}`;
            rateLimitStr += `:${burstDownload}/${burstUpload}`;
          }
        }

        // Insert rate limit ke radgroupreply
        if (rateLimitStr) {
          await conn.execute(
            "INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES (?, 'MikroTik-Rate-Limit', ':=', ?) ON DUPLICATE KEY UPDATE value = ?",
            [groupname, rateLimitStr, rateLimitStr]
          );
        }

        // Session timeout - konversi ke detik untuk RADIUS
        if (sessionTimeout && sessionTimeoutUnit) {
          const timeoutValue = convertToSeconds(sessionTimeout, sessionTimeoutUnit);
          if (timeoutValue > 0) {
            await conn.execute(
              "INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES (?, 'Session-Timeout', ':=', ?) ON DUPLICATE KEY UPDATE value = ?",
              [groupname, timeoutValue.toString(), timeoutValue.toString()]
            );
          }
        }

        // Idle timeout - konversi ke detik untuk RADIUS
        if (idleTimeout && idleTimeoutUnit) {
          const timeoutValue = convertToSeconds(idleTimeout, idleTimeoutUnit);
          if (timeoutValue > 0) {
            await conn.execute(
              "INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES (?, 'Idle-Timeout', ':=', ?) ON DUPLICATE KEY UPDATE value = ?",
              [groupname, timeoutValue.toString(), timeoutValue.toString()]
            );
          }
        }

        await conn.end();
        return res.json({ success: true, message: 'Profile hotspot berhasil ditambahkan ke RADIUS' });
      } catch (radiusError) {
        console.error('Error adding hotspot profile to RADIUS:', radiusError);
        return res.json({ success: false, message: `Gagal menambah profile ke RADIUS: ${radiusError.message}` });
      }
    }

    // Untuk mode Mikrotik API, perlu router
    if (!router_id) {
      return res.json({ success: false, message: 'Pilih NAS (router) terlebih dahulu' });
    }
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
    const routerObj = await new Promise((resolve) => db.get('SELECT * FROM routers WHERE id=?', [parseInt(router_id)], (err, row) => {
      db.close();
      resolve(row || null);
    }));
    if (!routerObj) {
      return res.json({ success: false, message: 'Router tidak ditemukan' });
    }
    // Clean profileData: remove undefined, null, empty strings, and unsupported parameters
    // Note: local-address, remote-address, dns-server, parent-queue, address-list
    // are NOT supported for hotspot user profile in Mikrotik
    const cleanProfileData = {};
    const unsupportedParams = ['local-address', 'remote-address', 'dns-server', 'parent-queue', 'address-list'];
    Object.keys(req.body).forEach(key => {
      if (key === 'router_id' || key === 'id') return;
      const value = req.body[key];
      // Skip unsupported parameters and null/undefined values
      // Empty strings are OK for optional fields, they will be filtered in addHotspotProfile
      if (value !== undefined && value !== null && !unsupportedParams.includes(key)) {
        cleanProfileData[key] = value;
      }
    });
    console.log('Cleaned profileData for add:', cleanProfileData);
    const result = await addHotspotProfile(cleanProfileData, routerObj);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: result.message });
    }
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// POST: Edit Profile Hotspot
router.post('/mikrotik/hotspot-profiles/edit', adminAuth, async (req, res) => {
  try {
    // Check auth mode
    const { getRadiusConfigValue } = require('../config/radiusConfig');
    let userAuthMode = 'mikrotik';
    try {
      const mode = await getRadiusConfigValue('user_auth_mode', null);
      userAuthMode = mode !== null && mode !== undefined ? mode : 'mikrotik';
    } catch (e) {
      // Fallback
    }

    const { router_id, id, name, rateLimit, rateLimitUnit, burstLimit, burstLimitUnit, sessionTimeout, sessionTimeoutUnit, idleTimeout, idleTimeoutUnit, sharedUsers, comment } = req.body;

    // Untuk mode RADIUS, update di RADIUS database
    if (userAuthMode === 'radius') {
      if (!id && !name) {
        return res.json({ success: false, message: 'ID atau nama profile tidak ditemukan' });
      }

      try {
        const { getRadiusConnection } = require('../config/mikrotik');
        const conn = await getRadiusConnection();
        // Gunakan id (yang adalah name) atau name sebagai groupname
        const groupname = (id || name).toLowerCase().replace(/\s+/g, '_');

        // Build rate limit string dengan burst limit (jika ada)
        let rateLimitStr = '';
        if (rateLimit && rateLimitUnit) {
          const download = `${rateLimit}${rateLimitUnit.toUpperCase()}`;
          const upload = `${rateLimit}${rateLimitUnit.toUpperCase()}`;
          rateLimitStr = `${download}/${upload}`;
          
          // Tambahkan burst limit jika ada
          if (burstLimit && burstLimitUnit) {
            const burstDownload = `${burstLimit}${burstLimitUnit.toUpperCase()}`;
            const burstUpload = `${burstLimit}${burstLimitUnit.toUpperCase()}`;
            rateLimitStr += `:${burstDownload}/${burstUpload}`;
          }
        }
        if (rateLimitStr) {
          await conn.execute(
            "INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES (?, 'MikroTik-Rate-Limit', ':=', ?) ON DUPLICATE KEY UPDATE value = ?",
            [groupname, rateLimitStr, rateLimitStr]
          );
        } else {
          // Hapus rate limit jika tidak diisi
          await conn.execute(
            "DELETE FROM radgroupreply WHERE groupname = ? AND attribute = 'MikroTik-Rate-Limit'",
            [groupname]
          );
        }

        // Session timeout - konversi ke detik untuk RADIUS
        if (sessionTimeout && sessionTimeoutUnit) {
          const timeoutValue = convertToSeconds(sessionTimeout, sessionTimeoutUnit);
          if (timeoutValue > 0) {
            await conn.execute(
              "INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES (?, 'Session-Timeout', ':=', ?) ON DUPLICATE KEY UPDATE value = ?",
              [groupname, timeoutValue.toString(), timeoutValue.toString()]
            );
          }
        } else {
          await conn.execute(
            "DELETE FROM radgroupreply WHERE groupname = ? AND attribute = 'Session-Timeout'",
            [groupname]
          );
        }

        // Idle timeout - konversi ke detik untuk RADIUS
        if (idleTimeout && idleTimeoutUnit) {
          const timeoutValue = convertToSeconds(idleTimeout, idleTimeoutUnit);
          if (timeoutValue > 0) {
            await conn.execute(
              "INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES (?, 'Idle-Timeout', ':=', ?) ON DUPLICATE KEY UPDATE value = ?",
              [groupname, timeoutValue.toString(), timeoutValue.toString()]
            );
          }
        } else {
          await conn.execute(
            "DELETE FROM radgroupreply WHERE groupname = ? AND attribute = 'Idle-Timeout'",
            [groupname]
          );
        }

        await conn.end();
        return res.json({ success: true, message: 'Profile hotspot berhasil diupdate di RADIUS' });
      } catch (radiusError) {
        console.error('Error updating hotspot profile in RADIUS:', radiusError);
        return res.json({ success: false, message: `Gagal update profile di RADIUS: ${radiusError.message}` });
      }
    }

    // Untuk mode Mikrotik API, perlu router
    if (!router_id) {
      return res.json({ success: false, message: 'Pilih NAS (router) terlebih dahulu' });
    }
    if (!id) {
      return res.json({ success: false, message: 'ID profile tidak ditemukan' });
    }
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
    const routerObj = await new Promise((resolve) => db.get('SELECT * FROM routers WHERE id=?', [parseInt(router_id)], (err, row) => {
      db.close();
      resolve(row || null);
    }));
    if (!routerObj) {
      return res.json({ success: false, message: 'Router tidak ditemukan' });
    }
    // Clean profileData: remove undefined, null values, and unsupported parameters
    // Note: local-address, remote-address, dns-server, parent-queue, address-list
    // are NOT supported for hotspot user profile in Mikrotik
    const cleanProfileData = {};
    const unsupportedParams = ['local-address', 'remote-address', 'dns-server', 'parent-queue', 'address-list'];
    Object.keys(req.body).forEach(key => {
      if (key === 'router_id') return;
      const value = req.body[key];
      // Skip unsupported parameters and null/undefined values
      if (value !== undefined && value !== null && !unsupportedParams.includes(key)) {
        cleanProfileData[key] = value;
      }
    });
    console.log('Cleaned profileData for edit:', cleanProfileData);
    const result = await editHotspotProfile(cleanProfileData, routerObj);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: result.message });
    }
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// POST: Hapus Profile Hotspot
router.post('/mikrotik/hotspot-profiles/delete', adminAuth, async (req, res) => {
  try {
    // Check auth mode
    const { getRadiusConfigValue } = require('../config/radiusConfig');
    let userAuthMode = 'mikrotik';
    try {
      const mode = await getRadiusConfigValue('user_auth_mode', null);
      userAuthMode = mode !== null && mode !== undefined ? mode : 'mikrotik';
    } catch (e) {
      // Fallback
    }

    const { id, router_id, name } = req.body;

    // Untuk mode RADIUS, hapus dari RADIUS database
    if (userAuthMode === 'radius') {
      if (!id && !name) {
        return res.json({ success: false, message: 'ID atau nama profile tidak ditemukan' });
      }

      try {
        const { getRadiusConnection } = require('../config/mikrotik');
        const conn = await getRadiusConnection();
        // Gunakan id (yang adalah name) atau name sebagai groupname
        const groupname = (id || name).toLowerCase().replace(/\s+/g, '_');

        // Hapus semua attributes untuk groupname ini dari radgroupreply
        await conn.execute(
          "DELETE FROM radgroupreply WHERE groupname = ?",
          [groupname]
        );

        // Hapus juga dari radusergroup jika ada user yang assign ke group ini
        // (Opsional: bisa juga tidak dihapus jika ingin user tetap ada tapi tanpa profile)
        // await conn.execute("DELETE FROM radusergroup WHERE groupname = ?", [groupname]);

        await conn.end();
        return res.json({ success: true, message: 'Profile hotspot berhasil dihapus dari RADIUS' });
      } catch (radiusError) {
        console.error('Error deleting hotspot profile from RADIUS:', radiusError);
        return res.json({ success: false, message: `Gagal hapus profile dari RADIUS: ${radiusError.message}` });
      }
    }

    // Untuk mode Mikrotik API, perlu router
    if (!router_id) {
      return res.json({ success: false, message: 'Pilih NAS (router) terlebih dahulu' });
    }
    if (!id) {
      return res.json({ success: false, message: 'ID profile tidak ditemukan' });
    }
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
    const routerObj = await new Promise((resolve) => db.get('SELECT * FROM routers WHERE id=?', [parseInt(router_id)], (err, row) => {
      db.close();
      resolve(row || null);
    }));
    if (!routerObj) {
      return res.json({ success: false, message: 'Router tidak ditemukan' });
    }
    const result = await deleteHotspotProfile(id, routerObj);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: result.message });
    }
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// POST: Putuskan sesi PPPoE user
router.post('/mikrotik/disconnect-session', adminAuth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.json({ success: false, message: 'Username tidak boleh kosong' });
    const result = await kickPPPoEUser(username);
    res.json(result);
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// GET: Get PPPoE user statistics
router.get('/mikrotik/user-stats', adminAuth, async (req, res) => {
  try {
    // Check auth mode
    const { getUserAuthModeAsync, getRadiusStatistics } = require('../config/mikrotik');
    const authMode = await getUserAuthModeAsync();
    
    if (authMode === 'radius') {
      // RADIUS mode: Get statistics from RADIUS database
      logger.info('RADIUS mode: Getting user statistics from RADIUS database');
      try {
        const stats = await getRadiusStatistics();
        return res.json({ 
          success: true, 
          totalUsers: stats.total || 0, 
          activeUsers: stats.active || 0, 
          offlineUsers: stats.offline || 0
        });
      } catch (radiusError) {
        logger.error(`Error getting RADIUS statistics: ${radiusError.message}`);
        return res.json({ 
          success: true, 
          totalUsers: 0, 
          activeUsers: 0, 
          offlineUsers: 0 
        });
      }
    }
    
    // Mikrotik API mode: Get statistics from routers
    logger.info('Mikrotik API mode: Getting user statistics from routers');
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
    const routers = await new Promise((resolve) => db.all('SELECT * FROM routers ORDER BY id', (err, rows) => resolve(rows || [])));
    db.close();
    let totalUsers = 0, activeUsers = 0;
    for (const r of routers) {
      try {
        const conn = await getMikrotikConnectionForRouter(r);
        const [secrets, active] = await Promise.all([
          conn.write('/ppp/secret/print'),
          conn.write('/ppp/active/print')
        ]);
        totalUsers += Array.isArray(secrets) ? secrets.length : 0;
        activeUsers += Array.isArray(active) ? active.length : 0;
      } catch (_) {}
    }
    const offlineUsers = Math.max(totalUsers - activeUsers, 0);
    
    res.json({ 
      success: true, 
      totalUsers, 
      activeUsers, 
      offlineUsers 
    });
  } catch (err) {
    logger.error('Error getting PPPoE user stats:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message,
      totalUsers: 0,
      activeUsers: 0,
      offlineUsers: 0
    });
  }
});

// POST: Restart Mikrotik
router.post('/mikrotik/restart', adminAuth, async (req, res) => {
  try {
    const { restartRouter } = require('../config/mikrotik');
    const result = await restartRouter();
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.json({ success: false, message: result.message });
    }
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
