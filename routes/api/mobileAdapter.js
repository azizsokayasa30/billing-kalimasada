/**
 * Mobile app (Flutter) — adapter API untuk teknisi/kolektor.
 * Auth: JWT sama seperti /api/auth/login (Bearer).
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { verifyToken, normalizePhone } = require('./auth');
const logger = require('../../config/logger');
const { getSetting, getLocalTimestamp } = require('../../config/settingsManager');
require('../../config/technicianFieldNotifications');
require('../../config/collectorFieldNotifications');

const dbPath = path.join(__dirname, '../../data/billing.db');
const db = new sqlite3.Database(dbPath);
const CableNetworkUtils = require('../../utils/cableNetworkUtils');
const billingManager = require('../../config/billing');
const { submitCollectorPayment, collectorPaymentMulter } = require('../../utils/collectorPaymentSubmit');

function requireCollector(req, res, next) {
    if (!req.user || String(req.user.role) !== 'collector') {
        return res.status(403).json({ success: false, message: 'Hanya kolektor' });
    }
    next();
}

function parseCollectorId(req) {
    const u = req.user || {};
    const raw = u.id != null && u.id !== '' ? u.id : u.sub != null && u.sub !== '' ? u.sub : u.user_id;
    const id = parseInt(String(raw), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
}

function collectorCustomerIsIsolir(c) {
    return String(c.status || '')
        .toLowerCase()
        .trim() === 'suspended';
}

/**
 * Sama dengan filter "Belum Lunas" di admin getCustomersPaginated (mode default, tanpa filter bulan):
 * ada invoice unpaid ATAU belum pernah ada invoice paid.
 */
function matchesAdminBelumLunasFromPaymentStatus(c) {
    const ps = c.payment_status || '';
    return ps === 'unpaid' || ps === 'overdue' || ps === 'no_invoice';
}

/** Sama dengan filter "Lunas" di admin: tidak ada unpaid & pernah paid (direfleksikan di CASE SQL sebagai 'paid'). */
function matchesAdminLunasFromPaymentStatus(c) {
    return (c.payment_status || '') === 'paid';
}

/** Join date jatuh di bulan kalender berjalan (sesuai filter "baru" admin / pelanggan baru bulan ini). */
function joinDateThisCalendarMonth(c) {
    if (!c.join_date) return false;
    const jd = String(c.join_date).slice(0, 10);
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    const pad = (n) => String(n).padStart(2, '0');
    const startStr = `${y}-${pad(mo + 1)}-01`;
    const lastD = new Date(y, mo + 1, 0).getDate();
    const endStr = `${y}-${pad(mo + 1)}-${pad(lastD)}`;
    return jd >= startStr && jd <= endStr;
}

/**
 * Filter daftar kolektor: pool = area + assignment kolektor (getCollectorCustomers).
 * Semua = seluruh pelanggan di pool (seperti admin /customers, dibatasi area tim).
 * unpaid = Belum Lunas admin; paid = Lunas admin; baru = join_date bulan ini.
 */
function filterCollectorCustomersForMobile(allMappedCustomers, statusFilter, q) {
    const validFilters = new Set(['paid', 'unpaid', 'overdue', 'no_invoice', 'isolir', 'baru']);
    const sf = (statusFilter || '').toString().toLowerCase();
    const qLower = (q || '').toString().trim().toLowerCase();
    let customers = allMappedCustomers || [];

    if (sf === 'isolir') {
        customers = customers.filter((c) => collectorCustomerIsIsolir(c));
    } else if (sf === 'baru') {
        customers = customers.filter((c) => joinDateThisCalendarMonth(c));
    } else if (sf === 'unpaid') {
        customers = customers.filter((c) => matchesAdminBelumLunasFromPaymentStatus(c));
    } else if (sf === 'paid') {
        customers = customers.filter((c) => matchesAdminLunasFromPaymentStatus(c));
    } else if (validFilters.has(sf) && sf !== '') {
        customers = customers.filter((c) => (c.payment_status || '') === sf);
    }
    // sf === '' (Semua): tidak filter status / pembayaran

    if (qLower) {
        customers = customers.filter((c) => {
            const name = (c.name || '').toLowerCase();
            const idStr = String(c.id || '');
            const phone = (c.phone || '').toLowerCase();
            const ppp = (c.pppoe_username || '').toString().toLowerCase();
            const user = (c.username || '').toString().toLowerCase();
            return (
                name.includes(qLower) ||
                idStr.includes(qLower) ||
                phone.includes(qLower) ||
                ppp.includes(qLower) ||
                user.includes(qLower)
            );
        });
    }
    return customers;
}

/** Angka aman untuk JSON (hindari BigInt / nilai aneh dari SQLite). */
function toFiniteNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

/** Statistik dashboard kolektor — hanya angka, aman untuk res.json. */
function sanitizeCollectorDashboardStats(stats) {
    if (!stats || typeof stats !== 'object') {
        return {
            tagihan: { count: 0, total: 0 },
            tagihanLunas: { count: 0, total: 0 },
            lunas: { count: 0, total: 0 },
            belumLunas: { count: 0, total: 0 },
            hariIni: { count: 0, total: 0 },
            setoran: { sudah_setor: 0, belum_setor: 0 }
        };
    }
    const pair = (k) => ({
        count: toFiniteNumber(stats[k] && stats[k].count),
        total: toFiniteNumber(stats[k] && stats[k].total)
    });
    return {
        tagihan: pair('tagihan'),
        tagihanLunas: pair('tagihanLunas'),
        lunas: pair('lunas'),
        belumLunas: pair('belumLunas'),
        hariIni: pair('hariIni'),
        setoran: {
            sudah_setor: toFiniteNumber(stats.setoran && stats.setoran.sudah_setor),
            belum_setor: toFiniteNumber(stats.setoran && stats.setoran.belum_setor)
        }
    };
}

/** Baris kolektor untuk API publik (tanpa password). */
function sanitizeCollectorRow(row) {
    if (!row || typeof row !== 'object') return null;
    const out = { ...row };
    if (out.password !== undefined) delete out.password;
    if (out.password_hash !== undefined) delete out.password_hash;
    return out;
}

/** Satu baris pembayaran kolektor — BigInt → number. */
function sanitizeCollectorPaymentRow(p) {
    if (!p || typeof p !== 'object') return p;
    const out = {};
    for (const k of Object.keys(p)) {
        let v = p[k];
        if (typeof v === 'bigint') v = Number(v);
        out[k] = v;
    }
    return out;
}

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
db.run('ALTER TABLE trouble_reports ADD COLUMN customer_id INTEGER', (err) => {
    if (err && !/duplicate column/i.test(String(err.message))) {
        logger.warn('[mobile-adapter] trouble_reports.customer_id:', err.message);
    }
    if (!err || /duplicate column/i.test(String(err.message))) {
        // Tiket lama: isi customer_id dari nama pelanggan yang sama (bantu app Gangguan / dashboard).
        db.run(
            `UPDATE trouble_reports SET customer_id = (
                SELECT c.id FROM customers c
                WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(trouble_reports.name))
                  AND LENGTH(TRIM(trouble_reports.name)) >= 3
                ORDER BY c.id DESC LIMIT 1
            )
            WHERE (customer_id IS NULL OR customer_id = 0)
              AND name IS NOT NULL AND TRIM(name) != ''`,
            (e2) => {
                if (e2 && !/no such column/i.test(String(e2.message))) {
                    logger.warn('[mobile-adapter] trouble_reports customer_id backfill (name):', e2.message);
                }
            }
        );
    }
});

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

function phoneVariantsForEmployeeLookup(rawPhone) {
    const norm = normalizePhone(rawPhone || '');
    const v = new Set();
    const raw = rawPhone != null ? String(rawPhone).trim() : '';
    if (raw) v.add(raw);
    if (norm) {
        v.add(norm);
        v.add(`+${norm}`);
        if (norm.startsWith('62') && norm.length > 2) {
            v.add(`0${norm.slice(2)}`);
        }
    }
    return [...v].filter(Boolean);
}

function jakartaAttendanceTodayYmd() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
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

/** Kondisi SQL: baris customers (alias cu) ↔ trouble_reports (alias tr) adalah pelanggan yang sama. */
function sqlTroubleTicketCustomerMatch(cu, tr) {
    const digits = (expr) =>
        `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(${expr}, ''), ' ', ''), '-', ''), '+', ''), '(', ''), ')', '')`;
    return `(
        (NULLIF(${tr}.customer_id, 0) IS NOT NULL AND CAST(${cu}.id AS INTEGER) = CAST(${tr}.customer_id AS INTEGER))
        OR (
            NULLIF(TRIM(IFNULL(${cu}.phone, '')), '') IS NOT NULL
            AND NULLIF(TRIM(IFNULL(${tr}.phone, '')), '') IS NOT NULL
            AND LOWER(TRIM(IFNULL(${cu}.phone, ''))) = LOWER(TRIM(IFNULL(${tr}.phone, '')))
        )
        OR (
            NULLIF(TRIM(IFNULL(${cu}.phone, '')), '') IS NOT NULL
            AND NULLIF(TRIM(IFNULL(${tr}.phone, '')), '') IS NOT NULL
            AND REPLACE(REPLACE(REPLACE(LOWER(TRIM(IFNULL(${cu}.phone, ''))), ' ', ''), '-', ''), '+', '') =
                REPLACE(REPLACE(REPLACE(LOWER(TRIM(IFNULL(${tr}.phone, ''))), ' ', ''), '-', ''), '+', '')
        )
        OR (
            LENGTH(${digits(`${cu}.phone`)}) >= 10
            AND LENGTH(${digits(`${tr}.phone`)}) >= 10
            AND SUBSTR(${digits(`${cu}.phone`)}, -10) = SUBSTR(${digits(`${tr}.phone`)}, -10)
        )
        OR (
            LENGTH(TRIM(IFNULL(${tr}.name, ''))) >= 3
            AND LENGTH(TRIM(IFNULL(${cu}.name, ''))) >= 3
            AND LOWER(TRIM(IFNULL(${cu}.name, ''))) = LOWER(TRIM(IFNULL(${tr}.name, '')))
        )
    )`;
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
        const role = req.user && req.user.role;
        const techId = role === 'technician' ? parseInt(req.user.id, 10) : NaN;
        const isGangguanFilter = status.toLowerCase() === 'isolated';
        if (isGangguanFilter && role === 'technician' && Number.isFinite(techId)) {
            // App "Gangguan" = status isolated + pelanggan yang punya tiket gangguan aktif ditugaskan ke teknisi ini
            const trMatch = sqlTroubleTicketCustomerMatch('cu', 'tr');
            where += ` AND (
                LOWER(c.status) = LOWER(?)
                OR c.id IN (
                    SELECT cu.id FROM customers cu
                    INNER JOIN trouble_reports tr ON ${trMatch}
                    WHERE (tr.assigned_technician_id = ? OR CAST(tr.assigned_technician_id AS TEXT) = ?)
                      AND LOWER(IFNULL(tr.status, '')) NOT IN ('closed', 'resolved')
                )
            )`;
            params.push(status, techId, String(techId));
        } else {
            where += ' AND LOWER(c.status) = LOWER(?)';
            params.push(status);
        }
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

// --- Absensi teknisi (employees.no_hp = nomor login JWT) ---
router.get('/attendance/status', verifyToken, requireTechnician, (req, res) => {
    const variants = phoneVariantsForEmployeeLookup(req.user.phone || req.user.username || '');
    if (!variants.length) {
        return res.json({ success: true, data: null, employee_matched: false });
    }
    const ph = variants.map(() => '?').join(',');
    db.get(
        `SELECT id FROM employees WHERE (status IS NULL OR LOWER(TRIM(status)) = 'aktif') AND TRIM(no_hp) IN (${ph}) LIMIT 1`,
        variants,
        (empErr, empRow) => {
            if (empErr) {
                logger.error('[mobile-adapter] attendance/status employee', empErr);
                return res.status(500).json({ success: false, message: empErr.message });
            }
            const eid = empRow && empRow.id != null ? parseInt(empRow.id, 10) : NaN;
            if (!Number.isFinite(eid) || eid <= 0) {
                return res.json({ success: true, data: null, employee_matched: false });
            }
            const today = jakartaAttendanceTodayYmd();
            db.get(
                'SELECT id, date, check_in, check_out, status, notes FROM employee_attendance WHERE employee_id = ? AND date = ?',
                [eid, today],
                (aErr, row) => {
                    if (aErr) {
                        logger.error('[mobile-adapter] attendance/status', aErr);
                        return res.status(500).json({ success: false, message: aErr.message });
                    }
                    if (!row) {
                        return res.json({ success: true, data: null, employee_matched: true, date: today });
                    }
                    res.json({
                        success: true,
                        employee_matched: true,
                        date: row.date,
                        data: {
                            check_in: row.check_in,
                            check_out: row.check_out,
                            status: row.status,
                            notes: row.notes
                        }
                    });
                }
            );
        }
    );
});

router.post('/attendance', verifyToken, requireTechnician, (req, res) => {
    const body = req.body || {};
    const type = String(body.type || '').toLowerCase();
    if (!['check_in', 'check_out'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Tipe tidak valid' });
    }
    const lat = body.location && body.location.latitude != null ? Number(body.location.latitude) : NaN;
    const lng = body.location && body.location.longitude != null ? Number(body.location.longitude) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ success: false, message: 'Koordinat lokasi wajib' });
    }
    const mode = String(body.check_in_mode || '').toLowerCase();
    const qrValue = body.qr_value != null ? String(body.qr_value).trim() : '';
    const photoB64 = body.photo_base64 != null ? String(body.photo_base64).trim() : '';

    if (type === 'check_in') {
        if (mode !== 'selfie' && mode !== 'qr') {
            return res.status(400).json({ success: false, message: 'Mode absensi wajib: selfie atau qr' });
        }
        if (mode === 'selfie' && !photoB64) {
            return res.status(400).json({ success: false, message: 'Foto selfie wajib' });
        }
        if (mode === 'qr' && !qrValue) {
            return res.status(400).json({ success: false, message: 'Data QR wajib' });
        }
    }

    const variants = phoneVariantsForEmployeeLookup(req.user.phone || req.user.username || '');
    if (!variants.length) {
        return res.status(400).json({
            success: false,
            message: 'Nomor HP teknisi tidak cocok dengan data karyawan (employees.no_hp). Hubungi admin.'
        });
    }
    const ph = variants.map(() => '?').join(',');
    db.get(
        `SELECT id FROM employees WHERE (status IS NULL OR LOWER(TRIM(status)) = 'aktif') AND TRIM(no_hp) IN (${ph}) LIMIT 1`,
        variants,
        (empErr, empRow) => {
            if (empErr) {
                logger.error('[mobile-adapter] attendance employee', empErr);
                return res.status(500).json({ success: false, message: empErr.message });
            }
            const eid = empRow && empRow.id != null ? parseInt(empRow.id, 10) : NaN;
            if (!Number.isFinite(eid) || eid <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Karyawan tidak ditemukan. Pastikan no_hp di data karyawan sama dengan nomor login teknisi.'
                });
            }
            const today = jakartaAttendanceTodayYmd();
            const ts = getLocalTimestamp();
            const noteBase = `[MOBILE] ${type} lat:${lat.toFixed(5)} lng:${lng.toFixed(5)}`;
            logger.info('[mobile-adapter] attendance request', {
                type,
                employee_id: eid,
                date: today,
                mode: type === 'check_in' ? mode : null,
                photo_len: photoB64.length,
                qr_len: qrValue.length
            });

            db.get(
                'SELECT id, check_in, check_out, notes FROM employee_attendance WHERE employee_id = ? AND date = ?',
                [eid, today],
                (rowErr, row) => {
                    if (rowErr) {
                        logger.error('[mobile-adapter] attendance row', rowErr);
                        return res.status(500).json({ success: false, message: rowErr.message });
                    }

                    if (type === 'check_in') {
                        if (row && row.check_in) {
                            return res.status(400).json({ success: false, message: 'Sudah masuk hari ini' });
                        }
                        const extra =
                            mode === 'qr'
                                ? ` | qr:${qrValue.slice(0, 240)}`
                                : ` | selfie_bytes:${photoB64 ? photoB64.length : 0}`;
                        const notes = `${noteBase}${extra}`;
                        if (row && row.id) {
                            return db.run(
                                `UPDATE employee_attendance SET status = 'hadir', check_in = ?, check_out = NULL, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                                [ts, notes, row.id],
                                function (upErr) {
                                    if (upErr) {
                                        logger.error('[mobile-adapter] attendance check_in update', upErr);
                                        return res.status(500).json({ success: false, message: upErr.message });
                                    }
                                    logger.info('[mobile-adapter] attendance check_in ok', { attendance_id: row.id });
                                    return res.json({ success: true, message: 'Masuk berhasil', check_in: ts });
                                }
                            );
                        }
                        return db.run(
                            `INSERT INTO employee_attendance (employee_id, date, status, check_in, check_out, notes) VALUES (?, ?, 'hadir', ?, NULL, ?)`,
                            [eid, today, ts, notes],
                            function (insErr) {
                                if (insErr) {
                                    logger.error('[mobile-adapter] attendance check_in insert', insErr);
                                    return res.status(500).json({ success: false, message: insErr.message });
                                }
                                logger.info('[mobile-adapter] attendance check_in ok', { attendance_id: this.lastID });
                                return res.json({ success: true, message: 'Masuk berhasil', check_in: ts });
                            }
                        );
                    }

                    if (!row || !row.check_in) {
                        return res.status(400).json({ success: false, message: 'Belum masuk hari ini' });
                    }
                    if (row.check_out) {
                        return res.status(400).json({ success: false, message: 'Sudah pulang hari ini' });
                    }
                    const outNotes = row.notes ? `${row.notes} | ${noteBase}` : noteBase;
                    return db.run(
                        `UPDATE employee_attendance SET check_out = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                        [ts, outNotes, row.id],
                        function (coErr) {
                            if (coErr) {
                                logger.error('[mobile-adapter] attendance check_out', coErr);
                                return res.status(500).json({ success: false, message: coErr.message });
                            }
                            logger.info('[mobile-adapter] attendance check_out ok', { attendance_id: row.id });
                            return res.json({ success: true, message: 'Pulang berhasil', check_out: ts });
                        }
                    );
                }
            );
        }
    );
});

/** Izin/cuti dari app teknisi → `employee_leave_requests` (pending), tampil di admin /employees/leave-requests */
router.post('/leave-request', verifyToken, requireTechnician, (req, res) => {
    const body = req.body || {};
    const requestType = String(body.request_type || '').toLowerCase() === 'cuti' ? 'cuti' : 'izin';
    const startDate = body.start_date != null ? String(body.start_date).trim().slice(0, 10) : '';
    const endDate = body.end_date != null ? String(body.end_date).trim().slice(0, 10) : '';
    const reason = body.reason != null ? String(body.reason).trim() : '';

    const ymd = /^\d{4}-\d{2}-\d{2}$/;
    if (!ymd.test(startDate) || !ymd.test(endDate)) {
        return res.status(400).json({ success: false, message: 'Format tanggal wajib YYYY-MM-DD' });
    }
    if (!reason) {
        return res.status(400).json({ success: false, message: 'Alasan wajib diisi' });
    }
    const t0 = new Date(`${startDate}T00:00:00`);
    const t1 = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(t0.getTime()) || Number.isNaN(t1.getTime()) || t1 < t0) {
        return res.status(400).json({ success: false, message: 'Rentang tanggal tidak valid' });
    }

    const variants = phoneVariantsForEmployeeLookup(req.user.phone || req.user.username || '');
    if (!variants.length) {
        return res.status(400).json({
            success: false,
            message: 'Nomor HP login tidak cocok dengan data karyawan (employees.no_hp). Hubungi admin.'
        });
    }
    const requestedBy = [req.user.phone, req.user.username].filter(Boolean).join(' / ') || 'mobile';
    const ph = variants.map(() => '?').join(',');
    db.get(
        `SELECT id FROM employees WHERE (status IS NULL OR LOWER(TRIM(status)) = 'aktif') AND TRIM(no_hp) IN (${ph}) LIMIT 1`,
        variants,
        (empErr, empRow) => {
            if (empErr) {
                logger.error('[mobile-adapter] leave-request employee', empErr);
                return res.status(500).json({ success: false, message: empErr.message });
            }
            const eid = empRow && empRow.id != null ? parseInt(empRow.id, 10) : NaN;
            if (!Number.isFinite(eid) || eid <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Karyawan tidak ditemukan. Pastikan no_hp di data karyawan sama dengan nomor login teknisi.'
                });
            }
            const query = `
                INSERT INTO employee_leave_requests (employee_id, request_type, start_date, end_date, reason, requested_by, status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
            `;
            db.run(
                query,
                [eid, requestType, startDate, endDate, reason, requestedBy],
                function (insErr) {
                    if (insErr) {
                        logger.error('[mobile-adapter] leave-request insert', insErr);
                        return res.status(500).json({ success: false, message: insErr.message });
                    }
                    logger.info('[mobile-adapter] leave-request ok', {
                        id: this.lastID,
                        employee_id: eid,
                        request_type: requestType,
                        start_date: startDate,
                        end_date: endDate
                    });
                    return res.json({
                        success: true,
                        id: this.lastID,
                        message: 'Permintaan izin/cuti dikirim. Menunggu persetujuan admin.'
                    });
                }
            );
        }
    );
});

/** Riwayat izin/cuti yang sudah diproses admin (30 hari) — tampil di halaman absensi mobile */
router.get('/leave-requests/recent', verifyToken, requireTechnician, (req, res) => {
    const variants = phoneVariantsForEmployeeLookup(req.user.phone || req.user.username || '');
    if (!variants.length) {
        return res.json({ success: true, data: [], employee_matched: false });
    }
    const ph = variants.map(() => '?').join(',');
    db.get(
        `SELECT id FROM employees WHERE (status IS NULL OR LOWER(TRIM(status)) = 'aktif') AND TRIM(no_hp) IN (${ph}) LIMIT 1`,
        variants,
        (empErr, empRow) => {
            if (empErr) {
                logger.error('[mobile-adapter] leave-requests/recent employee', empErr);
                return res.status(500).json({ success: false, message: empErr.message });
            }
            const eid = empRow && empRow.id != null ? parseInt(empRow.id, 10) : NaN;
            if (!Number.isFinite(eid) || eid <= 0) {
                return res.json({ success: true, data: [], employee_matched: false });
            }
            db.all(
                `SELECT id, request_type, start_date, end_date, reason, status, approved_at, approval_notes, created_at
                 FROM employee_leave_requests
                 WHERE employee_id = ?
                   AND status IN ('approved', 'rejected')
                   AND datetime(COALESCE(approved_at, updated_at, created_at)) >= datetime('now', '-30 days')
                 ORDER BY datetime(COALESCE(approved_at, updated_at)) DESC
                 LIMIT 50`,
                [eid],
                (qErr, rows) => {
                    if (qErr) {
                        logger.error('[mobile-adapter] leave-requests/recent', qErr);
                        return res.status(500).json({ success: false, message: qErr.message });
                    }
                    res.json({ success: true, employee_matched: true, data: rows || [] });
                }
            );
        }
    );
});

// --- Dashboard stats ---
router.get('/dashboard', verifyToken, allowFieldOps, (req, res) => {
    const baseSql = `SELECT
            COUNT(*) AS total_customers,
            SUM(CASE WHEN LOWER(status) = 'active' THEN 1 ELSE 0 END) AS active_customers,
            SUM(CASE WHEN LOWER(status) = 'suspended' THEN 1 ELSE 0 END) AS suspended_customers,
            SUM(CASE WHEN LOWER(status) IN ('inactive','register') THEN 1 ELSE 0 END) AS isolated_customers
         FROM customers`;

    const sendStats = (row, isolatedOverride) => {
        res.json({
            success: true,
            data: {
                stats: {
                    total_customers: row.total_customers || 0,
                    active_customers: row.active_customers || 0,
                    suspended_customers: row.suspended_customers || 0,
                    isolated_customers:
                        isolatedOverride != null ? isolatedOverride : row.isolated_customers || 0
                }
            }
        });
    };

    db.get(baseSql, [], (err, row) => {
        if (err) {
            logger.error('[mobile-adapter] dashboard:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
        const role = req.user && req.user.role;
        const techId = role === 'technician' ? parseInt(req.user.id, 10) : NaN;
        if (role === 'technician' && Number.isFinite(techId)) {
            const trMatch = sqlTroubleTicketCustomerMatch('cu', 'tr');
            const gangSql = `SELECT COUNT(DISTINCT id) AS n FROM (
                SELECT c.id FROM customers c WHERE LOWER(c.status) = 'isolated'
                UNION
                SELECT cu.id FROM customers cu
                INNER JOIN trouble_reports tr ON ${trMatch}
                WHERE (tr.assigned_technician_id = ? OR CAST(tr.assigned_technician_id AS TEXT) = ?)
                  AND LOWER(IFNULL(tr.status, '')) NOT IN ('closed', 'resolved')
            )`;
            db.get(gangSql, [techId, String(techId)], (err2, gRow) => {
                if (err2) {
                    logger.error('[mobile-adapter] dashboard gangguan:', err2);
                    return sendStats(row, null);
                }
                sendStats(row, gRow && gRow.n != null ? gRow.n : 0);
            });
            return;
        }
        sendStats(row, null);
    });
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
                        customer_id: (() => {
                            const c = row.customer_id != null ? parseInt(row.customer_id, 10) : NaN;
                            return Number.isFinite(c) && c > 0 ? c : null;
                        })(),
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

/** Zona waktu untuk rentang "minggu ini" (Sen–Min) di kartu performa teknisi. */
const PERF_WEEK_TZ = 'Asia/Jakarta';
const PERF_WEEKDAY_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function jakartaYmdFromInstant(inst) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: PERF_WEEK_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(inst);
}

function jakartaWeekdayMon0(inst) {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: PERF_WEEK_TZ, weekday: 'short' }).format(inst);
    const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    return map[wd] ?? 0;
}

function jakartaAddDaysFromInstant(inst, deltaDays) {
    return new Date(inst.getTime() + deltaDays * 86400000);
}

function attendanceDayScore(row) {
    if (!row) return 0;
    const st = String(row.status || '')
        .toLowerCase()
        .trim();
    if (st === 'izin' || st === 'sakit') return 100;
    if (st === 'alpha') return 0;
    const hasIn = row.check_in != null && String(row.check_in).trim() !== '';
    const hasOut = row.check_out != null && String(row.check_out).trim() !== '';
    if (hasOut) return 100;
    if (hasIn) return 70;
    return 0;
}

/** Sen–Min kalender minggu berjalan (Asia/Jakarta), + agregat tugas selesai & skor absensi per hari. */
router.get('/performance/week', verifyToken, requireTechnician, (req, res) => {
    const role = req.user && req.user.role;
    const techId = parseInt(req.user.id, 10);
    if (role === 'admin' || !Number.isFinite(techId)) {
        const now = new Date();
        let anchor = now;
        for (let i = 0; i < jakartaWeekdayMon0(now); i++) {
            anchor = jakartaAddDaysFromInstant(anchor, -1);
        }
        const todayYmd = jakartaYmdFromInstant(now);
        const daysEmpty = [];
        let cur = anchor;
        for (let i = 0; i < 7; i++) {
            const ymd = jakartaYmdFromInstant(cur);
            daysEmpty.push({
                date: ymd,
                weekday: PERF_WEEKDAY_ID[i],
                is_today: ymd === todayYmd,
                tasks_completed: 0,
                attendance_score: 0
            });
            cur = jakartaAddDaysFromInstant(cur, 1);
        }
        return res.json({
            success: true,
            data: {
                days: daysEmpty,
                tasks_week_total: 0,
                attendance_week_avg: 0,
                employee_matched: false
            }
        });
    }

    const now = new Date();
    let anchor = now;
    for (let i = 0; i < jakartaWeekdayMon0(now); i++) {
        anchor = jakartaAddDaysFromInstant(anchor, -1);
    }
    const weekStartYmd = jakartaYmdFromInstant(anchor);
    const weekEndYmd = jakartaYmdFromInstant(jakartaAddDaysFromInstant(anchor, 6));
    const todayYmd = jakartaYmdFromInstant(now);

    const installSql = `
        SELECT substr(COALESCE(updated_at, created_at), 1, 10) AS d, COUNT(*) AS c
        FROM installation_jobs
        WHERE assigned_technician_id = ?
          AND LOWER(status) IN ('completed','cancelled')
          AND substr(COALESCE(updated_at, created_at), 1, 10) >= ?
          AND substr(COALESCE(updated_at, created_at), 1, 10) <= ?
        GROUP BY substr(COALESCE(updated_at, created_at), 1, 10)
    `;
    const troubleSql = `
        SELECT substr(COALESCE(updated_at, created_at), 1, 10) AS d, COUNT(*) AS c
        FROM trouble_reports
        WHERE (assigned_technician_id = ? OR CAST(assigned_technician_id AS TEXT) = ?)
          AND LOWER(status) IN ('closed','resolved')
          AND substr(COALESCE(updated_at, created_at), 1, 10) >= ?
          AND substr(COALESCE(updated_at, created_at), 1, 10) <= ?
        GROUP BY substr(COALESCE(updated_at, created_at), 1, 10)
    `;

    db.all(installSql, [techId, weekStartYmd, weekEndYmd], (err1, installAgg) => {
        if (err1) {
            logger.error('[mobile-adapter] performance/week install:', err1);
            return res.status(500).json({ success: false, message: 'Gagal memuat performa tugas' });
        }
        db.all(troubleSql, [techId, String(techId), weekStartYmd, weekEndYmd], (err2, troubleAgg) => {
            if (err2) {
                logger.error('[mobile-adapter] performance/week trouble:', err2);
                return res.status(500).json({ success: false, message: 'Gagal memuat performa tiket' });
            }
            const taskByDay = {};
            for (const row of installAgg || []) {
                if (row && row.d) taskByDay[row.d] = (taskByDay[row.d] || 0) + toFiniteNumber(row.c);
            }
            for (const row of troubleAgg || []) {
                if (row && row.d) taskByDay[row.d] = (taskByDay[row.d] || 0) + toFiniteNumber(row.c);
            }

            const variants = phoneVariantsForEmployeeLookup(req.user.phone || req.user.username || '');
            const findEmp = (cb) => {
                if (!variants.length) return cb(null, null);
                const ph = variants.map(() => '?').join(',');
                db.get(
                    `SELECT id FROM employees
                     WHERE (status IS NULL OR LOWER(TRIM(status)) = 'aktif')
                       AND TRIM(no_hp) IN (${ph})
                     LIMIT 1`,
                    variants,
                    (e, empRow) => cb(e, empRow)
                );
            };

            findEmp((empErr, empRow) => {
                if (empErr) {
                    logger.error('[mobile-adapter] performance/week employee:', empErr);
                }
                const employeeId = empRow && empRow.id != null ? parseInt(empRow.id, 10) : null;
                const employeeMatched = Number.isFinite(employeeId) && employeeId > 0;

                const finish = (attRows) => {
                    const attByDate = {};
                    for (const r of attRows || []) {
                        if (r && r.date) attByDate[String(r.date).slice(0, 10)] = r;
                    }

                    const days = [];
                    let cur = anchor;
                    let tasksWeekTotal = 0;
                    let attSum = 0;
                    let attCount = 0;
                    let maxTasks = 0;
                    for (let i = 0; i < 7; i++) {
                        const ymd = jakartaYmdFromInstant(cur);
                        const tc = toFiniteNumber(taskByDay[ymd]);
                        if (tc > maxTasks) maxTasks = tc;
                        tasksWeekTotal += tc;
                        const attSc = employeeMatched ? attendanceDayScore(attByDate[ymd]) : 0;
                        if (employeeMatched) {
                            attSum += attSc;
                            attCount += 1;
                        }
                        days.push({
                            date: ymd,
                            weekday: PERF_WEEKDAY_ID[i],
                            is_today: ymd === todayYmd,
                            tasks_completed: tc,
                            attendance_score: attSc
                        });
                        cur = jakartaAddDaysFromInstant(cur, 1);
                    }
                    const attendanceWeekAvg = attCount > 0 ? Math.round((attSum / attCount) * 10) / 10 : 0;
                    res.json({
                        success: true,
                        data: {
                            days,
                            tasks_week_total: tasksWeekTotal,
                            attendance_week_avg: attendanceWeekAvg,
                            employee_matched: employeeMatched,
                            tasks_week_max_per_day: maxTasks
                        }
                    });
                };

                if (!employeeMatched) {
                    return finish([]);
                }
                db.all(
                    `SELECT date, check_in, check_out, status FROM employee_attendance
                     WHERE employee_id = ? AND date >= ? AND date <= ?`,
                    [employeeId, weekStartYmd, weekEndYmd],
                    (aErr, rows) => {
                        if (aErr) {
                            logger.error('[mobile-adapter] performance/week attendance:', aErr);
                            return finish([]);
                        }
                        finish(rows);
                    }
                );
            });
        });
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

// --- Kolektor (Field Collector app) — notifikasi in-app ---
router.get('/collector/notifications', verifyToken, requireCollector, (req, res) => {
    const collectorId = parseCollectorId(req);
    if (!Number.isFinite(collectorId)) {
        return res.status(400).json({ success: false, message: 'ID kolektor tidak valid' });
    }
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    db.get(
        `SELECT COUNT(*) AS c FROM collector_field_notifications
         WHERE collector_id = ? AND read_at IS NULL`,
        [collectorId],
        (e1, countRow) => {
            if (e1) {
                logger.error('[mobile-adapter] collector/notifications count:', e1);
                return res.status(500).json({ success: false, message: e1.message });
            }
            const unread_count = countRow ? countRow.c : 0;
            db.all(
                `SELECT id, collector_id, kind, ref_id, title, body, read_at, created_at
                 FROM collector_field_notifications
                 WHERE collector_id = ?
                 ORDER BY datetime(created_at) DESC
                 LIMIT ?`,
                [collectorId, limit],
                (e2, rows) => {
                    if (e2) {
                        logger.error('[mobile-adapter] collector/notifications list:', e2);
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

router.post('/collector/notifications/:notifId/read', verifyToken, requireCollector, (req, res) => {
    const collectorId = parseCollectorId(req);
    const nid = parseInt(req.params.notifId, 10);
    if (!Number.isFinite(collectorId) || !Number.isFinite(nid)) {
        return res.status(400).json({ success: false, message: 'Data tidak valid' });
    }
    db.run(
        `UPDATE collector_field_notifications SET read_at = datetime('now')
         WHERE id = ? AND collector_id = ?`,
        [nid, collectorId],
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

router.post('/collector/notifications/read-all', verifyToken, requireCollector, (req, res) => {
    const collectorId = parseCollectorId(req);
    if (!Number.isFinite(collectorId)) {
        return res.status(400).json({ success: false, message: 'ID kolektor tidak valid' });
    }
    db.run(
        `UPDATE collector_field_notifications SET read_at = datetime('now')
         WHERE collector_id = ? AND read_at IS NULL`,
        [collectorId],
        function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            res.json({ success: true, message: 'Semua ditandai dibaca', updated: this.changes });
        }
    );
});

router.get('/collector/overview', verifyToken, requireCollector, async (req, res) => {
    const collectorId = parseCollectorId(req);
    if (!collectorId) {
        return res.status(400).json({ success: false, message: 'ID kolektor tidak valid' });
    }
    const month = req.query.month != null && req.query.month !== '' ? String(req.query.month) : null;
    const year = req.query.year != null && req.query.year !== '' ? String(req.query.year) : null;
    try {
        const [collector, dashboardStats, allMappedCustomers] = await Promise.all([
            billingManager.getCollectorById(collectorId),
            billingManager.getCollectorDashboardStats(collectorId, month, year),
            billingManager.getCollectorCustomers(collectorId)
        ]);
        const list = allMappedCustomers || [];
        const totalPelangganAktif = list.length;
        const belumBayarCount = list.filter((c) => matchesAdminBelumLunasFromPaymentStatus(c)).length;
        const lunasCount = list.filter((c) => matchesAdminLunasFromPaymentStatus(c)).length;
        const isolirCount = list.filter((c) => collectorCustomerIsIsolir(c)).length;
        const priorityCustomers = list
            .filter((c) => matchesAdminBelumLunasFromPaymentStatus(c) && !collectorCustomerIsIsolir(c))
            .slice(0, 5)
            .map((c) => ({
                id: c.id,
                name: c.name,
                address: c.address || '-',
                amount: Math.round(parseFloat(c.package_price || 0)),
                payment_status: c.payment_status
            }));

        const targetMonth = Math.round(parseFloat(dashboardStats.tagihan?.total || 0));
        const terkumpul = Math.round(
            parseFloat((dashboardStats.tagihanLunas?.total ?? dashboardStats.lunas?.total) || 0)
        );
        const progressPct = targetMonth > 0 ? Math.min(100, Math.round((terkumpul / targetMonth) * 100)) : 0;
        const sisaTarget = Math.max(0, targetMonth - terkumpul);

        const areaRows = await new Promise((resolve, reject) => {
            db.all(
                'SELECT DISTINCT area FROM collector_areas WHERE collector_id = ? AND area IS NOT NULL AND area != "" LIMIT 8',
                [collectorId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
        const areaLabel =
            areaRows.map((r) => r.area).filter(Boolean).join(', ') ||
            collector?.address ||
            'Wilayah penugasan';

        res.json({
            success: true,
            data: {
                collector: sanitizeCollectorRow(collector),
                statistics: sanitizeCollectorDashboardStats(dashboardStats),
                fieldUi: {
                    totalPelangganAktif,
                    belumBayarCount,
                    lunasCount,
                    isolirCount,
                    priorityCustomers,
                    targetMonth,
                    terkumpul,
                    progressPct,
                    sisaTarget,
                    areaLabel,
                    displayDate: new Date().toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                    })
                }
            }
        });
    } catch (error) {
        logger.error('[mobile-adapter] collector/overview', error);
        res.status(500).json({ success: false, message: error.message || 'Gagal memuat' });
    }
});

router.get('/collector/customers', verifyToken, requireCollector, async (req, res) => {
    const collectorId = parseCollectorId(req);
    if (!collectorId) {
        return res.status(400).json({ success: false, message: 'ID kolektor tidak valid' });
    }
    const statusFilter = (req.query.status || '').toString().toLowerCase();
    const q = (req.query.q || '').toString();
    try {
        const allMappedCustomers = await billingManager.getCollectorCustomers(collectorId);
        const rows = filterCollectorCustomersForMobile(allMappedCustomers, statusFilter, q);
        const data = rows.map((c) => ({
            id: c.id,
            customer_id: c.customer_id != null && c.customer_id !== '' ? String(c.customer_id) : null,
            username: c.username != null ? String(c.username) : '',
            name: c.name,
            address: c.address || '',
            phone: c.phone || '',
            email: c.email || '',
            status: c.status,
            payment_status: c.payment_status,
            package_price: Math.round(parseFloat(c.package_price || 0)),
            package_name: c.package_name || '',
            latitude:
                c.latitude != null && c.latitude !== '' && !Number.isNaN(parseFloat(c.latitude))
                    ? parseFloat(c.latitude)
                    : null,
            longitude:
                c.longitude != null && c.longitude !== '' && !Number.isNaN(parseFloat(c.longitude))
                    ? parseFloat(c.longitude)
                    : null,
            pppoe_username: c.pppoe_username != null ? String(c.pppoe_username) : '',
            pppoe_profile: c.pppoe_profile != null ? String(c.pppoe_profile) : '',
            router_name: c.router_name != null ? String(c.router_name) : ''
        }));
        res.json({ success: true, data });
    } catch (error) {
        logger.error('[mobile-adapter] collector/customers', error);
        res.status(500).json({ success: false, message: error.message || 'Gagal memuat' });
    }
});

router.get('/collector/settlement', verifyToken, requireCollector, async (req, res) => {
    const collectorId = parseCollectorId(req);
    if (!collectorId) {
        return res.status(400).json({ success: false, message: 'ID kolektor tidak valid' });
    }
    try {
        const [payments, dashboardStats] = await Promise.all([
            billingManager.getCollectorAllPayments(collectorId),
            billingManager.getCollectorDashboardStats(collectorId)
        ]);
        const s = dashboardStats.setoran || {};
        const sudahSetor = Math.round(parseFloat(s.sudah_setor || 0));
        const belumSetor = Math.round(parseFloat(s.belum_setor || 0));
        const totalHarusSetor = sudahSetor + belumSetor;
        const setoranProgressPct =
            totalHarusSetor > 0 ? Math.min(100, Math.round((sudahSetor / totalHarusSetor) * 100)) : 0;
        const paymentsSafe = (payments || []).slice(0, 100).map((p) => sanitizeCollectorPaymentRow(p));
        res.json({
            success: true,
            data: {
                setoranUi: { sudahSetor, belumSetor, totalHarusSetor, setoranProgressPct },
                payments: paymentsSafe
            }
        });
    } catch (error) {
        logger.error('[mobile-adapter] collector/settlement', error);
        res.status(500).json({ success: false, message: error.message || 'Gagal memuat' });
    }
});

router.get('/collector/me', verifyToken, requireCollector, async (req, res) => {
    const collectorId = parseCollectorId(req);
    if (!collectorId) {
        return res.status(400).json({ success: false, message: 'ID kolektor tidak valid' });
    }
    try {
        const row = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, name, phone, email, address, commission_rate, status, created_at FROM collectors WHERE id = ?',
                [collectorId],
                (err, r) => (err ? reject(err) : resolve(r))
            );
        });
        if (!row) {
            return res.status(404).json({ success: false, message: 'Kolektor tidak ditemukan' });
        }
        const [dashboardStats, allPayments, monthlyCommission] = await Promise.all([
            billingManager.getCollectorDashboardStats(collectorId),
            billingManager.getCollectorAllPayments(collectorId),
            (async () => {
                const now = new Date();
                return billingManager.getCollectorMonthlyCommission(
                    collectorId,
                    now.getFullYear(),
                    now.getMonth() + 1
                );
            })()
        ]);
        const statsSafe = sanitizeCollectorDashboardStats(dashboardStats);
        const tagCount = parseInt(statsSafe.tagihan?.count || 0, 10) || 0;
        const paidDistinct = parseInt(statsSafe.lunas?.count || 0, 10) || 0;
        const successRate = tagCount > 0 ? Math.min(100, Math.round((paidDistinct / tagCount) * 100)) : 0;
        const totalCollections = (allPayments || []).filter((p) => p.status === 'completed').length;
        res.json({
            success: true,
            data: {
                ...row,
                profileStats: {
                    successRate,
                    totalCollections,
                    monthlyCommission: Math.round(parseFloat(monthlyCommission || 0))
                }
            }
        });
    } catch (error) {
        logger.error('[mobile-adapter] collector/me', error);
        res.status(500).json({ success: false, message: error.message || 'Gagal memuat' });
    }
});

router.put('/collector/me', verifyToken, requireCollector, async (req, res) => {
    const collectorId = parseCollectorId(req);
    if (!collectorId) {
        return res.status(400).json({ success: false, message: 'ID kolektor tidak valid' });
    }
    const body = req.body || {};
    const name = body.name != null ? String(body.name).trim() : '';
    const phone = body.phone != null ? String(body.phone).trim() : '';
    const email = body.email != null ? String(body.email).trim() : '';
    const address = body.address != null ? String(body.address).trim() : '';
    if (!name) {
        return res.status(400).json({ success: false, message: 'Nama wajib diisi' });
    }
    if (!phone) {
        return res.status(400).json({ success: false, message: 'Nomor HP wajib diisi' });
    }
    try {
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE collectors
                 SET name = ?, phone = ?, email = ?, address = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [name, phone, email || null, address || null, collectorId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        res.json({ success: true, message: 'Profil berhasil diperbarui' });
    } catch (error) {
        const msg = error && error.message ? String(error.message) : '';
        if (msg.includes('UNIQUE') && msg.toLowerCase().includes('phone')) {
            return res.status(400).json({ success: false, message: 'Nomor HP sudah dipakai kolektor lain' });
        }
        logger.error('[mobile-adapter] collector/me PUT', error);
        res.status(500).json({ success: false, message: error.message || 'Gagal menyimpan' });
    }
});

async function collectorMappedCustomerIds(collectorId) {
    const list = await billingManager.getCollectorCustomers(collectorId);
    return new Set((list || []).map((c) => Number(c.id)));
}

router.get('/collector/customer-invoices/:customerId', verifyToken, requireCollector, async (req, res) => {
    const collectorId = parseCollectorId(req);
    if (!collectorId) {
        return res.status(400).json({ success: false, message: 'ID kolektor tidak valid' });
    }
    const customerId = parseInt(String(req.params.customerId), 10);
    if (!Number.isFinite(customerId) || customerId <= 0) {
        return res.status(400).json({ success: false, message: 'ID pelanggan tidak valid' });
    }
    try {
        const allowed = await collectorMappedCustomerIds(collectorId);
        if (!allowed.has(customerId)) {
            return res.status(403).json({ success: false, message: 'Pelanggan tidak ada di wilayah Anda' });
        }
        const invoices = await new Promise((resolve, reject) => {
            db.all(
                `SELECT i.*, p.name as package_name
                 FROM invoices i
                 LEFT JOIN packages p ON i.package_id = p.id
                 WHERE i.customer_id = ? AND i.status = 'unpaid'
                 ORDER BY i.created_at DESC`,
                [customerId],
                (err, rows) => (err ? reject(err) : resolve(rows || []))
            );
        });
        res.json({ success: true, data: invoices });
    } catch (error) {
        logger.error('[mobile-adapter] collector/customer-invoices', error);
        res.status(500).json({ success: false, message: error.message || 'Gagal memuat' });
    }
});

router.get('/collector/customer-invoice-history/:customerId', verifyToken, requireCollector, async (req, res) => {
    const collectorId = parseCollectorId(req);
    if (!collectorId) {
        return res.status(400).json({ success: false, message: 'ID kolektor tidak valid' });
    }
    const customerId = parseInt(String(req.params.customerId), 10);
    if (!Number.isFinite(customerId) || customerId <= 0) {
        return res.status(400).json({ success: false, message: 'ID pelanggan tidak valid' });
    }
    try {
        const allowed = await collectorMappedCustomerIds(collectorId);
        if (!allowed.has(customerId)) {
            return res.status(403).json({ success: false, message: 'Pelanggan tidak ada di wilayah Anda' });
        }
        const rows = await new Promise((resolve, reject) => {
            db.all(
                `SELECT i.*, p.name as package_name
                 FROM invoices i
                 LEFT JOIN packages p ON i.package_id = p.id
                 WHERE i.customer_id = ?
                   AND strftime('%Y', i.created_at) = strftime('%Y', 'now')
                 ORDER BY i.created_at DESC
                 LIMIT 240`,
                [customerId],
                (err, r) => (err ? reject(err) : resolve(r || []))
            );
        });
        res.json({ success: true, data: rows });
    } catch (error) {
        logger.error('[mobile-adapter] collector/customer-invoice-history', error);
        res.status(500).json({ success: false, message: error.message || 'Gagal memuat' });
    }
});

router.get('/collector/customer-ppp-session/:customerId', verifyToken, requireCollector, async (req, res) => {
    const collectorId = parseCollectorId(req);
    if (!collectorId) {
        return res.status(400).json({ success: false, message: 'ID kolektor tidak valid' });
    }
    const customerId = parseInt(String(req.params.customerId), 10);
    if (!Number.isFinite(customerId) || customerId <= 0) {
        return res.status(400).json({ success: false, message: 'ID pelanggan tidak valid' });
    }
    try {
        const allowed = await collectorMappedCustomerIds(collectorId);
        if (!allowed.has(customerId)) {
            return res.status(403).json({ success: false, message: 'Pelanggan tidak ada di wilayah Anda' });
        }
        const row = await new Promise((resolve, reject) => {
            db.get(
                'SELECT pppoe_username, username FROM customers WHERE id = ?',
                [customerId],
                (err, r) => (err ? reject(err) : resolve(r || null))
            );
        });
        if (!row) {
            return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
        }
        const login =
            (row.pppoe_username && String(row.pppoe_username).trim()) ||
            (row.username && String(row.username).trim()) ||
            '';
        const { getPppoeLoginOnlineStatus } = require('../../config/mikrotik');
        const { online, authMode } = await getPppoeLoginOnlineStatus(login);
        res.json({
            success: true,
            data: {
                online: Boolean(online),
                auth_mode: authMode || 'unknown',
                login_checked: login
            }
        });
    } catch (error) {
        logger.error('[mobile-adapter] collector/customer-ppp-session', error);
        res.status(500).json({ success: false, message: error.message || 'Gagal memuat' });
    }
});

router.post('/collector/customer-isolir/:customerId', verifyToken, requireCollector, async (req, res) => {
    const collectorId = parseCollectorId(req);
    if (!collectorId) {
        return res.status(400).json({ success: false, message: 'ID kolektor tidak valid' });
    }
    const customerId = parseInt(String(req.params.customerId), 10);
    if (!Number.isFinite(customerId) || customerId <= 0) {
        return res.status(400).json({ success: false, message: 'ID pelanggan tidak valid' });
    }
    try {
        const allowed = await collectorMappedCustomerIds(collectorId);
        if (!allowed.has(customerId)) {
            return res.status(403).json({ success: false, message: 'Pelanggan tidak ada di wilayah Anda' });
        }
        const customer = await billingManager.getCustomerById(customerId);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
        }
        if (String(customer.status || '')
            .toLowerCase()
            .trim() === 'suspended') {
            return res.status(400).json({ success: false, message: 'Pelanggan sudah dalam status isolir' });
        }
        const rawReason = req.body && req.body.reason != null ? String(req.body.reason).trim() : '';
        const reason =
            rawReason.length > 0
                ? rawReason.slice(0, 400)
                : 'Isolir manual oleh kolektor (peringatan)';
        const serviceSuspension = require('../../config/serviceSuspension');
        // Urutan: RADIUS/Mikrotik (profil isolir + putus sesi) → WA → baru update status DB (tanpa GenieACS/email)
        const result = await serviceSuspension.suspendCustomerService(customer, reason, {
            skipBillingStatus: true,
            awaitWhatsApp: true
        });
        if (!result || !result.success) {
            const det = result && result.results ? JSON.stringify(result.results) : '';
            logger.warn(`[mobile-adapter] isolir: gagal jaringan/WA. ${det}`);
            return res.status(502).json({
                success: false,
                message: 'Gagal menyelesaikan isolir (Mikrotik/RADIUS). Coba lagi atau hubungi admin.',
                data: { customerId, details: result && result.results }
            });
        }
        await billingManager.setCustomerStatusById(customerId, 'suspended');
        return res.json({
            success: true,
            message: 'Pelanggan diisolir; notifikasi WA dikirim bila diaktifkan.',
            data: { customerId }
        });
    } catch (error) {
        logger.error('[mobile-adapter] collector/customer-isolir', error);
        res.status(500).json({ success: false, message: error.message || 'Gagal isolir' });
    }
});

router.post(
    '/collector/payment',
    verifyToken,
    requireCollector,
    collectorPaymentMulter.single('payment_proof'),
    async (req, res) => {
        const collectorId = parseCollectorId(req);
        if (!collectorId) {
            return res.status(400).json({ success: false, message: 'ID kolektor tidak valid' });
        }
        const { customer_id, payment_amount, payment_method, notes, invoice_ids, discount_amount } =
            req.body || {};
        const customerIdNum = parseInt(String(customer_id), 10);
        if (!Number.isFinite(customerIdNum) || customerIdNum <= 0) {
            return res.status(400).json({ success: false, message: 'ID pelanggan tidak valid' });
        }
        const method = (payment_method || '').toString();
        if (method === 'transfer' && !req.file) {
            return res.status(400).json({ success: false, message: 'Foto bukti transfer wajib diunggah' });
        }
        try {
            const allowed = await collectorMappedCustomerIds(collectorId);
            if (!allowed.has(customerIdNum)) {
                return res.status(403).json({ success: false, message: 'Pelanggan tidak ada di wilayah Anda' });
            }
            const paymentProof = req.file ? `/uploads/payments/${req.file.filename}` : null;
            const result = await submitCollectorPayment({
                collectorId,
                customer_id: customerIdNum,
                payment_amount,
                payment_method: method,
                notes,
                invoice_ids,
                discount_amount,
                paymentProofRelativePath: paymentProof
            });
            if (!result.ok) {
                return res.status(result.status || 400).json({ success: false, message: result.message });
            }
            res.json({
                success: true,
                message: 'Pembayaran berhasil disimpan',
                payment_id: result.payment_id,
                commission_amount: result.commission_amount
            });
        } catch (error) {
            logger.error('[mobile-adapter] collector/payment', error);
            res.status(500).json({ success: false, message: error.message || 'Gagal menyimpan' });
        }
    }
);

function collectorReceiptSettingsForMobile() {
    return {
        companyHeader: getSetting('company_header', 'ISP Monitor'),
        footerInfo: getSetting('footer_info', ''),
        logoFilename: getSetting('logo_filename', 'logo.png'),
        company_slogan: getSetting('company_slogan', ''),
        company_website: getSetting('company_website', ''),
        invoice_notes: getSetting('invoice_notes', ''),
        payment_bank_name: getSetting('payment_bank_name', ''),
        payment_account_number: getSetting('payment_account_number', ''),
        payment_account_holder: getSetting('payment_account_holder', ''),
        payment_cash_address: getSetting('payment_cash_address', ''),
        payment_cash_hours: getSetting('payment_cash_hours', ''),
        contact_phone: getSetting('contact_phone', ''),
        contact_email: getSetting('contact_email', ''),
        contact_address: getSetting('contact_address', ''),
        contact_whatsapp: getSetting('contact_whatsapp', '')
    };
}

function sanitizeInvoiceForCollectorReceipt(inv) {
    if (!inv || typeof inv !== 'object') return null;
    const n = (v) => {
        const x = Number(v);
        return Number.isFinite(x) ? x : 0;
    };
    const s = (v) => (v == null ? '' : String(v));
    return {
        id: n(inv.id),
        invoice_number: s(inv.invoice_number),
        status: s(inv.status),
        amount: n(inv.amount),
        base_amount: inv.base_amount != null && inv.base_amount !== '' ? n(inv.base_amount) : null,
        tax_rate: inv.tax_rate != null && inv.tax_rate !== '' ? n(inv.tax_rate) : null,
        created_at: s(inv.created_at),
        due_date: s(inv.due_date),
        payment_date: inv.payment_date != null ? s(inv.payment_date) : '',
        payment_method: s(inv.payment_method),
        notes: s(inv.notes),
        package_name: s(inv.package_name),
        package_speed: s(inv.package_speed),
        customer_name: s(inv.customer_name),
        customer_username: s(inv.customer_username),
        customer_phone: s(inv.customer_phone),
        customer_address: s(inv.customer_address)
    };
}

/** Resi / cetak invoice (setara /admin/billing/invoices/:id/print) untuk pelanggan di wilayah kolektor. */
router.get('/collector/customers/:customerId/receipt', verifyToken, requireCollector, async (req, res) => {
    const collectorId = parseCollectorId(req);
    if (!collectorId) {
        return res.status(400).json({ success: false, message: 'ID kolektor tidak valid' });
    }
    const customerId = parseInt(String(req.params.customerId), 10);
    if (!Number.isFinite(customerId) || customerId <= 0) {
        return res.status(400).json({ success: false, message: 'ID pelanggan tidak valid' });
    }
    const qInv = req.query.invoice_id != null && req.query.invoice_id !== '' ? parseInt(String(req.query.invoice_id), 10) : null;
    try {
        const allowed = await collectorMappedCustomerIds(collectorId);
        if (!allowed.has(customerId)) {
            return res.status(403).json({ success: false, message: 'Pelanggan tidak ada di wilayah Anda' });
        }

        let full = null;

        if (Number.isFinite(qInv) && qInv > 0) {
            const row = await billingManager.getInvoiceById(qInv);
            if (!row) {
                return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
            }
            if (Number(row.customer_id) !== customerId) {
                return res.status(403).json({ success: false, message: 'Invoice bukan milik pelanggan ini' });
            }
            if (String(row.status || '').toLowerCase() !== 'paid') {
                return res.status(400).json({ success: false, message: 'Resi hanya untuk tagihan yang sudah lunas' });
            }
            full = row;
        } else {
            const list = await billingManager.getInvoicesByCustomer(customerId);
            const paid = (list || [])
                .filter((i) => String(i.status || '').toLowerCase() === 'paid')
                .sort((a, b) => {
                    const ta = new Date(a.payment_date || a.updated_at || a.created_at || 0).getTime();
                    const tb = new Date(b.payment_date || b.updated_at || b.created_at || 0).getTime();
                    return tb - ta;
                });
            const pick = paid[0];
            if (!pick) {
                return res.status(404).json({ success: false, message: 'Belum ada invoice lunas untuk ditampilkan sebagai resi' });
            }
            full = await billingManager.getInvoiceById(pick.id);
        }

        if (!full) {
            return res.status(404).json({ success: false, message: 'Data invoice tidak tersedia' });
        }

        res.json({
            success: true,
            data: {
                invoice: sanitizeInvoiceForCollectorReceipt(full),
                settings: collectorReceiptSettingsForMobile()
            }
        });
    } catch (error) {
        logger.error('[mobile-adapter] collector/customers/.../receipt', error);
        res.status(500).json({ success: false, message: error.message || 'Gagal memuat' });
    }
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
