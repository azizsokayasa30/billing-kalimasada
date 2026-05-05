# 🔧 Fix: "RADIUS server is not responding" untuk Voucher Expired

## 📋 Masalah

Ketika voucher sudah expired atau durasi habis, log Mikrotik menampilkan:
- ❌ "RADIUS server is not responding" 
- ❌ Bukan "Voucher Expired" atau "Durasi Voucher Telah Habis"

Ini menyebabkan tidak bisa membedakan antara:
- Server error (benar-benar tidak merespons)
- Voucher expired (server merespons tapi dengan delay)

## 🔍 Root Cause

FreeRADIUS memiliki setting `reject_delay = 1` di `radiusd.conf` yang menyebabkan:
1. FreeRADIUS menunda pengiriman Access-Reject selama **1 detik**
2. Jika timeout di Mikrotik lebih pendek dari 1 detik, Mikrotik menganggap server tidak merespons
3. Mikrotik menampilkan "RADIUS server is not responding" **sebelum** FreeRADIUS sempat mengirim balasan
4. Reply-Message yang sudah dikonfigurasi tidak sampai ke Mikrotik

## ✅ Solusi

### Ubah `reject_delay` menjadi 0

Edit `/etc/freeradius/3.0/radiusd.conf`:

```conf
# Set to 0 to send reject immediately (important for Mikrotik to receive Reply-Message)
reject_delay = 0
```

**Sebelum:**
```conf
reject_delay = 1  # Delay 1 detik
```

**Sesudah:**
```conf
reject_delay = 0  # Langsung kirim tanpa delay
```

### Restart FreeRADIUS

```bash
systemctl restart freeradius
```

## 🎯 Hasil

Setelah perubahan:

| Kondisi | Sebelum | Sesudah |
|---------|---------|---------|
| Voucher Expired | "RADIUS server is not responding" | "Voucher Expired" |
| Durasi Habis | "RADIUS server is not responding" | "Durasi Voucher Telah Habis" |
| Server Error | "RADIUS server is not responding" | "RADIUS server is not responding" |

Sekarang bisa membedakan dengan jelas!

## 📝 Catatan

### Trade-off Security

**Sebelum (reject_delay = 1):**
- ✅ Lebih aman (slow down brute force attacks)
- ❌ Mikrotik timeout sebelum menerima Reply-Message
- ❌ Tidak bisa membedakan error types

**Sesudah (reject_delay = 0):**
- ✅ Mikrotik langsung menerima Reply-Message
- ✅ Bisa membedakan error types dengan jelas
- ⚠️ Sedikit kurang aman (tidak ada delay untuk brute force)

**Rekomendasi:** Untuk production dengan banyak user, lebih baik `reject_delay = 0` agar error message jelas dan user experience lebih baik.

### Alternatif: Increase Timeout di Mikrotik

Jika tetap ingin menggunakan `reject_delay = 1`, bisa increase timeout di Mikrotik:

```bash
# Di Mikrotik
/radius
set [find name="freeradius-server"] timeout=5s
```

Tapi ini tidak disarankan karena:
- Masih ada delay 1 detik yang tidak perlu
- User experience kurang baik
- Tetap tidak bisa membedakan error types dengan jelas

## 🧪 Testing

### Test Voucher Expired:

```bash
# Test dengan radtest
radtest 1KBML 1KBML 127.0.0.1 0 testing123

# Expected output:
# Received Access-Reject Id X from 127.0.0.1:1812
#   Reply-Message = "Voucher Expired"
```

### Test di Mikrotik:

1. Login dengan voucher yang sudah expired
2. Cek log Mikrotik
3. **Expected**: "Voucher Expired" (bukan "RADIUS server is not responding")

## 📚 File yang Dimodifikasi

- `/etc/freeradius/3.0/radiusd.conf`
  - Changed: `reject_delay = 1` → `reject_delay = 0`

---

**Last Updated**: 2025-12-08

