-- Migration: Create Member System tables
-- Date: 2025-01-27
-- Description: Create tables for managing Member packages and Members (Hotspot-based authentication)
-- Author: AI Assistant

-- Tabel Paket Member (mirip dengan packages untuk PPPoE)
CREATE TABLE IF NOT EXISTS member_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    speed TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 11.00,
    description TEXT,
    hotspot_profile TEXT DEFAULT 'default',
    upload_limit TEXT,
    download_limit TEXT,
    burst_limit_upload TEXT,
    burst_limit_download TEXT,
    burst_threshold TEXT,
    burst_time TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Members (mirip dengan customers untuk PPPoE, tapi menggunakan Hotspot)
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    hotspot_username TEXT,
    email TEXT,
    address TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    package_id INTEGER,
    hotspot_profile TEXT,
    status TEXT DEFAULT 'active',
    join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    server_hotspot TEXT,
    auto_suspension BOOLEAN DEFAULT 1,
    billing_day INTEGER DEFAULT 15,
    renewal_type TEXT DEFAULT 'renewal',
    fix_date INTEGER,
    FOREIGN KEY (package_id) REFERENCES member_packages (id)
);

-- Index untuk mempercepat query
CREATE INDEX IF NOT EXISTS idx_members_package_id ON members(package_id);
CREATE INDEX IF NOT EXISTS idx_members_hotspot_username ON members(hotspot_username);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_member_packages_is_active ON member_packages(is_active);
