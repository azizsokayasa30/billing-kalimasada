# 🔧 Troubleshooting: ERR_CONNECTION_REFUSED pada Server Baru

## ❌ Masalah: `ERR_CONNECTION_REFUSED` saat mengakses UI

Error ini terjadi ketika server tidak berjalan atau tidak listening di IP/port yang benar.

## 🔍 Langkah Troubleshooting

### 1. ✅ Cek Apakah Aplikasi Sudah Berjalan

```bash
# Cek dengan PM2
pm2 status

# Cek dengan systemctl (jika menggunakan systemd)
systemctl status cvlintasmultimedia

# Cek dengan netstat/ss
ss -tlnp | grep :4555
# atau
netstat -tlnp | grep :4555
```

**Jika aplikasi tidak berjalan:**
```bash
cd /path/to/BillCVLmedia
npm install
pm2 start app.js --name cvlmedia
pm2 save
```

### 2. ✅ Cek Dependencies Sudah Terinstall

```bash
cd /path/to/BillCVLmedia
npm install

# Jika ada error dengan sqlite3
npm rebuild sqlite3
# atau
npm install sqlite3 --build-from-source
```

### 3. ✅ Cek File `settings.json` Sudah Ada

```bash
cd /path/to/BillCVLmedia
ls -la settings.json

# Jika belum ada, copy dari template
cp settings.example.json settings.json
# atau
cp settings.server.template.json settings.json

# Edit settings.json
nano settings.json
```

**Minimal konfigurasi di `settings.json`:**
```json
{
  "server_port": 4555,
  "admins.0": "6281368888498",
  "genieacs_url": "http://192.168.8.89:7557",
  "genieacs_username": "admin",
  "genieacs_password": "admin",
  "mikrotik_host": "192.168.8.1",
  "mikrotik_user": "admin",
  "mikrotik_password": "admin"
}
```

### 4. ✅ Cek Port di Firewall

```bash
# Cek apakah port 4555 sudah dibuka
sudo ufw status
# atau
sudo firewall-cmd --list-ports

# Jika belum dibuka, buka port 4555
sudo ufw allow 4555/tcp
sudo ufw reload
# atau untuk firewalld
sudo firewall-cmd --permanent --add-port=4555/tcp
sudo firewall-cmd --reload
```

### 5. ✅ Cek Aplikasi Listening di IP yang Benar

```bash
# Cek IP server
ip addr show
# atau
hostname -I

# Cek apakah aplikasi listening di semua interface (0.0.0.0) atau hanya localhost
ss -tlnp | grep :4555
# Harus menunjukkan: 0.0.0.0:4555 atau 172.17.28.192:4555
```

**Jika hanya listening di 127.0.0.1 (localhost):**
- Edit `app.js` untuk bind ke 0.0.0.0 atau IP spesifik

### 6. ✅ Cek Database Sudah Di-Setup

```bash
cd /path/to/BillCVLmedia

# Cek apakah database sudah ada
ls -la data/billing.db

# Jika belum ada, jalankan setup
npm start
# Tunggu sampai aplikasi berjalan, lalu tekan Ctrl+C
# Database akan otomatis dibuat

# Atau jalankan script setup
bash setup.sh
```

### 7. ✅ Cek Logs Aplikasi

```bash
# Cek logs PM2
pm2 logs cvlmedia --lines 50

# Cek logs aplikasi langsung
tail -f logs/app.log
# atau
tail -f logs/error.log
```

**Cari error seperti:**
- Port already in use
- Cannot find module
- Database error
- Permission denied

### 8. ✅ Test Koneksi Lokal Dulu

```bash
# Test dari server sendiri
curl http://localhost:4555
curl http://127.0.0.1:4555
curl http://172.17.28.192:4555

# Jika localhost berhasil tapi IP tidak, berarti masalah di firewall atau binding
```

### 9. ✅ Cek Node.js Version

```bash
node --version
# Harus >= 14.0.0 (direkomendasikan v18+)

npm --version
# Harus >= 6.0.0
```

### 10. ✅ Setup Script Lengkap

Jika semua di atas sudah dicek, jalankan setup script lengkap:

```bash
cd /path/to/BillCVLmedia

# 1. Install dependencies
npm install

# 2. Setup database
bash setup.sh
# Script ini akan otomatis:
# - Setup payment gateway tables
# - Setup technician tables
# - Run SQL migrations
# - Setup default data
# - Install PM2
# - Start aplikasi

# 3. Cek status
pm2 status
pm2 logs cvlmedia --lines 20
```

## 🚀 Quick Fix Commands

```bash
# Stop aplikasi yang mungkin konflik
pm2 stop all
pkill -f node

# Install dependencies
cd /path/to/BillCVLmedia
npm install

# Setup database
bash setup.sh

# Start aplikasi
pm2 start app.js --name cvlmedia
pm2 save

# Buka firewall
sudo ufw allow 4555/tcp
sudo ufw reload

# Cek status
pm2 status
pm2 logs cvlmedia
```

## 🌐 Akses Web Portal

Setelah semua setup selesai, akses:

- **Admin Dashboard**: `http://172.17.28.192:4555/admin/login`
- **Default Login**: admin / admin (atau sesuai konfigurasi)

**Pastikan menggunakan port yang benar (4555) di URL!**

## 📋 Checklist Instalasi

- [ ] Git clone repository sudah selesai
- [ ] `npm install` sudah dijalankan tanpa error
- [ ] File `settings.json` sudah dibuat dan dikonfigurasi
- [ ] Database sudah di-setup (`bash setup.sh`)
- [ ] Aplikasi sudah running (`pm2 status` menunjukkan running)
- [ ] Port 4555 sudah dibuka di firewall
- [ ] Aplikasi listening di IP yang benar (`ss -tlnp | grep :4555`)
- [ ] Test koneksi lokal berhasil (`curl http://localhost:4555`)

## 🆘 Jika Masih Error

1. **Cek logs detail:**
   ```bash
   pm2 logs cvlmedia --lines 100
   ```

2. **Cek error di console:**
   ```bash
   cd /path/to/BillCVLmedia
   node app.js
   # Perhatikan error yang muncul
   ```

3. **Cek database:**
   ```bash
   sqlite3 data/billing.db ".tables"
   sqlite3 data/billing.db "SELECT COUNT(*) FROM packages;"
   ```

4. **Hubungi support:**
   - GitHub Issues: https://github.com/enosrotua/BillCVLmedia/issues
   - WhatsApp: 0813-6888-8498

