# ✅ RADIUS Configuration - Database Based

Konfigurasi RADIUS sekarang disimpan di **database CVLMEDIA** (tabel `app_settings`), bukan di `settings.json`.

## 🔄 Perubahan

### Sebelumnya:
- Konfigurasi RADIUS disimpan di `settings.json`
- Edit via file manual atau admin panel (tapi tetap save ke settings.json)

### Sekarang:
- ✅ Konfigurasi RADIUS disimpan di **database** (`app_settings` table)
- ✅ Edit via halaman `/admin/radius` saja
- ✅ Tidak perlu edit `settings.json` lagi untuk RADIUS config

## 📋 Cara Setup

### 1. Buka Halaman RADIUS Settings
Login ke CVLMEDIA admin panel → **Setting > RADIUS/Api Setup** atau langsung:
```
http://your-server:3003/admin/radius
```

### 2. Isi Form Konfigurasi
- **Mode Autentikasi**: Pilih "RADIUS" atau "Mikrotik API"
- **RADIUS Host**: `localhost` (atau IP FreeRADIUS server)
- **RADIUS User**: `billing` (user database untuk billing)
- **RADIUS Password**: Password dari setup_billing_user.sh
- **RADIUS Database**: `radius`

### 3. Klik Simpan
Konfigurasi akan **otomatis tersimpan ke database** dan langsung aktif.

## 🗄️ Database Structure

Konfigurasi disimpan di tabel `app_settings`:

| Key | Value | Description |
|-----|-------|-------------|
| `user_auth_mode` | `radius` atau `mikrotik` | Mode autentikasi yang digunakan |
| `radius_host` | `localhost` | IP/hostname FreeRADIUS server |
| `radius_user` | `billing` | Database user untuk billing |
| `radius_password` | `...` | Password database billing |
| `radius_database` | `radius` | Nama database RADIUS |

## 🔧 File yang Dimodifikasi

### 1. **config/radiusConfig.js** (NEW)
Modul baru untuk handle konfigurasi RADIUS dari database:
- `getRadiusConfig()` - Ambil semua config RADIUS
- `saveRadiusConfig()` - Simpan config RADIUS
- `getRadiusConfigValue()` - Ambil single value

### 2. **routes/adminRadius.js** (UPDATED)
- ✅ GET `/admin/radius` - Ambil dari database
- ✅ POST `/admin/radius` - Simpan ke database

### 3. **config/mikrotik.js** (UPDATED)
- ✅ `getRadiusConnection()` - Ambil config dari database
- ✅ `getUserAuthModeAsync()` - Ambil user_auth_mode dari database
- ✅ Semua fungsi RADIUS otomatis pakai config dari database

### 4. **config/serviceSuspension.js** (UPDATED)
- ✅ `suspendCustomerService()` - Ambil user_auth_mode dari database
- ✅ `restoreCustomerService()` - Ambil user_auth_mode dari database

## ✅ Keuntungan

1. **Centralized Configuration**: Semua config RADIUS di satu tempat (database)
2. **Tidak Perlu Edit File**: Setup via web interface saja
3. **Backup Mudah**: Database bisa di-backup bersama data lain
4. **Multi-Instance Safe**: Tidak ada konflik file settings.json
5. **Secure**: Password tidak perlu ada di file text

## 🔍 Verifikasi

Setelah setup, cek di database:

```sql
sqlite3 data/billing.db
SELECT key, value FROM app_settings WHERE key LIKE 'radius%' OR key = 'user_auth_mode';
```

Harus muncul:
```
user_auth_mode|radius
radius_host|localhost
radius_user|billing
radius_password|your_password
radius_database|radius
```

## 📝 Migration dari settings.json

Jika sebelumnya sudah ada config di `settings.json`, data akan otomatis fallback ke settings.json jika tidak ada di database. Untuk migrasi:

1. Buka `/admin/radius`
2. Copy nilai dari settings.json (jika ada)
3. Paste ke form
4. Save (akan tersimpan ke database)
5. Setelah itu, tidak perlu settings.json lagi untuk RADIUS config

---

## Setelah `git pull` / update aplikasi (PPPoE tetap konsisten)

0. **Otomatis setelah `git pull`** — sekali `npm install` di repo (ada skrip `prepare`) Git memakai folder **`.githooks/`**; hook **`post-merge`** menjalankan **`scripts/post-git-pull.sh`**: `npm install`, `npm run radius:check`, dan (di server yang punya `/etc/freeradius/3.0/clients.conf`) **`npm run radius:mirror-clients`**. Tanpa sudo untuk mirror, hook hanya mencetak peringatan — jalankan mirror manual. Di laptop dev tanpa FreeRADIUS: export **`SKIP_RADIUS_MIRROR=1`** agar mirror dilewati. Manual kapan saja: **`npm run postpull`**.

1. **Satu file SQLite untuk FR dan billing** — nilai `radius_database` / `RADIUS_SQLITE_PATH` harus sama dengan `filename =` di `/etc/freeradius/3.0/mods-enabled/sql`.
2. **Jangan isi user PPPoE di `mods-config/files/authorize`** jika pelanggan dikelola lewat billing — modul `files` dan `sql` keduanya aktif di `sites-enabled/default`; user di file tetap bisa login walaupun `radcheck` kosong.
3. **Cek otomatis setelah deploy** (di server produksi, dari folder aplikasi):

   ```bash
   npm run radius:check
   ```

   Untuk gagalkan skrip CI bila ada masalah: `node scripts/radius-consistency-check.js --strict`

4. Di panel admin, halaman **Setting RADIUS** → **Test Koneksi** — respons JSON sekarang menyertakan blok **`consistency`** (peringatan path, `files/authorize`, duplikat `radcheck` di `billing.db`).

---

**Last Updated:** 2026-05-02 (post-merge / postpull)  
**Version:** 1.2

