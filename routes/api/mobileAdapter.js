/**
 * Mobile app (Flutter) — adapter API untuk teknisi/kolektor.
 * Auth: JWT sama seperti /api/auth/login (Bearer).
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { verifyToken } = require('./auth');
const logger = require('../../config/logger');
const { getSetting, getLocalTimestamp } = require('../../config/settingsManager');
require('../../config/technicianFieldNotifications');

const dbPath = path.join(__dirname, '../../data/billing.db');
const db = new sqlite3.Database(dbPath);
const CableNetworkUtils = require('../../utils/cableNetworkUtils');

// Kolom untuk timer tugas perbaikan (idempotent)
db.run(
    'ALTER TABLE trouble_reports ADD COLUMN work_started_at DATETIME',
    (err) => {
        if (err && !/duplicate column/i.test(String(err.message))) {
            logger.warn('[mobile-adapter] trouble_reports.work_started_at:', err.message);
        }
    }
);
db.run(
    'ALTER TABLE trouble_reports ADD COLUMN work_duration_seconds INTEGER',
    (err) => {
        if (err && !/duplicate column/i.test(String(err.message))) {
            logger.warn('[mobile-adapter] trouble_reports.work_duration_seconds:', err.message);
        }
    }
);

const installJobAlterSql = [
    'ALTER TABLE installation_jobs ADD COLUMN work_started_at DATETIME',
    'ALTER TABLE installation_jobs ADD COLUMN work_duration_seconds INTEGER',
    'ALTER TABLE installation_jobs ADD COLUMN tech_completion_latitude REAL',
    'ALTER TABLE installation_jobs ADD COLUMN tech_completion_longitude REAL',
    'ALTER TABLE installation_jobs ADD COLUMN install_cable_length_m REAL',
    'ALTER TABLE installation_jobs ADD COLUMN install_ont_sticker_photo_path TEXT'
];
for (const sql of installJobAlterSql) {
    db.run(sql, (err) => {
        if (err && !/duplicate column/i.test(String(err.message))) {
            logger.warn('[mobile-adapter] installation_jobs schema:', err.message);
        }
    });
}

/** Durasi dari app mobile (detik), dibatasi agar masuk akal */
function clampWorkDurationSeconds(raw) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    const maxSec = 168 * 3600; // 7 hari
    return Math.min(n, maxSec);
}

function parseCompletionLatLng(body) {
    if (!body || typeof body !== 'object') return { lat: null, lng: null };
    const lat = parseFloat(
        body.completion_latitude ?? body.latitude ?? body.tag_latitude ?? body.tag_lat
    );
    const lng = parseFloat(
        body.completion_longitude ?? body.longitude ?? body.tag_longitude ?? body.tag_lng
    );
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null };
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { lat: null, lng: null };
    return { lat, lng };
}

/** Samakan normalisasi nomor dengan query daftar tugas INSTALL */
function resolveCustomerIdFromInstallationJob(jobRow) {
    return new Promise((resolve) => {
        if (!jobRow) {
            resolve(null);
            return;
        }
        const fromCol = jobRow.customer_id != null ? parseInt(jobRow.customer_id, 10) : NaN;
        if (Number.isFinite(fromCol) && fromCol > 0) {
            resolve(fromCol);
            return;
        }
        const rawPhone = (jobRow.customer_phone || '').trim();
        if (!rawPhone) {
            resolve(null);
            return;
        }
        db.get(
            `SELECT id FROM customers
             WHERE REPLACE(REPLACE(REPLACE(LOWER(TRIM(phone)), ' ', ''), '-', ''), '+', '') =
                   REPLACE(REPLACE(REPLACE(LOWER(TRIM(?)), ' ', ''), '-', ''), '+', '')
             ORDER BY id DESC LIMIT 1`,
            [rawPhone],
            (err, row) => {
                if (err) {
                    logger.warn('[mobile-adapter] resolve customer_id job PSB:', err.message);
                    resolve(null);
                    return;
                }
                resolve(row && row.id != null ? parseInt(row.id, 10) : null);
            }
        );
    });
}

function updateCustomerTagLocation(customerId, lat, lng) {
    return new Promise((resolve) => {
        if (!customerId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            resolve();
            return;
        }
        db.run(
            'UPDATE customers SET latitude = ?, longitude = ? WHERE id = ?',
            [lat, lng, customerId],
            (ce) => {
                if (ce) {
                    logger.warn('[mobile-adapter] update pelanggan tag lokasi:', ce.message);
                }
                resolve();
            }
        );
    });
}

function backfillInstallationJobCustomerId(jobId, customerId) {
    return new Promise((resolve) => {
        if (!jobId || !customerId) {
            resolve();
            return;
        }
        db.run(
            `UPDATE installation_jobs SET customer_id = ?
             WHERE id = ? AND (customer_id IS NULL OR customer_id = 0)`,
            [customerId, jobId],
            () => resolve()
        );
    });
}

const { resolveEmployeePhotoPath, buildPhotoUrl } = require('../../utils/technicianEmployeePhoto');

/** Tanpa auth — untuk cek deploy / reverse proxy (GET …/health) */
router.get('/health', (req, res) => {
    res.json({ success: true, service: 'mobile-adapter', time: new Date().toISOString() });
});

function allowFieldOps(req, res, next) {
    const role = req.user && req.user.role;
    if (!['technician', 'collector', 'admin'].includes(role)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    next();
}

function requireTechnician(req, res, next) {
    const role = req.user && req.user.role;
    if (role !== 'technician' && role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Hanya teknisi' });
    }
    next();
}

function mapInstallPriority(p) {
    const u = String(p || 'normal').toLowerCase();
    if (u === 'urgent' || u === 'high') return 'HIGH';
    if (u === 'normal') return 'NORMAL';
    return 'MEDIUM';
}

function mapDisplayStatusInstall(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'completed' || s === 'cancelled') return 'closed';
    return s || 'scheduled';
}

function mapDisplayStatusTrouble(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'resolved' || s === 'closed') return 'closed';
    if (s === 'in_progress') return 'in_progress';
    return s || 'open';
}

/** Simpan foto base64 (opsional) ke public/img/field-completion — kembalikan path relatif `/img/...` */
function decodeAndSaveCompletionPhoto(base64Input) {
    if (base64Input == null || base64Input === '') return null;
    let raw = String(base64Input).trim();
    if (!raw) return null;
    if (raw.includes(',')) raw = raw.split(',').pop();
    let buf;
    try {
        buf = Buffer.from(raw, 'base64');
    } catch (e) {
        throw new Error('Format foto tidak valid');
    }
    if (!buf || buf.length < 24) throw new Error('Foto tidak valid');
    if (buf.length > 4 * 1024 * 1024) throw new Error('Foto terlalu besar (maks 4MB)');
    const dir = path.join(__dirname, '../../public/img/field-completion');
    fs.mkdirSync(dir, { recursive: true });
    const name = `fc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
    fs.writeFileSync(path.join(dir, name), buf);
    return `/img/field-completion/${name}`;
}

function decodeAndSaveStickerPhoto(base64Input) {
    if (base64Input == null || base64Input === '') return null;
    let raw = String(base64Input).trim();
    if (!raw) return null;
    if (raw.includes(',')) raw = raw.split(',').pop();
    let buf;
    try {
        buf = Buffer.from(raw, 'base64');
    } catch (e) {
        throw new Error('Format foto stiker tidak valid');
    }
    if (!buf || buf.length < 24) throw new Error('Foto stiker tidak valid');
    if (buf.length > 4 * 1024 * 1024) throw new Error('Foto stiker terlalu besar (maks 4MB)');
    const dir = path.join(__dirname, '../../public/img/field-completion');
    fs.mkdirSync(dir, { recursive: true });
    const name = `ont-sticker-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
    fs.writeFileSync(path.join(dir, name), buf);
    return `/img/field-completion/${name}`;
}

// --- Customers (pagination) ---
router.get('/customers', verifyToken, allowFieldOps, (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search && String(req.query.search).trim()) || '';
    const status = (req.query.status && String(req.query.status).trim()) || '';

    const params = [];
    let where = '1=1';
    if (status) {
        where += ' AND LOWER(c.status) = LOWER(?)';
        params.push(status);
    }
    if (search) {
        where += ' AND (c.name LIKE ? OR c.phone LIKE ? OR CAST(c.customer_id AS TEXT) LIKE ? OR c.username LIKE ?)';
        const like = `%${search.replace(/%/g, '')}%`;
        params.push(like, like, like, like);
    }

    const sql = `
        SELECT c.id, c.customer_id, c.name, c.phone, c.status, c.address,
               c.latitude, c.longitude, c.pppoe_username,
               p.name AS profile
        FROM customers c
        LEFT JOIN packages p ON c.package_id = p.id
        WHERE ${where}
        ORDER BY c.id DESC
        LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    db.all(sql, params, (err, rows) => {
        if (err) {
            logger.error('[mobile-adapter] customers:', err);
            return res.status(500).json({ success: false, message: 'Gagal memuat pelanggan' });
        }
        const list = (rows || []).map((r) => ({
            ...r,
            ip_address: r.pppoe_username ? 'PPPoE' : 'DHCP/Dynamic'
        }));
        res.json({ success: true, data: list });
    });
});

router.get('/customers/search', verifyToken, allowFieldOps, (req, res) => {
    const q = (req.query.q && String(req.query.q).trim()) || '';
    if (q.length < 1) {
        return res.json({ success: true, data: [] });
    }
    const like = `%${q.replace(/%/g, '')}%`;
    db.all(
        `SELECT c.id, c.customer_id, c.name, c.phone, c.status, c.address
         FROM customers c
         WHERE c.name LIKE ? OR c.phone LIKE ? OR CAST(c.customer_id AS TEXT) LIKE ?
         ORDER BY c.name
         LIMIT 30`,
        [like, like, like],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            res.json({ success: true, data: rows || [] });
        }
    );
});

router.put('/customers/:customerId/location', verifyToken, requireTechnician, (req, res) => {
    const id = parseInt(req.params.customerId, 10);
    const { latitude, longitude } = req.body || {};
    if (!Number.isFinite(id) || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, message: 'Data tidak valid' });
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ success: false, message: 'Koordinat tidak valid' });
    }
    db.run(
        'UPDATE customers SET latitude = ?, longitude = ? WHERE id = ?',
        [lat, lng, id],
        function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
            }
            res.json({ success: true, message: 'Lokasi diperbarui' });
        }
    );
});

// --- Profil teknisi (sinkron dengan data web / tabel technicians) ---
router.get('/me', verifyToken, requireTechnician, (req, res) => {
    const techId = parseInt(req.user.id, 10);
    if (!Number.isFinite(techId)) {
        return res.status(400).json({ success: false, message: 'ID teknisi tidak valid' });
    }
    db.get('SELECT * FROM technicians WHERE id = ? AND is_active = 1', [techId], (err, row) => {
        if (err) {
            logger.error('[mobile-adapter] /me', err);
            return res.status(500).json({ success: false, message: err.message });
        }
        if (!row) {
            return res.status(404).json({ success: false, message: 'Profil teknisi tidak ditemukan' });
        }
        if (row.password) delete row.password;
        resolveEmployeePhotoPath(db, row, (ePh, relPath) => {
            if (ePh) {
                logger.warn('[mobile-adapter] /me foto karyawan:', ePh.message);
            }
            const data = {
                id: row.id,
                name: row.name,
                role: 'technician',
                position: row.role || 'technician',
                phone: row.phone,
                email: row.email || null,
                area_coverage: row.area_coverage || '',
                notes: row.notes || '',
                whatsapp_group_id: row.whatsapp_group_id || null,
                join_date: row.join_date || null,
                last_login: row.last_login || null,
                created_at: row.created_at || null,
                support_whatsapp: getSetting('contact_whatsapp', '') || ''
            };
            if (relPath) {
                data.photo_url = buildPhotoUrl(relPath);
            }
            res.json({ success: true, data });
        });
    });
});

// --- Dashboard stats ---
router.get('/dashboard', verifyToken, allowFieldOps, (req, res) => {
    db.get(
        `SELECT
            COUNT(*) AS total_customers,
            SUM(CASE WHEN LOWER(status) = 'active' THEN 1 ELSE 0 END) AS active_customers,
            SUM(CASE WHEN LOWER(status) = 'suspended' THEN 1 ELSE 0 END) AS suspended_customers,
            SUM(CASE WHEN LOWER(status) IN ('inactive','register') THEN 1 ELSE 0 END) AS isolated_customers
         FROM customers`,
        [],
        (err, row) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            res.json({
                success: true,
                data: {
                    stats: {
                        total_customers: row.total_customers || 0,
                        active_customers: row.active_customers || 0,
                        suspended_customers: row.suspended_customers || 0,
                        isolated_customers: row.isolated_customers || 0
                    }
                }
            });
        }
    );
});

// --- Tasks: instalasi + tiket gangguan untuk teknisi login ---
// ?history=1 → hanya tugas selesai (untuk riwayat profil). Tanpa param → hanya tugas aktif.
router.get('/tasks', verifyToken, requireTechnician, (req, res) => {
    const techId = parseInt(req.user.id, 10);
    if (!Number.isFinite(techId)) {
        return res.status(400).json({ success: false, message: 'ID teknisi tidak valid' });
    }

    const history = String(req.query.history || '') === '1';

    const installWhere = history
        ? `ij.assigned_technician_id = ? AND LOWER(ij.status) IN ('completed','cancelled')`
        : `ij.assigned_technician_id = ? AND LOWER(ij.status) NOT IN ('completed','cancelled')`;

    const installSql = `
        SELECT ij.*, p.name AS package_name,
            COALESCE(
                (SELECT COALESCE(NULLIF(TRIM(pppoe_username), ''), NULLIF(TRIM(username), ''))
                 FROM customers WHERE id = ij.customer_id AND NULLIF(ij.customer_id, 0) IS NOT NULL),
                (SELECT COALESCE(NULLIF(TRIM(pppoe_username), ''), NULLIF(TRIM(username), ''))
                 FROM customers cu
                 WHERE (ij.customer_id IS NULL OR ij.customer_id = 0)
                   AND NULLIF(TRIM(IFNULL(ij.customer_phone, '')), '') IS NOT NULL
                   AND REPLACE(REPLACE(REPLACE(LOWER(TRIM(cu.phone)), ' ', ''), '-', ''), '+', '') =
                       REPLACE(REPLACE(REPLACE(LOWER(TRIM(ij.customer_phone)), ' ', ''), '-', ''), '+', '')
                 ORDER BY cu.id DESC LIMIT 1)
            ) AS cust_pppoe_username,
            COALESCE(
                (SELECT NULLIF(TRIM(password), '') FROM customers WHERE id = ij.customer_id AND NULLIF(ij.customer_id, 0) IS NOT NULL),
                (SELECT NULLIF(TRIM(password), '') FROM customers cu
                 WHERE (ij.customer_id IS NULL OR ij.customer_id = 0)
                   AND NULLIF(TRIM(IFNULL(ij.customer_phone, '')), '') IS NOT NULL
                   AND REPLACE(REPLACE(REPLACE(LOWER(TRIM(cu.phone)), ' ', ''), '-', ''), '+', '') =
                       REPLACE(REPLACE(REPLACE(LOWER(TRIM(ij.customer_phone)), ' ', ''), '-', ''), '+', '')
                 ORDER BY cu.id DESC LIMIT 1)
            ) AS cust_pppoe_password
        FROM installation_jobs ij
        LEFT JOIN packages p ON ij.package_id = p.id
        WHERE ${installWhere}
        ORDER BY ij.updated_at DESC, ij.created_at DESC
        LIMIT 200
    `;

    const troubleWhere = history
        ? `(assigned_technician_id = ? OR CAST(assigned_technician_id AS TEXT) = ?)
            AND LOWER(status) IN ('closed','resolved')`
        : `(assigned_technician_id = ? OR CAST(assigned_technician_id AS TEXT) = ?)
            AND LOWER(status) NOT IN ('closed','resolved')`;

    db.all(installSql, [techId], (err1, installRows) => {
        if (err1) {
            logger.error('[mobile-adapter] tasks install:', err1);
            return res.status(500).json({ success: false, message: 'Gagal memuat tugas instalasi' });
        }
        db.all(
            `SELECT * FROM trouble_reports
             WHERE ${troubleWhere}
             ORDER BY updated_at DESC, created_at DESC
             LIMIT 200`,
            [techId, String(techId)],
            async (err2, troubleRows) => {
                if (err2) {
                    logger.error('[mobile-adapter] tasks trouble:', err2);
                    return res.status(500).json({ success: false, message: 'Gagal memuat tiket' });
                }

                let getRadcheckCleartextPassword;
                try {
                    ({ getRadcheckCleartextPassword } = require('../../config/mikrotik'));
                } catch (e) {
                    getRadcheckCleartextPassword = null;
                }

                const tasks = [];
                for (const row of installRows || []) {
                    const activityAt = row.updated_at || row.created_at || '';
                    const stLow = String(row.status || '').toLowerCase();
                    const ws =
                        row.work_started_at ||
                        (stLow === 'in_progress' ? row.updated_at || null : null);
                    const pppUser =
                        (row.cust_pppoe_username && String(row.cust_pppoe_username).trim()) || '';
                    let pppPass =
                        row.cust_pppoe_password != null && String(row.cust_pppoe_password).trim() !== ''
                            ? String(row.cust_pppoe_password).trim()
                            : null;
                    if ((!pppPass || String(pppPass).trim() === '') && pppUser && typeof getRadcheckCleartextPassword === 'function') {
                        try {
                            const fromRadius = await getRadcheckCleartextPassword(pppUser);
                            if (fromRadius != null && String(fromRadius).trim() !== '') {
                                pppPass = String(fromRadius).trim();
                            }
                        } catch (radErr) {
                            logger.warn('[mobile-adapter] tasks install RADIUS password:', radErr.message || radErr);
                        }
                    }
                    tasks.push({
                        id: row.id,
                        type: 'INSTALL',
                        job_number: row.job_number || null,
                        title: `PSB · ${row.job_number || ''}`,
                        customer: row.customer_name,
                        address: row.customer_address,
                        phone: row.customer_phone,
                        customer_id: (() => {
                            const c = row.customer_id != null ? parseInt(row.customer_id, 10) : NaN;
                            return Number.isFinite(c) && c > 0 ? c : null;
                        })(),
                        status: mapDisplayStatusInstall(row.status),
                        priority: mapInstallPriority(row.priority),
                        description: row.notes || row.package_name || '',
                        sector: 'PSB',
                        activity_at: activityAt,
                        work_started_at: ws,
                        pppoe_username: pppUser || null,
                        pppoe_password: pppPass
                    });
                }
                for (const row of troubleRows || []) {
                    const activityAt = row.updated_at || row.created_at || '';
                    const stLow = String(row.status || '').toLowerCase();
                    const ws =
                        row.work_started_at ||
                        (stLow === 'in_progress' ? row.updated_at || null : null);
                    tasks.push({
                        id: row.id,
                        type: 'TR',
                        title: row.category || 'Tiket gangguan',
                        customer: row.name,
                        address: row.location || '',
                        phone: row.phone,
                        status: mapDisplayStatusTrouble(row.status),
                        priority: mapInstallPriority(row.priority),
                        description: row.description || '',
                        sector: 'TIKET',
                        activity_at: activityAt,
                        work_started_at: ws
                    });
                }
                tasks.sort((a, b) => String(b.activity_at || '').localeCompare(String(a.activity_at || '')));
                res.json({ success: true, data: tasks });
            }
        );
    });
});

router.post('/tasks/:type/:id/status', verifyToken, requireTechnician, (req, res) => {
    const { type, id } = req.params;
    const body = req.body || {};
    const { status } = body;
    if (!status) {
        return res.status(400).json({ success: false, message: 'Status wajib diisi' });
    }
    const techId = parseInt(req.user.id, 10);
    const rawStatus = String(status).toLowerCase();

    if (type === 'INSTALL') {
        const jobId = parseInt(id, 10);
        if (!Number.isFinite(jobId)) {
            return res.status(400).json({ success: false, message: 'ID tugas tidak valid' });
        }
        let dbStatus = rawStatus;
        if (rawStatus === 'closed' || rawStatus === 'selesai') dbStatus = 'completed';
        else if (rawStatus === 'mulai' || rawStatus === 'in_progress' || rawStatus === 'start') dbStatus = 'in_progress';

        if (dbStatus === 'completed') {
            const completion_description = String(body.completion_description || '').trim();
            if (!completion_description) {
                return res.status(400).json({
                    success: false,
                    message: 'Deskripsi penyelesaian wajib diisi'
                });
            }
            const { lat: compLat, lng: compLng } = parseCompletionLatLng(body);
            const cableRaw = body.cable_length_m ?? body.install_cable_length_m;
            const cableM = parseFloat(cableRaw);
            let stickerPath = null;
            try {
                if (body.sticker_photo_base64 != null && String(body.sticker_photo_base64).trim() !== '') {
                    stickerPath = decodeAndSaveStickerPhoto(body.sticker_photo_base64);
                }
            } catch (se) {
                return res.status(400).json({ success: false, message: se.message || 'Foto stiker tidak valid' });
            }
            if (!Number.isFinite(cableM) || cableM < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Panjang kabel (meter) wajib diisi dengan angka valid'
                });
            }
            if (!stickerPath) {
                return res.status(400).json({
                    success: false,
                    message: 'Foto stiker belakang ONT wajib (kamera)'
                });
            }
            if (compLat == null || compLng == null) {
                return res.status(400).json({
                    success: false,
                    message: 'Tag lokasi wajib — ambil koordinat GPS sebelum selesai'
                });
            }

            let photoPath = null;
            if (body.completion_photo_base64 != null && String(body.completion_photo_base64).trim() !== '') {
                try {
                    photoPath = decodeAndSaveCompletionPhoto(body.completion_photo_base64);
                } catch (pe) {
                    return res.status(400).json({ success: false, message: pe.message || 'Foto tidak valid' });
                }
            }

            db.get(
                `SELECT * FROM installation_jobs WHERE id = ? AND assigned_technician_id = ?`,
                [jobId, techId],
                (gErr, job) => {
                    if (gErr) {
                        logger.error('[mobile-adapter] install complete get:', gErr);
                        return res.status(500).json({ success: false, message: gErr.message });
                    }
                    if (!job) {
                        return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan atau bukan milik Anda' });
                    }
                    const noteBlock =
                        `[Selesai — app teknisi]\n${completion_description}` +
                        `\n📏 Kabel: ${cableM} m` +
                        (photoPath ? `\n📷 ${photoPath}` : '') +
                        `\n📷 Stiker ONT: ${stickerPath}`;
                    const newNotes = job.notes ? `${job.notes}\n\n${noteBlock}` : noteBlock;
                    const wd = clampWorkDurationSeconds(body.work_duration_seconds);

                    const setCols = [
                        `status = 'completed'`,
                        `notes = ?`,
                        `updated_at = CURRENT_TIMESTAMP`,
                        `install_cable_length_m = ?`,
                        `install_ont_sticker_photo_path = ?`
                    ];
                    const uParams = [newNotes, cableM, stickerPath];
                    if (wd != null) {
                        setCols.push('work_duration_seconds = ?');
                        uParams.push(wd);
                    }
                    if (compLat != null && compLng != null) {
                        setCols.push('tech_completion_latitude = ?', 'tech_completion_longitude = ?');
                        uParams.push(compLat, compLng);
                        setCols.push('customer_latitude = ?', 'customer_longitude = ?');
                        uParams.push(compLat, compLng);
                    }
                    uParams.push(jobId, techId);
                    const updateSql = `UPDATE installation_jobs SET ${setCols.join(', ')} WHERE id = ? AND assigned_technician_id = ?`;

                    db.run(updateSql, uParams, async function (uErr) {
                            if (uErr) {
                                return res.status(500).json({ success: false, message: uErr.message });
                            }
                            if (this.changes === 0) {
                                return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan atau bukan milik Anda' });
                            }
                            // Tag lokasi penyelesaian → latitude/longitude pelanggan (resolusi id dari customer_id atau nomor HP job)
                            if (compLat != null && compLng != null) {
                                const custDbId = await resolveCustomerIdFromInstallationJob(job);
                                if (custDbId) {
                                    await updateCustomerTagLocation(custDbId, compLat, compLng);
                                    await backfillInstallationJobCustomerId(jobId, custDbId);
                                } else {
                                    logger.warn(
                                        '[mobile-adapter] PSB selesai: tidak bisa memetakan pelanggan untuk update lokasi (customer_id & phone kosong/tidak cocok)'
                                    );
                                }
                            }
                            db.run(
                                `INSERT INTO installation_job_status_history (
                                    job_id, old_status, new_status, changed_by_type, changed_by_id, notes
                                ) VALUES (?, ?, 'completed', 'technician', ?, ?)`,
                                [jobId, job.status, techId, completion_description.slice(0, 500)],
                                (histErr) => {
                                    if (histErr) {
                                        logger.warn('[mobile-adapter] install history:', histErr.message);
                                    }
                                }
                            );
                            const phone = (job.customer_phone || '').replace(/\D/g, '');
                            res.json({ success: true, message: 'Instalasi diselesaikan' });

                            // WhatsApp jangan menahan respons API (koneksi WA bisa lama / timeout).
                            if (phone) {
                                const waPhone = job.customer_phone;
                                const waName = job.customer_name;
                                const waJobNo = job.job_number || String(jobId);
                                const waDesc = completion_description;
                                const waCable = cableM;
                                const waPhotoPath = photoPath;
                                const waStickerPath = stickerPath;
                                setImmediate(() => {
                                    (async () => {
                                        try {
                                            const { sendMessage } = require('../../config/sendMessage');
                                            const header = getSetting('company_header', 'ISP');
                                            const base = (process.env.PUBLIC_APP_BASE_URL || '').trim();
                                            const photoLine =
                                                waPhotoPath && base
                                                    ? `\n📷 Dokumentasi: ${String(base).replace(/\/$/, '')}${waPhotoPath}`
                                                    : waPhotoPath
                                                      ? `\n📷 Dokumentasi tersimpan di sistem.`
                                                      : '';
                                            const stickerLine =
                                                waStickerPath && base
                                                    ? `\n📷 Stiker ONT: ${String(base).replace(/\/$/, '')}${waStickerPath}`
                                                    : waStickerPath
                                                      ? `\n📷 Stiker ONT tersimpan di sistem.`
                                                      : '';
                                            const msg =
                                                `✅ *INSTALASI SELESAI*\n\n` +
                                                `Halo ${waName || 'Pelanggan'},\n\n` +
                                                `Pemasangan untuk job *${waJobNo}* telah ditandai selesai oleh teknisi.\n\n` +
                                                `📝 *Ringkasan pekerjaan:*\n${waDesc}` +
                                                `\n📏 *Panjang kabel:* ${waCable} m` +
                                                `${photoLine}` +
                                                `${stickerLine}\n\n` +
                                                `Terima kasih atas kepercayaan Anda.\n\n_*${header}*_`;
                                            await sendMessage(waPhone, msg);
                                        } catch (waErr) {
                                            logger.warn('[mobile-adapter] WA pelanggan PSB (bg):', waErr.message || waErr);
                                        }
                                    })();
                                });
                            }
                            return;
                    });
                }
            );
            return;
        }

        if (dbStatus === 'in_progress') {
            // Pakai jam zona aplikasi (bukan SQLite CURRENT_TIMESTAMP = UTC) agar durasi di app mobile sinkron.
            const wallNow = getLocalTimestamp();
            db.run(
                `UPDATE installation_jobs SET status = ?, updated_at = ?,
                 work_started_at = COALESCE(work_started_at, ?)
                 WHERE id = ? AND assigned_technician_id = ?`,
                [dbStatus, wallNow, wallNow, jobId, techId],
                function (err) {
                    if (err) {
                        return res.status(500).json({ success: false, message: err.message });
                    }
                    if (this.changes === 0) {
                        return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan atau bukan milik Anda' });
                    }
                    res.json({ success: true, message: 'Status diperbarui' });
                }
            );
            return;
        }

        db.run(
            `UPDATE installation_jobs SET status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND assigned_technician_id = ?`,
            [dbStatus, jobId, techId],
            function (err) {
                if (err) {
                    return res.status(500).json({ success: false, message: err.message });
                }
                if (this.changes === 0) {
                    return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan atau bukan milik Anda' });
                }
                res.json({ success: true, message: 'Status diperbarui' });
            }
        );
        return;
    }

    if (type === 'TR') {
        let dbStatus = rawStatus;
        if (rawStatus === 'selesai' || rawStatus === 'closed' || rawStatus === 'completed') {
            dbStatus = 'resolved';
        } else if (rawStatus === 'mulai' || rawStatus === 'in_progress' || rawStatus === 'start') {
            dbStatus = 'in_progress';
        }

        function done(err) {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan atau bukan milik Anda' });
            }
            res.json({ success: true, message: 'Status diperbarui' });
        }

        if (dbStatus === 'in_progress') {
            const wallNow = getLocalTimestamp();
            db.run(
                `UPDATE trouble_reports SET status = ?, updated_at = ?,
                 work_started_at = COALESCE(work_started_at, ?)
                 WHERE id = ? AND (assigned_technician_id = ? OR CAST(assigned_technician_id AS TEXT) = ?)`,
                [dbStatus, wallNow, wallNow, id, techId, String(techId)],
                done
            );
            return;
        }

        if (dbStatus === 'resolved' || dbStatus === 'closed') {
            const completion_description = String(body.completion_description || '').trim();
            if (!completion_description) {
                return res.status(400).json({
                    success: false,
                    message: 'Deskripsi penyelesaian wajib diisi'
                });
            }
            let photoPath = null;
            try {
                photoPath = decodeAndSaveCompletionPhoto(body.completion_photo_base64);
            } catch (pe) {
                return res.status(400).json({ success: false, message: pe.message || 'Foto tidak valid' });
            }

            db.get(
                `SELECT id FROM trouble_reports WHERE id = ? AND (assigned_technician_id = ? OR CAST(assigned_technician_id AS TEXT) = ?)`,
                [id, techId, String(techId)],
                (qErr, row) => {
                    if (qErr) {
                        return res.status(500).json({ success: false, message: qErr.message });
                    }
                    if (!row) {
                        return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan atau bukan milik Anda' });
                    }
                    (async () => {
                        try {
                            const { updateTroubleReportStatus } = require('../../config/troubleReport');
                            let noteText = `[Penyelesaian teknisi]\n${completion_description}`;
                            if (photoPath) noteText += `\n📷 ${photoPath}`;
                            await updateTroubleReportStatus(id, 'resolved', noteText, {}, true);
                            const wd = clampWorkDurationSeconds(body.work_duration_seconds);
                            if (wd != null) {
                                await new Promise((resolve, reject) => {
                                    db.run(
                                        'UPDATE trouble_reports SET work_duration_seconds = ? WHERE id = ?',
                                        [wd, id],
                                        (e2) => (e2 ? reject(e2) : resolve())
                                    );
                                });
                            }
                            res.json({ success: true, message: 'Tiket diselesaikan' });
                        } catch (e) {
                            logger.error('[mobile-adapter] TR resolve:', e);
                            res.status(500).json({
                                success: false,
                                message: e.message || 'Gagal menyelesaikan tiket'
                            });
                        }
                    })();
                }
            );
            return;
        }

        db.run(
            `UPDATE trouble_reports SET status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND (assigned_technician_id = ? OR CAST(assigned_technician_id AS TEXT) = ?)`,
            [dbStatus, id, techId, String(techId)],
            done
        );
        return;
    }

    res.status(400).json({ success: false, message: 'Tipe tugas tidak dikenal' });
});

// --- Notifikasi tugas (admin → teknisi, in-app + badge di mobile) ---
router.get('/notifications', verifyToken, requireTechnician, (req, res) => {
    const techId = parseInt(req.user.id, 10);
    if (!Number.isFinite(techId)) {
        return res.status(400).json({ success: false, message: 'ID teknisi tidak valid' });
    }
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    db.get(
        `SELECT COUNT(*) AS c FROM technician_field_notifications
         WHERE technician_id = ? AND read_at IS NULL`,
        [techId],
        (e1, countRow) => {
            if (e1) {
                logger.error('[mobile-adapter] notifications count:', e1);
                return res.status(500).json({ success: false, message: e1.message });
            }
            const unread_count = countRow ? countRow.c : 0;
            db.all(
                `SELECT id, technician_id, kind, ref_id, title, body, read_at, created_at
                 FROM technician_field_notifications
                 WHERE technician_id = ?
                 ORDER BY datetime(created_at) DESC
                 LIMIT ?`,
                [techId, limit],
                (e2, rows) => {
                    if (e2) {
                        logger.error('[mobile-adapter] notifications list:', e2);
                        return res.status(500).json({ success: false, message: e2.message });
                    }
                    const items = (rows || []).map((r) => ({
                        id: r.id,
                        kind: r.kind,
                        ref_id: r.ref_id,
                        title: r.title,
                        body: r.body,
                        read_at: r.read_at,
                        created_at: r.created_at,
                        unread: !r.read_at
                    }));
                    res.json({ success: true, data: { items, unread_count } });
                }
            );
        }
    );
});

router.post('/notifications/:notifId/read', verifyToken, requireTechnician, (req, res) => {
    const techId = parseInt(req.user.id, 10);
    const nid = parseInt(req.params.notifId, 10);
    if (!Number.isFinite(techId) || !Number.isFinite(nid)) {
        return res.status(400).json({ success: false, message: 'Data tidak valid' });
    }
    db.run(
        `UPDATE technician_field_notifications SET read_at = datetime('now')
         WHERE id = ? AND technician_id = ?`,
        [nid, techId],
        function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ success: false, message: 'Notifikasi tidak ditemukan' });
            }
            res.json({ success: true, message: 'Ditandai dibaca' });
        }
    );
});

router.post('/notifications/read-all', verifyToken, requireTechnician, (req, res) => {
    const techId = parseInt(req.user.id, 10);
    if (!Number.isFinite(techId)) {
        return res.status(400).json({ success: false, message: 'ID teknisi tidak valid' });
    }
    db.run(
        `UPDATE technician_field_notifications SET read_at = datetime('now')
         WHERE technician_id = ? AND read_at IS NULL`,
        [techId],
        function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            res.json({ success: true, message: 'Semua ditandai dibaca', updated: this.changes });
        }
    );
});

// --- ODP / jaringan ---
router.get('/odps', verifyToken, requireTechnician, (req, res) => {
    db.all(
        `SELECT id, name, code, latitude, longitude, status, capacity, used_ports, address, parent_odp_id
         FROM odps
         WHERE latitude IS NOT NULL AND longitude IS NOT NULL
         ORDER BY name`,
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            const data = (rows || []).map((r) => ({
                ...r,
                latitude: parseFloat(r.latitude),
                longitude: parseFloat(r.longitude)
            }));
            res.json({ success: true, data });
        }
    );
});

router.get('/odps/:odpId', verifyToken, requireTechnician, (req, res) => {
    const odpId = req.params.odpId;
    db.get(
        `SELECT o.*,
                COUNT(CASE WHEN cr.customer_id IS NOT NULL THEN cr.id END) AS connected_customers
         FROM odps o
         LEFT JOIN cable_routes cr ON o.id = cr.odp_id
         WHERE o.id = ? OR o.code = ?
         GROUP BY o.id`,
        [odpId, odpId],
        (err, odp) => {
            if (err || !odp) {
                return res.status(err ? 500 : 404).json({
                    success: false,
                    message: err ? err.message : 'ODP tidak ditemukan'
                });
            }
            db.all(
                `SELECT cr.*, c.name AS customer_name, c.phone AS customer_phone, c.id AS customer_id
                 FROM cable_routes cr
                 JOIN customers c ON cr.customer_id = c.id
                 WHERE cr.odp_id = ?
                 ORDER BY cr.port_number, c.name`,
                [odp.id],
                (e2, routes) => {
                    if (e2) {
                        return res.status(500).json({ success: false, message: e2.message });
                    }
                    const customers = (routes || []).map((cr) => ({
                        id: cr.customer_id,
                        name: cr.customer_name,
                        phone: cr.customer_phone,
                        port_number: cr.port_number,
                        status: cr.status
                    }));
                    res.json({
                        success: true,
                        data: {
                            odp,
                            customers
                        }
                    });
                }
            );
        }
    );
});

router.put('/odps/:odpId/capacity', verifyToken, requireTechnician, (req, res) => {
    const odpParam = String(req.params.odpId || '').trim();
    const cap = parseInt((req.body || {}).capacity, 10);
    if (!Number.isFinite(cap) || cap < 1) {
        return res.status(400).json({ success: false, message: 'Kapasitas tidak valid' });
    }
    db.get(
        'SELECT id FROM odps WHERE id = ? OR code = ? OR name = ? LIMIT 1',
        [odpParam, odpParam, odpParam],
        (err, row) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            if (!row) {
                return res.status(404).json({ success: false, message: 'ODP tidak ditemukan' });
            }
            db.run(
                'UPDATE odps SET capacity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [cap, row.id],
                function (e2) {
                    if (e2) {
                        return res.status(500).json({ success: false, message: e2.message });
                    }
                    if (this.changes === 0) {
                        return res.status(404).json({ success: false, message: 'ODP tidak ditemukan' });
                    }
                    res.json({ success: true, message: 'Kapasitas diperbarui' });
                }
            );
        }
    );
});

router.put('/odps/:code/location', verifyToken, requireTechnician, (req, res) => {
    const code = req.params.code;
    const { latitude, longitude, capacity, notes } = req.body || {};
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ success: false, message: 'Koordinat tidak valid' });
    }
    const cap = capacity != null ? parseInt(capacity, 10) : null;

    db.get('SELECT id FROM odps WHERE code = ?', [code], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        if (row) {
            const sets = ['latitude = ?', 'longitude = ?', 'updated_at = CURRENT_TIMESTAMP'];
            const vals = [lat, lng];
            if (Number.isFinite(cap) && cap > 0) {
                sets.push('capacity = ?');
                vals.push(cap);
            }
            if (notes != null) {
                sets.push('notes = ?');
                vals.push(String(notes));
            }
            vals.push(row.id);
            db.run(`UPDATE odps SET ${sets.join(', ')} WHERE id = ?`, vals, function (e2) {
                if (e2) {
                    return res.status(500).json({ success: false, message: e2.message });
                }
                return res.json({ success: true, message: 'Lokasi ODP diperbarui' });
            });
            return;
        }
        db.run(
            `INSERT INTO odps (name, code, latitude, longitude, capacity, status, notes)
             VALUES (?, ?, ?, ?, ?, 'active', ?)`,
            [code, code, lat, lng, Number.isFinite(cap) && cap > 0 ? cap : 8, notes != null ? String(notes) : ''],
            function (e3) {
                if (e3) {
                    return res.status(500).json({ success: false, message: e3.message });
                }
                res.json({ success: true, message: 'ODP baru dibuat dengan lokasi' });
            }
        );
    });
});

function pickCustomerLookupRaw(body) {
    const b = body || {};
    const v = b.customer_db_id ?? b.customerDbId ?? b.customer_id ?? b.id;
    if (v === undefined || v === null) return '';
    if (typeof v === 'string' && v.trim() === '') return '';
    return v;
}

router.post('/odps/:odpId/assign', verifyToken, requireTechnician, (req, res) => {
    const odpParam = String(req.params.odpId || '').trim();
    const body = req.body || {};
    const { port_number, cable_length, cable_type, notes } = body;
    const port = parseInt(port_number, 10);
    const rawCustomer = pickCustomerLookupRaw(body);

    if (!odpParam) {
        return res.status(400).json({ success: false, message: 'ODP tidak valid' });
    }
    if (!Number.isFinite(port) || port < 1) {
        return res.status(400).json({ success: false, message: 'Nomor port tidak valid' });
    }
    if (rawCustomer === undefined || rawCustomer === null || String(rawCustomer).trim() === '') {
        return res.status(400).json({ success: false, message: 'Pelanggan wajib dipilih' });
    }

    db.get(
        `SELECT id, latitude, longitude FROM odps WHERE id = ? OR code = ? OR name = ? LIMIT 1`,
        [odpParam, odpParam, odpParam],
        (errOdp, odpRow) => {
            if (errOdp) {
                return res.status(500).json({ success: false, message: errOdp.message });
            }
            if (!odpRow) {
                return res.status(404).json({ success: false, message: 'ODP tidak ditemukan' });
            }
            const odpIntId = odpRow.id;

            const resolveCustomerPk = (cb) => {
                let s = String(rawCustomer).trim();
                const dotZero = /^(-?\d+)\.0+$/.exec(s);
                if (dotZero) s = dotZero[1];

                const tryByPrimaryKey = (cb2) => {
                    let idInt = null;
                    if (typeof rawCustomer === 'number' && Number.isFinite(rawCustomer) && Math.floor(rawCustomer) === rawCustomer) {
                        idInt = Math.floor(rawCustomer);
                    } else if (/^-?\d+$/.test(s)) {
                        idInt = parseInt(s, 10);
                    }
                    if (idInt == null || !Number.isFinite(idInt) || idInt < 1) {
                        return process.nextTick(() => cb2(null, null));
                    }
                    db.get('SELECT id FROM customers WHERE id = ?', [idInt], (e0, rowById) => {
                        if (e0) return cb2(e0);
                        return cb2(null, rowById);
                    });
                };

                tryByPrimaryKey((e0, rowById) => {
                    if (e0) return cb(e0);
                    if (rowById) return cb(null, rowById);
                    db.get(
                        `SELECT id FROM customers
                         WHERE LOWER(TRIM(COALESCE(CAST(customer_id AS TEXT), ''))) = LOWER(TRIM(?))
                            OR CAST(id AS TEXT) = ?
                            OR phone = ?
                            OR REPLACE(REPLACE(phone, ' ', ''), '-', '') = REPLACE(REPLACE(?, ' ', ''), '-', '')
                            OR username = ?
                            OR pppoe_username = ?
                         LIMIT 1`,
                        [s, s, s, s, s, s],
                        cb
                    );
                });
            };

            resolveCustomerPk((errC, custRow) => {
                if (errC) {
                    return res.status(500).json({ success: false, message: errC.message });
                }
                if (!custRow) {
                    return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
                }
                const custIntId = custRow.id;

                db.get('SELECT id FROM cable_routes WHERE customer_id = ?', [custIntId], (err, existing) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: err.message });
                    }
                    if (existing) {
                        return res.status(400).json({ success: false, message: 'Pelanggan sudah punya jalur kabel' });
                    }

                    const notesVal = notes != null ? String(notes) : '';
                    const typeVal = (cable_type && String(cable_type).trim()) || 'Fiber Optic';

                    const runInsert = (lengthMeters) => {
                        db.run(
                            `INSERT INTO cable_routes (customer_id, odp_id, cable_length, cable_type, port_number, status, notes)
                             VALUES (?, ?, ?, ?, ?, 'connected', ?)`,
                            [custIntId, odpIntId, lengthMeters, typeVal, port, notesVal],
                            function (e2) {
                                if (e2) {
                                    return res.status(500).json({ success: false, message: e2.message });
                                }
                                db.run(
                                    'UPDATE odps SET used_ports = (SELECT COUNT(*) FROM cable_routes WHERE odp_id = ? AND status = "connected"), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                                    [odpIntId, odpIntId],
                                    () => res.json({ success: true, message: 'Jalur kabel / port berhasil dipasangkan' })
                                );
                            }
                        );
                    };

                    if (cable_length != null && String(cable_length).trim() !== '') {
                        const len = parseFloat(cable_length);
                        return runInsert(Number.isFinite(len) ? len : 0);
                    }

                    db.get(
                        'SELECT latitude, longitude FROM customers WHERE id = ?',
                        [custIntId],
                        (e3, customer) => {
                            if (e3) {
                                return res.status(500).json({ success: false, message: e3.message });
                            }
                            let len = 0;
                            if (
                                customer &&
                                odpRow &&
                                customer.latitude != null &&
                                customer.longitude != null &&
                                odpRow.latitude != null &&
                                odpRow.longitude != null
                            ) {
                                len = CableNetworkUtils.calculateCableDistance(
                                    { latitude: customer.latitude, longitude: customer.longitude },
                                    { latitude: odpRow.latitude, longitude: odpRow.longitude }
                                );
                            }
                            runInsert(len);
                        }
                    );
                });
            });
        }
    );
});

// --- Tagihan (placeholder aman) ---
router.get('/invoices', verifyToken, allowFieldOps, (req, res) => {
    res.json({ success: true, data: [] });
});

// --- Aksi: restart koneksi (placeholder — bisa dihubungkan ke Mikrotik nanti) ---
router.post('/action/restart', verifyToken, requireTechnician, (req, res) => {
    res.json({ success: true, message: 'Permintaan restart dicatat (otomatisasi server dapat ditambahkan)' });
});

module.exports = router;
