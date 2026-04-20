# 🔄 Sinkronisasi Password FreeRADIUS

## 📋 Masalah

Setelah restore database RADIUS dari server lain, password user MySQL `radius` mungkin berbeda dengan password yang dikonfigurasi di FreeRADIUS. Ini menyebabkan:

- ❌ FreeRADIUS tidak bisa connect ke database MySQL
- ❌ Semua user mendapat `Access-Reject` meskipun user ada di database
- ❌ Test koneksi dari aplikasi billing berhasil, tapi authentication gagal

## ✅ Solusi

### 1. Otomatis Setelah Restore

**Fitur otomatis** sudah ditambahkan di fungsi restore. Setelah restore database, sistem akan **otomatis**:

1. ✅ Membaca password dari database billing (`app_settings`)
2. ✅ Update password di FreeRADIUS config (`/etc/freeradius/3.0/mods-available/sql`)
3. ✅ Restart FreeRADIUS service
4. ✅ Password sudah sinkron tanpa perlu tindakan manual

**Tidak perlu debug lagi!** 🎉

### 2. Melalui Web UI

Jika perlu sync password secara manual (misalnya setelah perubahan password di database):

#### Langkah-langkah:

1. **Buka halaman Setting RADIUS**
   ```
   http://your-server:3003/admin/radius
   ```

2. **Scroll ke bagian "Sinkronisasi Password FreeRADIUS"**

3. **Cek Status Sinkronisasi**
   - Klik tombol **"Cek Status Sinkronisasi"**
   - Sistem akan menampilkan apakah password sudah sinkron atau belum
   - Status akan otomatis dicek saat halaman dimuat

4. **Sinkronkan Password** (jika perlu)
   - Jika password tidak sinkron, klik tombol **"Sinkronkan Password"**
   - Konfirmasi dialog yang muncul
   - Sistem akan:
     - Update password di FreeRADIUS config
     - Restart FreeRADIUS
     - Menampilkan hasil

#### Indikator Status:

- 🟢 **Hijau**: Password sudah sinkron, tidak perlu tindakan
- 🟡 **Kuning**: Password tidak sinkron, perlu sync
- 🔴 **Merah**: Error saat memeriksa status

### 3. Melalui API

#### Check Status:
```bash
curl -X GET http://your-server:3003/admin/radius/check-password-sync \
  -H "Cookie: your-session-cookie"
```

Response:
```json
{
  "success": true,
  "synced": false,
  "needsSync": true,
  "billingPassword": "***",
  "freeradiusPassword": "***"
}
```

#### Sync Password:
```bash
curl -X POST http://your-server:3003/admin/radius/sync-password \
  -H "Cookie: your-session-cookie"
```

Response:
```json
{
  "success": true,
  "message": "Password FreeRADIUS berhasil disinkronkan dengan password database billing",
  "oldPassword": "***",
  "newPassword": "***"
}
```

## 🔧 Cara Kerja

### Alur Otomatis Setelah Restore:

```
1. User upload backup file
   ↓
2. Sistem extract backup
   ↓
3. Restore database RADIUS
   ↓
4. Restore FreeRADIUS config (jika ada)
   ↓
5. [BARU] Sync password FreeRADIUS dengan password database billing
   ↓
6. Restart FreeRADIUS
   ↓
7. Selesai - Password sudah sinkron!
```

### Fungsi Sync Password:

1. **Baca password dari database billing** (`app_settings.radius_password`)
2. **Baca password dari FreeRADIUS config** (`/etc/freeradius/3.0/mods-available/sql`)
3. **Bandingkan** kedua password
4. **Jika berbeda**, update password di FreeRADIUS config
5. **Restart FreeRADIUS** untuk menerapkan perubahan
6. **Return status** sukses/gagal

## 📝 File yang Dimodifikasi

### 1. `utils/syncRadiusPassword.js` (NEW)
- `syncRadiusPassword()` - Sync password FreeRADIUS dengan password database billing
- `checkPasswordSync()` - Cek apakah password sudah sinkron

### 2. `utils/radiusBackup.js` (UPDATED)
- Menambahkan auto-sync password setelah restore database
- Password akan otomatis disinkronkan tanpa perlu tindakan manual

### 3. `routes/adminRadius.js` (UPDATED)
- `POST /admin/radius/sync-password` - Endpoint untuk sync password
- `GET /admin/radius/check-password-sync` - Endpoint untuk cek status sync

### 4. `views/adminRadius.ejs` (UPDATED)
- Menambahkan section "Sinkronisasi Password FreeRADIUS"
- Tombol untuk cek status dan sync password
- Auto-check status saat page load

## 🎯 Manfaat

1. ✅ **Tidak perlu debug manual lagi** - Password otomatis sync setelah restore
2. ✅ **Mudah digunakan** - Sync password melalui Web UI dengan 1 klik
3. ✅ **Transparan** - Status sync ditampilkan di UI
4. ✅ **Reliable** - Password selalu sinkron antara billing dan FreeRADIUS

## ⚠️ Catatan Penting

1. **Setelah restore**, password akan **otomatis disinkronkan**
2. **Jika sync gagal**, cek log untuk detail error
3. **FreeRADIUS akan direstart** setelah sync password
4. **Pastikan FreeRADIUS service berjalan** sebelum sync

## 🧪 Testing

### Test Auto-Sync Setelah Restore:

```bash
# 1. Buat backup
# 2. Restore backup
# 3. Cek log - harus ada "Password FreeRADIUS berhasil disinkronkan"
# 4. Test authentication
radtest 1KBML 1KBML 127.0.0.1 0 testing123
# Expected: Access-Accept (bukan Access-Reject)
```

### Test Manual Sync:

1. Buka `/admin/radius`
2. Scroll ke bagian "Sinkronisasi Password FreeRADIUS"
3. Klik "Cek Status Sinkronisasi"
4. Jika tidak sinkron, klik "Sinkronkan Password"
5. Verifikasi status berubah menjadi hijau

---

**Last Updated**: 2025-12-08

