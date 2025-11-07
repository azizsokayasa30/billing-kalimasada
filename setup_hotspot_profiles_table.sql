-- Script untuk membuat tabel hotspot_profiles yang menyimpan metadata profile hotspot (mode RADIUS)

-- 1. Buat tabel hotspot_profiles di database RADIUS
CREATE TABLE IF NOT EXISTS radius.hotspot_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    groupname VARCHAR(128) NOT NULL UNIQUE,
    display_name VARCHAR(128) NOT NULL,
    comment TEXT NULL,
    rate_limit_value VARCHAR(32) NULL,
    rate_limit_unit VARCHAR(8) NULL,
    burst_limit_value VARCHAR(32) NULL,
    burst_limit_unit VARCHAR(8) NULL,
    session_timeout_value VARCHAR(32) NULL,
    session_timeout_unit VARCHAR(8) NULL,
    idle_timeout_value VARCHAR(32) NULL,
    idle_timeout_unit VARCHAR(8) NULL,
    shared_users VARCHAR(16) NULL,
    local_address VARCHAR(64) NULL,
    remote_address VARCHAR(64) NULL,
    dns_server VARCHAR(128) NULL,
    parent_queue VARCHAR(128) NULL,
    address_list VARCHAR(128) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Berikan hak akses ke user billing & radius (optional sesuaikan dengan environment)
GRANT SELECT, INSERT, UPDATE, DELETE ON radius.hotspot_profiles TO 'billing'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON radius.hotspot_profiles TO 'radius'@'localhost';

-- 3. Verifikasi
SHOW TABLES FROM radius LIKE 'hotspot_profiles';
DESCRIBE radius.hotspot_profiles;

