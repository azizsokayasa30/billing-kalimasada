#!/usr/bin/env node

/**
 * Script untuk membuat tabel voucher_revenue jika belum ada
 * Tabel ini sangat penting untuk membedakan voucher hotspot dari PPPoE users
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🔧 Creating voucher_revenue table if not exists...\n');

// Path ke database
const dbPath = path.join(__dirname, '../data/billing.db');

// Pastikan direktori data ada
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created data directory');
}

// Koneksi ke database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error connecting to database:', err);
        process.exit(1);
    } else {
        console.log('✅ Connected to billing database');
    }
});

// Fungsi untuk cek apakah tabel sudah ada
function checkTableExists(tableName) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
            if (err) reject(err);
            else resolve(!!row);
        });
    });
}

// Fungsi untuk membuat tabel voucher_revenue
async function createVoucherRevenueTable() {
    return new Promise((resolve, reject) => {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS voucher_revenue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                price DECIMAL(10,2) NOT NULL DEFAULT 0,
                profile TEXT,
                status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'paid')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                used_at DATETIME,
                usage_count INTEGER DEFAULT 0,
                notes TEXT
            )
        `;
        
        db.run(createTableSQL, (err) => {
            if (err) {
                reject(err);
            } else {
                console.log('✅ voucher_revenue table created or already exists');
                resolve();
            }
        });
    });
}

// Fungsi untuk membuat index
async function createIndexes() {
    return new Promise((resolve, reject) => {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_voucher_revenue_username ON voucher_revenue(username)',
            'CREATE INDEX IF NOT EXISTS idx_voucher_revenue_status ON voucher_revenue(status)',
            'CREATE INDEX IF NOT EXISTS idx_voucher_revenue_created_at ON voucher_revenue(created_at)'
        ];
        
        let completed = 0;
        indexes.forEach((indexSQL, index) => {
            db.run(indexSQL, (err) => {
                if (err) {
                    console.error(`❌ Error creating index ${index + 1}:`, err.message);
                } else {
                    console.log(`✅ Index ${index + 1} created or already exists`);
                }
                completed++;
                if (completed === indexes.length) {
                    resolve();
                }
            });
        });
    });
}

// Fungsi utama
async function main() {
    try {
        // Cek apakah tabel sudah ada
        const tableExists = await checkTableExists('voucher_revenue');
        
        if (tableExists) {
            console.log('ℹ️  voucher_revenue table already exists');
        } else {
            console.log('📝 Creating voucher_revenue table...');
        }
        
        // Buat tabel (IF NOT EXISTS akan skip jika sudah ada)
        await createVoucherRevenueTable();
        
        // Buat index
        console.log('\n📊 Creating indexes...');
        await createIndexes();
        
        // Verifikasi tabel sudah dibuat dengan benar
        const verifyExists = await checkTableExists('voucher_revenue');
        if (verifyExists) {
            console.log('\n✅ voucher_revenue table setup completed successfully!');
            
            // Cek apakah ada data
            db.get('SELECT COUNT(*) as count FROM voucher_revenue', [], (err, row) => {
                if (err) {
                    console.error('❌ Error checking voucher count:', err.message);
                } else {
                    console.log(`📊 Current voucher records: ${row.count}`);
                }
                db.close();
                process.exit(0);
            });
        } else {
            console.error('\n❌ Failed to create voucher_revenue table');
            db.close();
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        db.close();
        process.exit(1);
    }
}

// Jalankan script
main();

