# 📥 Update CVLMEDIA dari GitHub

Panduan untuk mendapatkan update terbaru dari GitHub di server lain.

## 🔄 Cara Update dari GitHub

### Jika repository sudah ada (sudah pernah clone):

```bash
# Masuk ke direktori CVLMEDIA
cd /home/enos/cvlmedia

# Cek status dan branch saat ini
git status

# Pull update terbaru dari GitHub
git pull origin main
```

### Jika repository belum ada (fresh install):

```bash
# Clone repository dari GitHub
cd /home/enos
git clone https://github.com/enosrotua/BillCVLmedia.git cvlmedia

# Masuk ke direktori
cd cvlmedia

# Install dependencies (jika belum)
npm install
```

## ⚠️ IMPORTANT: Initialize Database Setelah Clone

Setelah clone, **WAJIB** jalankan script untuk init database:

```bash
cd /home/enos/cvlmedia

# Install dependencies dulu (jika belum)
npm install

# Run database initialization script
node scripts/init-database.js
```

Script ini akan:
- ✅ Membuat database `data/billing.db` jika belum ada
- ✅ Menjalankan semua migration SQL files
- ✅ Membuat semua tabel yang diperlukan (termasuk `technicians`, `app_settings`, dll)

**Tanpa ini, web UI akan error karena tabel tidak ada!**

## 🔍 Verifikasi Update

Setelah pull dan init database, verifikasi:

```bash
cd /home/enos/cvlmedia

# Cek file baru
ls -la config/radiusConfig.js
ls -la RADIUS_*.md

# Cek database sudah ada dan memiliki tabel
sqlite3 data/billing.db ".tables" | grep -E "technicians|app_settings|customers"

# Cek log commit terbaru
git log --oneline -5
```

Harus muncul commit: `feat: RADIUS integration dengan database-based configuration`

## ⚠️ Jika Ada Konflik

Jika ada konflik saat pull:

```bash
# Simpan perubahan lokal dulu (jika ada)
git stash

# Pull update
git pull origin main

# Restore perubahan lokal (jika perlu)
git stash pop
```

## 🔄 Setelah Update

Setelah pull dan init database berhasil:

### 1. Restart CVLMEDIA
```bash
# Jika pakai PM2
pm2 restart cvlmedia

# Atau restart manual
pkill -f "node.*cvlmedia"
cd /home/enos/cvlmedia
npm start
```

### 2. Setup RADIUS Config (Optional)
- Buka `/admin/radius` di browser
- Isi form sesuai panduan di `ISI_FORM_RADIUS.md`

## 📋 Quick Command (One-liner)

```bash
cd /home/enos/cvlmedia && git pull origin main && node scripts/init-database.js && pm2 restart cvlmedia
```

## 🔐 Jika Perlu Authentication

Jika GitHub meminta authentication, pastikan sudah setup:

```bash
# Cek remote URL
git remote -v

# Jika perlu, update dengan token (contoh sudah ada di repo)
git remote set-url origin https://github.com/enosrotua/BillCVLmedia.git
```

## ✅ Checklist Update

- [ ] `git pull origin main` berhasil
- [ ] `npm install` (jika ada dependencies baru)
- [ ] `node scripts/init-database.js` berhasil
- [ ] File `config/radiusConfig.js` ada
- [ ] Database `data/billing.db` ada dan memiliki tabel
- [ ] CVLMEDIA restart berhasil
- [ ] Bisa akses web UI tanpa error
- [ ] Bisa akses `/admin/radius` (optional)

## 🐛 Troubleshooting

### Error: "no such table: technicians"
**Solusi**: Jalankan `node scripts/init-database.js` untuk create semua tabel

### Error: "Cannot find module"
**Solusi**: Jalankan `npm install` untuk install dependencies

### Error: "SQLITE_ERROR: database is locked"
**Solusi**: 
1. Stop CVLMEDIA: `pm2 stop cvlmedia`
2. Run init script: `node scripts/init-database.js`
3. Start CVLMEDIA: `pm2 start cvlmedia`

---

**Last Updated:** 2024-11-03
