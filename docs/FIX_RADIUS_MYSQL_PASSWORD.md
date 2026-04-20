# 🔧 Fix: FreeRADIUS Tidak Bisa Connect ke MySQL

## 📋 Masalah

FreeRADIUS mendapat error:
```
rlm_sql_mysql: Couldn't connect to MySQL server radius@localhost:radius
rlm_sql_mysql: MySQL error: Access denied for user 'radius'@'localhost' (using password: YES)
```

Ini menyebabkan semua user mendapat **Access-Reject** meskipun user ada di database.

## 🔍 Root Cause

Password user `radius` di MySQL tidak cocok dengan password yang dikonfigurasi di FreeRADIUS (`/etc/freeradius/3.0/mods-available/sql`).

**Password yang dikonfigurasi di FreeRADIUS:**
- File: `/etc/freeradius/3.0/mods-available/sql`
- Line 163-164: `login = "radius"` dan `password = "oynFhZz8yD9zZ9jQF3CIdwi1d"`

## ✅ Solusi

### Opsi 1: Reset Password User 'radius' di MySQL (Recommended)

**Langkah 1: Login ke MySQL sebagai root**

```bash
# Coba dengan password dari file credentials
sudo mysql -u root -p'AUfxVJoXDhzAsUeOVLeIfZL85'

# Atau jika tidak berhasil, coba tanpa password
sudo mysql -u root

# Atau gunakan socket authentication
sudo mysql
```

**Langkah 2: Reset password user 'radius'**

```sql
-- Untuk MySQL 5.7+ / MariaDB 10.2+
ALTER USER 'radius'@'localhost' IDENTIFIED BY 'oynFhZz8yD9zZ9jQF3CIdwi1d';
FLUSH PRIVILEGES;

-- Atau untuk versi lama
SET PASSWORD FOR 'radius'@'localhost' = PASSWORD('oynFhZz8yD9zZ9jQF3CIdwi1d');
FLUSH PRIVILEGES;
```

**Langkah 3: Pastikan privileges benar**

```sql
GRANT ALL PRIVILEGES ON radius.* TO 'radius'@'localhost';
FLUSH PRIVILEGES;
```

**Langkah 4: Test koneksi**

```bash
mysql -u radius -p'oynFhZz8yD9zZ9jQF3CIdwi1d' -e "SELECT 'Connection successful' as status;"
```

**Langkah 5: Restart FreeRADIUS**

```bash
sudo systemctl restart freeradius
sudo systemctl status freeradius
```

**Langkah 6: Test authentication**

```bash
radtest 1KBML 1KBML 127.0.0.1 0 testing123
```

### Opsi 2: Update Password di FreeRADIUS Config

Jika password MySQL sudah benar dan berbeda dari yang di FreeRADIUS:

**Langkah 1: Edit file konfigurasi FreeRADIUS**

```bash
sudo nano /etc/freeradius/3.0/mods-available/sql
```

**Langkah 2: Update password di line 164**

```conf
login = "radius"
password = "PASSWORD_MYSQL_YANG_BENAR"
```

**Langkah 3: Restart FreeRADIUS**

```bash
sudo systemctl restart freeradius
```

### Opsi 3: Buat User Baru (Jika user 'radius' tidak ada)

```sql
CREATE USER 'radius'@'localhost' IDENTIFIED BY 'oynFhZz8yD9zZ9jQF3CIdwi1d';
GRANT ALL PRIVILEGES ON radius.* TO 'radius'@'localhost';
FLUSH PRIVILEGES;
```

## 🧪 Verifikasi

Setelah perbaikan, test dengan:

```bash
# 1. Test koneksi MySQL
mysql -u radius -p'oynFhZz8yD9zZ9jQF3CIdwi1d' -e "SELECT COUNT(*) FROM radcheck;"

# 2. Test FreeRADIUS authentication
radtest 1KBML 1KBML 127.0.0.1 0 testing123

# 3. Cek log FreeRADIUS
sudo tail -f /var/log/freeradius/radius.log
```

**Expected Result:**
- ✅ Koneksi MySQL berhasil
- ✅ `Access-Accept` (bukan `Access-Reject`)
- ✅ Tidak ada error SQL di log

## 📝 Catatan

1. **File Credentials**: Password root MySQL ada di `/root/.freeradius_credentials`
   - `MARIADB_ROOT_PASSWORD="AUfxVJoXDhzAsUeOVLeIfZL85"`
   - `RADIUS_DB_PASSWORD="oynFhZz8yD9zZ9jQF3CIdwi1d"`

2. **Jika root password tidak bekerja**: Mungkin password sudah berubah. Coba:
   - Login tanpa password: `sudo mysql`
   - Atau reset root password jika perlu

3. **Security**: Setelah perbaikan, pastikan file credentials aman:
   ```bash
   sudo chmod 600 /root/.freeradius_credentials
   ```

## 🔥 Quick Fix Script

Jalankan script untuk auto-fix:

```bash
cd /home/enos/cvlmedia
sudo bash scripts/fix-radius-mysql-password.sh
```

**Note**: Script memerlukan akses root MySQL. Jika root password tidak bekerja, jalankan perintah SQL secara manual.

---

**Last Updated**: 2025-12-08

