#!/usr/bin/env node

/**
 * Script untuk memperbaiki rate-limit yang bermasalah dengan menghapus threshold
 * Format: "30M/30M 40M/40M 35M 10s" -> "30M/30M 40M/40M 10s"
 */

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// Load settings
let settings = {};
try {
    const settingsPath = path.join(__dirname, '../settings.json');
    if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
} catch (e) {
    console.error('Error loading settings.json:', e.message);
    process.exit(1);
}

// Get RADIUS config from settings or database
async function getRadiusConfig() {
    let radiusConfig = {
        radius_host: settings.radius_host || 'localhost',
        radius_user: settings.radius_user || 'radius',
        radius_password: settings.radius_password || 'radius',
        radius_database: settings.radius_database || 'radius'
    };
    
    // Try to get from database if available
    try {
        const { getRadiusConfig } = require('../config/radiusConfig');
        const dbConfig = await getRadiusConfig();
        if (dbConfig) {
            radiusConfig = dbConfig;
        }
    } catch (e) {
        console.log('Using settings.json for RADIUS config');
    }
    
    return radiusConfig;
}

async function fixRateLimitFormat() {
    try {
        const radiusConfig = await getRadiusConfig();
        
        console.log('🔍 Connecting to RADIUS database...');
        const conn = await mysql.createConnection({
            host: radiusConfig.radius_host || 'localhost',
            user: radiusConfig.radius_user || 'radius',
            password: radiusConfig.radius_password || 'radius',
            database: radiusConfig.radius_database || 'radius'
        });
        
        console.log('✅ Connected to RADIUS database');
        
        // Get current rate-limit for paket-30mbps
        const [rows] = await conn.execute(`
            SELECT value 
            FROM radgroupreply 
            WHERE groupname = 'paket-30mbps' AND attribute = 'MikroTik-Rate-Limit'
        `);
        
        if (rows.length === 0) {
            console.log('❌ Rate-limit untuk paket-30mbps tidak ditemukan');
            await conn.end();
            return;
        }
        
        const currentValue = rows[0].value;
        console.log(`\n📋 Current rate-limit: ${currentValue}`);
        
        // Parse: "30M/30M 40M/40M 35M 10s"
        // Remove threshold (35M) and keep: "30M/30M 40M/40M 10s"
        const parts = currentValue.trim().split(/\s+/);
        
        if (parts.length === 4 && parts[parts.length - 1].match(/^\d+[smhd]$/i)) {
            // Format: "base burst threshold time"
            // Remove threshold, keep: "base burst time"
            const baseLimit = parts[0]; // "30M/30M"
            const burstLimit = parts[1]; // "40M/40M"
            const burstTime = parts[3]; // "10s"
            
            const newFormat = `${baseLimit} ${burstLimit} ${burstTime}`;
            console.log(`\n🔧 Fixing format:`);
            console.log(`   Old: ${currentValue}`);
            console.log(`   New: ${newFormat}`);
            
            await conn.execute(`
                UPDATE radgroupreply 
                SET value = ? 
                WHERE groupname = 'paket-30mbps' AND attribute = 'MikroTik-Rate-Limit'
            `, [newFormat]);
            
            console.log(`\n✅ Rate-limit berhasil diperbaiki!`);
            console.log(`\n📝 Catatan: Threshold dihapus karena mungkin menyebabkan error di Mikrotik.`);
            console.log(`   Jika masih error, coba hapus burst sama sekali dan gunakan format sederhana: ${baseLimit}`);
        } else {
            console.log(`\n⚠️  Format tidak sesuai ekspektasi. Parts:`, parts);
            console.log(`   Jika format sudah benar tapi masih error, kemungkinan masalahnya di Mikrotik queue configuration.`);
        }
        
        await conn.end();
        console.log('\n✅ Selesai!');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run script
if (require.main === module) {
    fixRateLimitFormat()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { fixRateLimitFormat };

