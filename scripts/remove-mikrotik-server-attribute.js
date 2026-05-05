#!/usr/bin/env node

/**
 * Script untuk menghapus atribut Mikrotik-Server dari voucher yang sudah dibuat
 * Atribut ini tidak diperlukan untuk mode RADIUS dan dapat menyebabkan masalah
 * 
 * Usage: node scripts/remove-mikrotik-server-attribute.js
 */

const mysql = require('mysql2/promise');
const path = require('path');

// Load settings to get database credentials
async function getRadiusConfig() {
    // Prioritaskan ambil dari database (app_settings), fallback ke settings.json
    let radiusConfig;
    try {
        const { getRadiusConfig } = require('../config/radiusConfig');
        radiusConfig = await getRadiusConfig();
    } catch (e) {
        // Fallback ke settings.json jika database tidak bisa diakses
        console.warn('Failed to get radius config from database, using settings.json fallback:', e.message);
        const fs = require('fs');
        const settingsPath = path.join(__dirname, '../settings.json');
        if (!fs.existsSync(settingsPath)) {
            throw new Error('settings.json not found');
        }
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const { getSetting } = require('../config/settingsManager');
        radiusConfig = {
            radius_host: getSetting('radius_host', 'localhost'),
            radius_user: getSetting('radius_user', 'radius'),
            radius_password: getSetting('radius_password', 'radius'),
            radius_database: getSetting('radius_database', 'radius')
        };
    }
    
    return {
        host: radiusConfig.radius_host || 'localhost',
        user: radiusConfig.radius_user || 'radius',
        password: radiusConfig.radius_password || 'radius',
        database: radiusConfig.radius_database || 'radius'
    };
}

async function removeMikrotikServerAttribute() {
    let conn = null;
    try {
        const config = await getRadiusConfig();
        
        console.log('Connecting to RADIUS database...');
        console.log(`Host: ${config.host}`);
        console.log(`User: ${config.user}`);
        console.log(`Database: ${config.database}`);
        
        conn = await mysql.createConnection(config);
        
        // Cek berapa banyak voucher yang memiliki atribut Mikrotik-Server
        const [countResult] = await conn.execute(
            "SELECT COUNT(*) as count FROM radreply WHERE attribute = 'Mikrotik-Server'"
        );
        const count = countResult[0].count;
        
        console.log(`Found ${count} vouchers with Mikrotik-Server attribute`);
        
        if (count === 0) {
            console.log('No vouchers with Mikrotik-Server attribute found. Nothing to remove.');
            return;
        }
        
        // Tampilkan beberapa contoh voucher yang akan dihapus
        const [examples] = await conn.execute(
            "SELECT username, value FROM radreply WHERE attribute = 'Mikrotik-Server' LIMIT 5"
        );
        
        console.log('\nExamples of vouchers that will be affected:');
        examples.forEach(row => {
            console.log(`  - ${row.username}: ${row.value}`);
        });
        
        // Hapus atribut Mikrotik-Server
        console.log('\nRemoving Mikrotik-Server attribute from all vouchers...');
        const [result] = await conn.execute(
            "DELETE FROM radreply WHERE attribute = 'Mikrotik-Server'"
        );
        
        console.log(`✓ Successfully removed Mikrotik-Server attribute from ${result.affectedRows} vouchers`);
        console.log('\nVouchers should now work correctly with RADIUS authentication.');
        console.log('Please test by logging in with one of the affected vouchers.');
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        if (conn) {
            await conn.end();
        }
    }
}

// Run script
removeMikrotikServerAttribute()
    .then(() => {
        console.log('\nScript completed successfully.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });

