const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getSettingsWithCache } = require('../config/settingsManager');

const db = new sqlite3.Database('./data/billing.db');

// Multer setup for employee photos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './public/uploads/employees';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'emp-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ==========================================
// VIEWS ROUTES
// ==========================================

router.get('/', (req, res) => {
    res.render('admin/employees/index', { 
        page: 'employees',
        settings: getSettingsWithCache()
    });
});

router.get('/attendance', (req, res) => {
    res.render('admin/employees/attendance', { 
        page: 'employee-attendance',
        settings: getSettingsWithCache()
    });
});

router.get('/payroll', (req, res) => {
    res.render('admin/employees/payroll', { 
        page: 'employee-payroll',
        settings: getSettingsWithCache()
    });
});

router.get('/reports', (req, res) => {
    res.render('admin/employees/reports', { 
        page: 'employee-reports',
        settings: getSettingsWithCache()
    });
});

// ==========================================
// API ROUTES - MASTER DATA
// ==========================================

router.get('/api/areas', (req, res) => {
    db.all("SELECT id, nama_area FROM areas ORDER BY nama_area ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows });
    });
});

router.get('/api/data', (req, res) => {
    const query = `
        SELECT e.* 
        FROM employees e
        ORDER BY e.created_at DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows });
    });
});

router.post('/api/data', upload.single('foto'), (req, res) => {
    const { nama_lengkap, nik, alamat, no_hp, email, jabatan, tanggal_masuk, status, gaji_pokok } = req.body;
    const foto_path = req.file ? `/public/uploads/employees/${req.file.filename}` : null;
    
    const query = `
        INSERT INTO employees (nama_lengkap, nik, alamat, no_hp, email, jabatan, tanggal_masuk, status, gaji_pokok, foto_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [nama_lengkap, nik, alamat, no_hp, email, jabatan, tanggal_masuk, status || 'aktif', gaji_pokok || 0, foto_path];
    
    db.run(query, values, function(err) {
        if (err) {
            // Hapus file yang sudah diupload jika db insert gagal
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, id: this.lastID, message: 'Karyawan berhasil ditambahkan' });
    });
});

router.put('/api/data/:id', upload.single('foto'), (req, res) => {
    const { id } = req.params;
    const { nama_lengkap, nik, alamat, no_hp, email, jabatan, tanggal_masuk, status, gaji_pokok } = req.body;
    
    db.get("SELECT foto_path FROM employees WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        let foto_path = row ? row.foto_path : null;
        if (req.file) {
            foto_path = `/public/uploads/employees/${req.file.filename}`;
            // Hapus foto lama
            if (row && row.foto_path) {
                const oldPath = path.join(__dirname, '..', row.foto_path);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        const query = `
            UPDATE employees 
            SET nama_lengkap = ?, nik = ?, alamat = ?, no_hp = ?, email = ?, jabatan = ?, tanggal_masuk = ?, status = ?, gaji_pokok = ?, foto_path = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        const values = [nama_lengkap, nik, alamat, no_hp, email, jabatan, tanggal_masuk, status, gaji_pokok || 0, foto_path, id];
        
        db.run(query, values, function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, message: 'Data karyawan berhasil diupdate' });
        });
    });
});

router.delete('/api/data/:id', (req, res) => {
    const { id } = req.params;
    db.get("SELECT foto_path FROM employees WHERE id = ?", [id], (err, row) => {
        if (!err && row && row.foto_path) {
            const oldPath = path.join(__dirname, '..', row.foto_path);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        db.run("DELETE FROM employees WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, message: 'Karyawan berhasil dihapus' });
        });
    });
});

// ==========================================
// API ROUTES - ATTENDANCE
// ==========================================

router.get('/api/attendance', (req, res) => {
    const { month, year } = req.query;
    
    let query = `
        SELECT a.*, e.nama_lengkap, e.nik 
        FROM employee_attendance a
        JOIN employees e ON a.employee_id = e.id
    `;
    
    let values = [];
    if (month && year) {
        query += ` WHERE strftime('%Y-%m', a.date) = ? `;
        const monthStr = month.padStart(2, '0');
        values.push(`${year}-${monthStr}`);
    }
    query += ` ORDER BY a.date DESC, e.nama_lengkap ASC`;
    
    db.all(query, values, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows });
    });
});

router.post('/api/attendance', (req, res) => {
    const { employee_id, date, status, check_in, check_out, notes } = req.body;
    
    db.get("SELECT id FROM employee_attendance WHERE employee_id = ? AND date = ?", [employee_id, date], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        if (row) {
            // Update
            const query = `
                UPDATE employee_attendance 
                SET status = ?, check_in = ?, check_out = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            db.run(query, [status, check_in || null, check_out || null, notes, row.id], function(err) {
                if (err) return res.status(500).json({ success: false, error: err.message });
                res.json({ success: true, message: 'Absensi berhasil diupdate' });
            });
        } else {
            // Insert
            const query = `
                INSERT INTO employee_attendance (employee_id, date, status, check_in, check_out, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            db.run(query, [employee_id, date, status, check_in || null, check_out || null, notes], function(err) {
                if (err) return res.status(500).json({ success: false, error: err.message });
                res.json({ success: true, message: 'Absensi berhasil dicatat' });
            });
        }
    });
});

// ==========================================
// API ROUTES - PAYROLL
// ==========================================

router.get('/api/payroll', (req, res) => {
    const { month, year } = req.query;
    
    let query = `
        SELECT p.*, e.nama_lengkap, e.nik, e.jabatan 
        FROM employee_payroll p
        JOIN employees e ON p.employee_id = e.id
    `;
    let values = [];
    if (month && year) {
        query += ` WHERE p.period_month = ? AND p.period_year = ? `;
        values.push(parseInt(month), parseInt(year));
    }
    query += ` ORDER BY e.nama_lengkap ASC`;
    
    db.all(query, values, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows });
    });
});

router.post('/api/payroll/generate', (req, res) => {
    const { month, year } = req.body;
    
    // Ambil semua karyawan aktif
    db.all("SELECT id, gaji_pokok FROM employees WHERE status = 'aktif'", [], (err, employees) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (employees.length === 0) return res.json({ success: true, message: 'Tidak ada karyawan aktif untuk digenerate' });
        
        let completed = 0;
        let errors = [];
        
        employees.forEach(emp => {
            // Cek apakah gaji sudah ada di periode tsb
            db.get("SELECT id FROM employee_payroll WHERE employee_id = ? AND period_month = ? AND period_year = ?", 
                [emp.id, month, year], (err, row) => {
                if (!row) {
                    // Generate jika belum ada
                    const query = `
                        INSERT INTO employee_payroll (employee_id, period_month, period_year, gaji_pokok, total_gaji)
                        VALUES (?, ?, ?, ?, ?)
                    `;
                    db.run(query, [emp.id, month, year, emp.gaji_pokok, emp.gaji_pokok], (err) => {
                        if (err) errors.push(err.message);
                        checkDone();
                    });
                } else {
                    checkDone();
                }
            });
        });
        
        function checkDone() {
            completed++;
            if (completed === employees.length) {
                if (errors.length > 0) {
                    res.status(500).json({ success: false, error: 'Beberapa error terjadi: ' + errors.join(', ') });
                } else {
                    res.json({ success: true, message: 'Gaji berhasil di-generate untuk bulan ini' });
                }
            }
        }
    });
});

router.put('/api/payroll/:id', (req, res) => {
    const { id } = req.params;
    const { tunjangan, bonus, potongan, status, payment_date } = req.body;
    
    db.get("SELECT gaji_pokok FROM employee_payroll WHERE id = ?", [id], (err, row) => {
        if (err || !row) return res.status(500).json({ success: false, error: err ? err.message : 'Data tidak ditemukan' });
        
        const gaji_pokok = row.gaji_pokok || 0;
        const total_gaji = parseFloat(gaji_pokok) + parseFloat(tunjangan || 0) + parseFloat(bonus || 0) - parseFloat(potongan || 0);
        
        const query = `
            UPDATE employee_payroll 
            SET tunjangan = ?, bonus = ?, potongan = ?, total_gaji = ?, status = ?, payment_date = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        db.run(query, [tunjangan || 0, bonus || 0, potongan || 0, total_gaji, status, payment_date || null, id], function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, message: 'Data penggajian berhasil diupdate', total_gaji });
        });
    });
});

module.exports = router;
