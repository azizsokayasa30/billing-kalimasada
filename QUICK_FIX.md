# 🔧 Quick Fix: Database Initialization Error

Jika setelah clone dari GitHub dan run `node scripts/init-database.js` masih error "no such table: technicians", gunakan solusi berikut:

## ✅ Solusi 1: Update Script (Recommended)

```bash
cd /home/enos/cvlmedia

# Pull update terbaru (script sudah diperbaiki)
git pull origin main

# Run init script lagi
node scripts/init-database.js

# Restart CVLMEDIA
pm2 restart BillCVLmedia
```

## ✅ Solusi 2: Manual Create Technicians Table

Jika script masih error, create tabel manual:

```bash
cd /home/enos/cvlmedia

# Stop CVLMEDIA dulu
pm2 stop BillCVLmedia

# Create technicians table manual
sqlite3 data/billing.db <<EOF
CREATE TABLE IF NOT EXISTS technicians (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('technician', 'field_officer', 'collector')),
    email TEXT,
    notes TEXT,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    area_coverage TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

CREATE TABLE IF NOT EXISTS technician_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    technician_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS technician_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    technician_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_technicians_phone ON technicians(phone);
CREATE INDEX IF NOT EXISTS idx_technicians_active ON technicians(is_active);
CREATE INDEX IF NOT EXISTS idx_technicians_role ON technicians(role);
EOF

# Create app_settings table untuk RADIUS config
sqlite3 data/billing.db <<EOF
CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
EOF

# Start CVLMEDIA
pm2 start BillCVLmedia
```

## ✅ Solusi 3: Let App Create Tables (Alternative)

Biarkan CVLMEDIA create tabel sendiri saat pertama start:

```bash
cd /home/enos/cvlmedia

# Hapus database lama (BACKUP DULU jika ada data penting!)
# mv data/billing.db data/billing.db.backup

# Start CVLMEDIA - akan create tabel otomatis
pm2 restart BillCVLmedia

# Tunggu beberapa detik, cek log
pm2 logs BillCVLmedia --lines 50
```

## 🔍 Verifikasi

Setelah fix, verifikasi tabel sudah ada:

```bash
sqlite3 data/billing.db ".tables" | grep -E "technicians|app_settings|customers|packages"
```

Harus muncul minimal:
- technicians
- app_settings
- customers
- packages

## ⚠️ Catatan

- Warning "no such table" saat run migration adalah **normal** - beberapa migration mencoba ALTER tabel yang belum ada
- Tabel akan dibuat saat CVLMEDIA start via `BillingManager.createTables()`
- Script init-database.js yang baru sudah diperbaiki untuk handle ini dengan lebih baik

---

**Last Updated:** 2024-11-03

