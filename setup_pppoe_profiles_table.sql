-- Script untuk membuat tabel pppoe_profiles yang menyimpan metadata profile PPPoE (mode RADIUS)

-- 1. Buat tabel pppoe_profiles di database RADIUS
CREATE TABLE IF NOT EXISTS radius.pppoe_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    groupname VARCHAR(128) NOT NULL UNIQUE,
    display_name VARCHAR(128) NOT NULL,
    comment TEXT NULL,
    rate_limit VARCHAR(128) NULL,
    local_address VARCHAR(64) NULL,
    remote_address VARCHAR(64) NULL,
    dns_server VARCHAR(128) NULL,
    parent_queue VARCHAR(128) NULL,
    address_list VARCHAR(128) NULL,
    bridge_learning VARCHAR(16) NOT NULL DEFAULT 'default',
    use_mpls VARCHAR(16) NOT NULL DEFAULT 'default',
    use_compression VARCHAR(16) NOT NULL DEFAULT 'default',
    use_encryption VARCHAR(16) NOT NULL DEFAULT 'default',
    only_one VARCHAR(16) NOT NULL DEFAULT 'default',
    change_tcp_mss VARCHAR(16) NOT NULL DEFAULT 'default',
    use_upnp VARCHAR(16) NOT NULL DEFAULT 'default',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Berikan hak akses ke user billing & radius (sesuaikan jika perlu)
GRANT SELECT, INSERT, UPDATE, DELETE ON radius.pppoe_profiles TO 'billing'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON radius.pppoe_profiles TO 'radius'@'localhost';

-- 3. Verifikasi
SHOW TABLES FROM radius LIKE 'pppoe_profiles';
DESCRIBE radius.pppoe_profiles;

