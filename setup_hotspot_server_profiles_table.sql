-- Script untuk membuat tabel hotspot_server_profiles dan memberikan permission
-- HARUS dijalankan sebagai root MariaDB

-- 1. Buat tabel hotspot_server_profiles (jika belum ada)
CREATE TABLE IF NOT EXISTS radius.hotspot_server_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    rate_limit VARCHAR(255),
    session_timeout VARCHAR(64),
    idle_timeout VARCHAR(64),
    shared_users INT DEFAULT 1,
    open_status_page VARCHAR(64) DEFAULT 'http-login',
    http_cookie_lifetime INT DEFAULT 0,
    split_user_domain TINYINT(1) DEFAULT 0,
    status_autorefresh VARCHAR(64) DEFAULT 'none',
    copy_from VARCHAR(64),
    disabled TINYINT(1) DEFAULT 0,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_disabled (disabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Berikan permission SELECT, INSERT, UPDATE, DELETE pada user billing
-- (TIDAK termasuk CREATE untuk security)
GRANT SELECT, INSERT, UPDATE, DELETE ON radius.hotspot_server_profiles TO 'billing'@'localhost';

-- 3. Flush privileges agar permission langsung aktif
FLUSH PRIVILEGES;

-- 4. Verifikasi permission sudah diberikan
SHOW GRANTS FOR 'billing'@'localhost';

-- 5. Verifikasi tabel sudah dibuat
SHOW TABLES FROM radius LIKE 'hotspot_server_profiles';

-- 6. Cek struktur tabel
DESCRIBE radius.hotspot_server_profiles;

