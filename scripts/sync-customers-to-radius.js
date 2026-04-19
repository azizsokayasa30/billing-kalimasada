#!/usr/bin/env node
/**
 * Script untuk sync customer PPPoE credentials dari billing database ke RADIUS
 * 
 * Usage: node scripts/sync-customers-to-radius.js [--dry-run]
 */

const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');
const logger = require('../config/logger');

const DRY_RUN = process.argv.includes('--dry-run');

// Get RADIUS config from database
async function getRadiusConfig() {
    const dbPath = path.join(__dirname, '../data/billing.db');
    const db = new sqlite3.Database(dbPath);
    
    return new Promise((resolve, reject) => {
        const config = {};
        db.all('SELECT key, value FROM app_settings WHERE key LIKE "radius_%" OR key = "user_auth_mode"', [], (err, rows) => {
            db.close();
            if (err) {
                reject(err);
            } else {
                rows.forEach(row => {
                    config[row.key] = row.value;
                });
                resolve(config);
            }
        });
    });
}

// Get RADIUS connection
async function getRadiusConnection(config) {
    const host = config.radius_host || 'localhost';
    const user = config.radius_user || 'radius';
    const password = config.radius_password || 'radius';
    const database = config.radius_database || 'radius';
    
    return await mysql.createConnection({ host, user, password, database });
}

// Get customers with PPPoE username
async function getCustomersWithPPPoE() {
    const dbPath = path.join(__dirname, '../data/billing.db');
    const db = new sqlite3.Database(dbPath);
    
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT 
                id, 
                customer_id,
                username,
                pppoe_username, 
                name, 
                phone,
                pppoe_profile,
                status
            FROM customers 
            WHERE pppoe_username IS NOT NULL 
            AND pppoe_username != ''
            AND status = 'active'
            ORDER BY id
        `, [], (err, rows) => {
            db.close();
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

// Check if user exists in RADIUS
async function userExistsInRadius(conn, username) {
    const [rows] = await conn.execute(
        'SELECT COUNT(*) as count FROM radcheck WHERE username = ? AND attribute = "Cleartext-Password"',
        [username]
    );
    return rows[0].count > 0;
}

// Add user to RADIUS
async function addUserToRadius(conn, username, password, profile) {
    // Insert or update password
    await conn.execute(
        "INSERT INTO radcheck (username, attribute, op, value) VALUES (?, 'Cleartext-Password', ':=', ?) ON DUPLICATE KEY UPDATE value = ?",
        [username, password, password]
    );
    
    // Assign to group if profile provided
    if (profile) {
        const groupname = profile.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        
        // Remove existing group assignments
        await conn.execute(
            'DELETE FROM radusergroup WHERE username = ?',
            [username]
        );
        
        // Add new group assignment
        await conn.execute(
            'INSERT INTO radusergroup (username, groupname, priority) VALUES (?, ?, 1)',
            [username, groupname]
        );
    }
}

// Generate default password
function generatePassword(username) {
    // Use username as base, add some randomness
    return username + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

// Main function
async function main() {
    try {
        console.log('🔄 Starting sync customers to RADIUS...\n');
        
        // Get RADIUS config
        console.log('📋 Getting RADIUS configuration...');
        const radiusConfig = await getRadiusConfig();
        
        if (radiusConfig.user_auth_mode !== 'radius') {
            console.log('⚠️  Warning: user_auth_mode is not "radius", but continuing anyway...\n');
        }
        
        console.log(`   Host: ${radiusConfig.radius_host || 'localhost'}`);
        console.log(`   User: ${radiusConfig.radius_user || 'radius'}`);
        console.log(`   Database: ${radiusConfig.radius_database || 'radius'}\n`);
        
        // Get customers
        console.log('📋 Getting customers with PPPoE username...');
        const customers = await getCustomersWithPPPoE();
        console.log(`   Found ${customers.length} customers with PPPoE username\n`);
        
        if (customers.length === 0) {
            console.log('✅ No customers to sync');
            return;
        }
        
        // Connect to RADIUS
        console.log('🔌 Connecting to RADIUS database...');
        const radiusConn = await getRadiusConnection(radiusConfig);
        console.log('✅ Connected to RADIUS\n');
        
        // Get existing users in RADIUS
        console.log('📋 Checking existing users in RADIUS...');
        const [existingUsers] = await radiusConn.execute(
            'SELECT DISTINCT username FROM radcheck WHERE attribute = "Cleartext-Password"'
        );
        const existingUsernames = new Set(existingUsers.map(u => u.username));
        console.log(`   Found ${existingUsernames.size} existing users in RADIUS\n`);
        
        // Process each customer
        let synced = 0;
        let skipped = 0;
        let errors = 0;
        
        console.log('🔄 Syncing customers...\n');
        
        for (const customer of customers) {
            const username = customer.pppoe_username;
            const exists = existingUsernames.has(username);
            
            try {
                if (exists) {
                    console.log(`⏭️  [SKIP] ${username} (${customer.name}) - Already exists in RADIUS`);
                    skipped++;
                } else {
                    // Generate password (you might want to get from billing if stored)
                    const password = generatePassword(username);
                    const profile = customer.pppoe_profile || 'default';
                    
                    if (DRY_RUN) {
                        console.log(`🔍 [DRY-RUN] Would sync: ${username} (${customer.name}) - Profile: ${profile}`);
                        console.log(`   Password yang akan dibuat: ${password}`);
                    } else {
                        await addUserToRadius(radiusConn, username, password, profile);
                        console.log(`✅ [SYNCED] ${username} (${customer.name}) - Profile: ${profile}`);
                        console.log(`   📝 Password: ${password}`);
                        console.log(`   ⚠️  SIMPAN PASSWORD INI! Password bisa dilihat di halaman detail customer`);
                    }
                    synced++;
                }
            } catch (error) {
                console.error(`❌ [ERROR] ${username} (${customer.name}): ${error.message}`);
                errors++;
            }
        }
        
        await radiusConn.end();
        
        console.log('\n📊 Summary:');
        console.log(`   Total customers: ${customers.length}`);
        console.log(`   Synced: ${synced}`);
        console.log(`   Skipped: ${skipped}`);
        console.log(`   Errors: ${errors}`);
        
        if (DRY_RUN) {
            console.log('\n⚠️  DRY-RUN mode: No changes were made');
            console.log('   Run without --dry-run to actually sync');
        } else {
            console.log('\n✅ Sync completed!');
            console.log('\n📋 Cara Melihat Password PPPoE:');
            console.log('   1. Buka halaman detail customer: /admin/billing/customers/[phone]');
            console.log('   2. Password akan ditampilkan di bagian "Informasi Pelanggan"');
            console.log('   3. Klik tombol mata (👁️) untuk melihat password');
            console.log('   4. Klik tombol clipboard (📋) untuk copy password');
            console.log('\n💡 Password disimpan di database RADIUS, bukan di billing database');
            console.log('   Sistem akan otomatis mengambil password dari RADIUS saat dibutuhkan');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run
main();

