-- Grant permission untuk user 'billing' pada tabel hotspot_server_profiles
-- Script ini perlu dijalankan sebagai root MariaDB

-- Pastikan tabel sudah dibuat terlebih dahulu (akan dibuat otomatis oleh aplikasi jika belum ada)
-- Jika belum ada, buat dengan script aplikasi atau buat manual:

GRANT SELECT, INSERT, UPDATE, DELETE ON radius.hotspot_server_profiles TO 'billing'@'localhost';
FLUSH PRIVILEGES;

-- Verifikasi permission
SHOW GRANTS FOR 'billing'@'localhost';

