#!/usr/bin/env node

/**
 * Script untuk menambahkan kolom account_expenses ke tabel expenses
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../data/billing.db');

console.log('🔍 Adding account_expenses column to expenses table...\n');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to database:', dbPath);
});

// Check if column exists
db.all("PRAGMA table_info(expenses)", (err, columns) => {
    if (err) {
        console.error('❌ Error checking table info:', err.message);
        db.close();
        process.exit(1);
    }
    
    const hasAccountExpenses = columns.some(col => col.name === 'account_expenses');
    
    if (hasAccountExpenses) {
        console.log('✅ Column account_expenses already exists');
        console.log('\n✅ Script completed!');
        db.close();
    } else {
        // Add account_expenses column
        db.run(`
            ALTER TABLE expenses 
            ADD COLUMN account_expenses TEXT
        `, (err) => {
            if (err) {
                console.error('❌ Error adding account_expenses column:', err.message);
                db.close();
                process.exit(1);
            } else {
                console.log('✅ Column account_expenses added successfully');
                console.log('\n✅ Script completed!');
                db.close();
            }
        });
    }
});

