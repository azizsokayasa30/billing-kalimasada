#!/usr/bin/env node

/**
 * Seeder: Membuat akun Collector dan Technician untuk testing login di mobile app
 * 
 * Usage: node scripts/seed-users.js
 * Atau di Docker: docker exec gembok-bill node scripts/seed-users.js
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, '../data/billing.db');
const db = new sqlite3.Database(dbPath);

const SALT_ROUNDS = 10;

async function hashPassword(password) {
    return bcrypt.hashSync(password, SALT_ROUNDS);
}

async function seed() {
    console.log('🌱 Starting database seeder...\n');

    // 1. Ensure collectors table exists
    await new Promise((resolve, reject) => {
        db.run(`CREATE TABLE IF NOT EXISTS collectors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            email TEXT,
            password TEXT,
            area TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    // 2. Ensure technicians table has password column
    await new Promise((resolve) => {
        db.run(`ALTER TABLE technicians ADD COLUMN password TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column')) {
                console.log('ℹ️  password column:', err.message);
            } else if (!err) {
                console.log('✅ Added password column to technicians table');
            }
            resolve();
        });
    });

    // 2b. Ensure technicians table exists (if not created yet)
    await new Promise((resolve, reject) => {
        db.run(`CREATE TABLE IF NOT EXISTS technicians (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL DEFAULT 'technician',
            email TEXT,
            password TEXT,
            notes TEXT,
            is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
            area_coverage TEXT,
            whatsapp_group TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )`, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    // 3. Seed Collector
    const collectorPassword = hashPassword('collector123');
    try {
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO collectors (name, phone, email, password, area, status) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                ['Collector Demo', '6281368888498', 'collector@demo.com', collectorPassword, 'Bengkulu', 'active'],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
        console.log('✅ Collector seeded:');
        console.log('   📱 Phone/Username: 6281368888498');
        console.log('   🔑 Password: collector123\n');
    } catch (err) {
        console.log('⚠️  Collector already exists or error:', err.message);
    }

    // 4. Seed Technician
    const techPassword = hashPassword('tech123');
    try {
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO technicians (name, phone, role, password, is_active, area_coverage) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                ['Teknisi Demo', '6281368888498', 'technician', techPassword, 1, 'Bengkulu'],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
        console.log('✅ Technician seeded:');
        console.log('   📱 Phone/Username: 6281368888498');
        console.log('   🔑 Password: tech123\n');
    } catch (err) {
        console.log('⚠️  Technician already exists or error:', err.message);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 Login di Mobile App:');
    console.log('');
    console.log('  Collector:');
    console.log('    Username: 6281368888498');
    console.log('    Password: collector123');
    console.log('');
    console.log('  Technician:');
    console.log('    Username: 6281368888498');
    console.log('    Password: tech123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    db.close();
    console.log('\n🌱 Seeder completed!');
}

seed().catch(err => {
    console.error('❌ Seeder error:', err);
    db.close();
    process.exit(1);
});
