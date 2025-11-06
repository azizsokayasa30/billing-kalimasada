# 🔧 Fix: Mode Hybrid - Menggunakan Router dari Database

## Masalah
Error "RADIUS server is not responding" saat membuat voucher baru dengan memilih Server Hotspot tertentu di mode hybrid.

## Root Cause
1. **Mode RADIUS tidak menggunakan router dari database**: Saat mode RADIUS aktif, sistem tidak mengambil router dari database `/admin/routers`, padahal untuk mode hybrid perlu tahu router mana yang memiliki Server Hotspot yang dipilih.
2. **Atribut Mikrotik-Server**: Voucher yang dibuat dengan Server Hotspot tertentu sebelumnya memiliki atribut `Mikrotik-Server` yang menyebabkan masalah autentikasi RADIUS.

## Perbaikan yang Dilakukan

### 1. Mode Hybrid - Router Detection
**File**: `/home/enos/cvlmedia/routes/adminHotspot.js`

- **Sebelum**: Mode RADIUS tidak mengambil router dari database sama sekali
- **Sesudah**: Mode RADIUS dengan Server Hotspot tertentu akan:
  1. Mencari router yang memiliki Server Hotspot tersebut dari database `routers`
  2. Menggunakan router tersebut untuk mendapatkan informasi konfigurasi RADIUS yang tepat
  3. Memastikan koneksi ke FreeRADIUS menggunakan konfigurasi dari router yang benar

### 2. Menghapus Atribut Mikrotik-Server
**File**: `/home/enos/cvlmedia/config/mikrotik.js`

- Menghapus penambahan atribut `Mikrotik-Server` untuk voucher di mode RADIUS
- Atribut ini hanya diperlukan untuk mode Mikrotik API langsung, bukan untuk mode RADIUS
- Untuk mode RADIUS, semua voucher harus bisa digunakan di semua hotspot server yang dikonfigurasi untuk RADIUS

### 3. Script Cleanup
**File**: `/home/enos/cvlmedia/scripts/remove-mikrotik-server-attribute.js`

- Script untuk membersihkan atribut `Mikrotik-Server` dari voucher lama
- Menggunakan konfigurasi RADIUS yang sama dengan aplikasi utama

## Cara Memperbaiki Voucher Lama

Jalankan script cleanup untuk menghapus atribut `Mikrotik-Server` dari voucher yang sudah dibuat:

```bash
cd /home/enos/cvlmedia
node scripts/remove-mikrotik-server-attribute.js
```

## Verifikasi

1. **Restart aplikasi**:
   ```bash
   pm2 restart cvlmedia
   ```

2. **Test voucher baru**:
   - Buat voucher baru dengan memilih Server Hotspot tertentu
   - Coba login dengan voucher tersebut
   - Seharusnya berfungsi tanpa error "RADIUS server is not responding"

3. **Cek log**:
   - Log aplikasi akan menampilkan: `Found router for server hotspot "{server}": {router.name} ({router.nas_ip})`
   - Ini menunjukkan bahwa sistem berhasil menemukan router yang memiliki Server Hotspot tersebut

## Catatan Penting

1. **Mode Hybrid**: Server Hotspot dikelola via Mikrotik API, tapi voucher disimpan di RADIUS
2. **Router Detection**: Sistem otomatis mencari router yang memiliki Server Hotspot yang dipilih
3. **RADIUS Configuration**: Pastikan semua router di `/admin/routers` memiliki konfigurasi RADIUS yang benar
4. **Server Hotspot = "all"**: Jika memilih "all", sistem tidak akan mencari router spesifik (default RADIUS)

---

**Last Updated**: 2025-11-06
