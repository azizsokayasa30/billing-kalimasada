# 📝 Custom Reply Message untuk Log Mikrotik

## 📋 Tujuan

Membedakan pesan error di log Mikrotik berdasarkan jenis masalah:
- **Voucher Expired** → "Voucher Expired"
- **Durasi/Uptime Habis** → "Durasi Voucher Telah Habis"
- **Server Error** → Tetap "Radius Not Responding" atau pesan error lainnya

## ✅ Perubahan yang Dilakukan

### 1. Update Post-Auth-Type REJECT (`/etc/freeradius/3.0/sites-enabled/default`)

Konfigurasi untuk menangkap dan mengubah Reply-Message berdasarkan jenis error:

```conf
Post-Auth-Type REJECT {
    foreach reply:Reply-Message {
        # Durasi/Uptime habis (Max-All-Session)
        if ("%{Foreach-Variable-0}" =~ /maximum\s+never\s+usage\s+time|maximum\s+all\s+session/i) {
            update reply {
                Reply-Message !* ANY
                Reply-Message := "Durasi Voucher Telah Habis"
            }
            break
        }

        # Voucher expired (Expire-After)
        if ("%{Foreach-Variable-0}" =~ /password\s+has\s+expired|session\s+has\s+expired|account\s+has\s+expired|expire.*after/i) {
            update reply {
                Reply-Message !* ANY
                Reply-Message := "Voucher Expired"
            }
            break
        }
    }
    
    # ... rest of config
}
```

### 2. Update SQL Counter Config (`/etc/freeradius/3.0/mods-enabled/sqlcounter`)

#### noresetcounter (Max-All-Session - Durasi Habis):
```conf
sqlcounter noresetcounter {
    sql_module_instance = sql
    dialect = mysql
    counter_name = Max-All-Session-Time
    check_name = Max-All-Session
    key = User-Name
    reset = never
    reply-message = "Durasi Voucher Telah Habis"
    $INCLUDE ${modconfdir}/sql/counter/${dialect}/${.:instance}.conf
}
```

#### expire_on_login (Expire-After - Voucher Expired):
```conf
sqlcounter expire_on_login {
    sql_module_instance = sql
    dialect = mysql
    counter_name = Expire-After-Initial-Login
    check_name = Expire-After
    key = User-Name
    reset = never
    reply-message = "Voucher Expired"
    $INCLUDE ${modconfdir}/sql/counter/${dialect}/${.:instance}.conf
}
```

## 🔄 Cara Kerja

### Alur Proses:

1. **User mencoba login** dengan voucher yang sudah expired/habis durasi
2. **FreeRADIUS memproses request**:
   - `noresetcounter` mengecek Max-All-Session (durasi)
   - `expire_on_login` mengecek Expire-After (validity)
3. **Jika limit habis**, sqlcounter mengirim Reply-Message:
   - Durasi habis → "Durasi Voucher Telah Habis"
   - Expired → "Voucher Expired"
4. **Post-Auth-Type REJECT** menangkap Reply-Message dan memastikan pesan yang benar dikirim
5. **Mikrotik menerima Access-Reject** dengan Reply-Message yang sesuai
6. **Log Mikrotik menampilkan** pesan yang jelas sesuai jenis masalah

## 📊 Mapping Error Messages

| Jenis Masalah | Attribute | Reply-Message | Log Mikrotik |
|---------------|-----------|---------------|--------------|
| Durasi Habis | Max-All-Session | "Durasi Voucher Telah Habis" | "Durasi Voucher Telah Habis" |
| Voucher Expired | Expire-After | "Voucher Expired" | "Voucher Expired" |
| Server Error | - | "Radius Not Responding" | "Radius Not Responding" |
| Password Salah | - | "Akses ditolak" | "Akses ditolak" |

## 🧪 Testing

### Test Durasi Habis:

1. Buat voucher dengan Max-All-Session = 60 detik
2. Login dan gunakan sampai 60 detik
3. Coba login lagi
4. **Expected**: Log Mikrotik menampilkan "Durasi Voucher Telah Habis"

### Test Voucher Expired:

1. Buat voucher dengan Expire-After = 1 jam
2. Tunggu 1 jam setelah first login
3. Coba login lagi
4. **Expected**: Log Mikrotik menampilkan "Voucher Expired"

### Test Server Error:

1. Stop FreeRADIUS service
2. Coba login
3. **Expected**: Log Mikrotik menampilkan "Radius Not Responding"

## 📝 Catatan Penting

1. **Reply-Message dikirim dalam Access-Reject packet** dari FreeRADIUS ke Mikrotik
2. **Mikrotik akan menampilkan Reply-Message di log** jika dikonfigurasi dengan benar
3. **Pastikan Mikrotik menggunakan RADIUS** untuk authentication (bukan local)
4. **Restart FreeRADIUS** setelah perubahan konfigurasi

## 🔧 Troubleshooting

### Masalah: Log Mikrotik masih menampilkan "Radius Not Responding" untuk semua error

**Solusi:**
1. Pastikan FreeRADIUS mengirim Reply-Message dengan benar:
   ```bash
   # Test dengan radtest
   radtest username password 127.0.0.1 0 testing123
   # Cek apakah ada Reply-Message di response
   ```

2. Pastikan Mikrotik menggunakan RADIUS:
   ```bash
   # Di Mikrotik
   /ip hotspot
   print
   # Pastikan use-radius=yes
   ```

3. Cek log FreeRADIUS:
   ```bash
   tail -f /var/log/freeradius/radius.log
   # Cek apakah Reply-Message dikirim
   ```

### Masalah: Pesan tidak sesuai dengan jenis error

**Solusi:**
1. Cek konfigurasi sqlcounter:
   ```bash
   cat /etc/freeradius/3.0/mods-enabled/sqlcounter | grep reply-message
   ```

2. Cek Post-Auth-Type REJECT:
   ```bash
   grep -A 20 "Post-Auth-Type REJECT" /etc/freeradius/3.0/sites-enabled/default
   ```

3. Restart FreeRADIUS:
   ```bash
   systemctl restart freeradius
   ```

## 📚 File yang Dimodifikasi

1. `/etc/freeradius/3.0/sites-enabled/default`
   - Update Post-Auth-Type REJECT untuk menangkap dan mengubah Reply-Message

2. `/etc/freeradius/3.0/mods-enabled/sqlcounter`
   - Update `noresetcounter` reply-message
   - Tambahkan `expire_on_login` reply-message

---

**Last Updated**: 2025-12-08

