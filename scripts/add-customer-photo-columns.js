#!/usr/bin/env node

/**
 * Script untuk menambahkan kolom ktp_photo_path dan house_photo_path ke tabel customers
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../data/billing.db');

console.log('🔍 Adding photo columns to customers table...\n');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to database:', dbPath);
});

// Add columns
db.serialize(() => {
    // Add ktp_photo_path column
    db.run("ALTER TABLE customers ADD COLUMN ktp_photo_path TEXT", (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Error adding ktp_photo_path column:', err.message);
        } else if (!err) {
            console.log('✅ Added ktp_photo_path column');
        } else {
            console.log('ℹ️  ktp_photo_path column already exists');
        }
    });
    
    // Add house_photo_path column
    db.run("ALTER TABLE customers ADD COLUMN house_photo_path TEXT", (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Error adding house_photo_path column:', err.message);
        } else if (!err) {
            console.log('✅ Added house_photo_path column');
        } else {
            console.log('ℹ️  house_photo_path column already exists');
        }
        
        console.log('\n✅ Script completed!');
        db.close();
    });
});

