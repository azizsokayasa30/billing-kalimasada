#!/usr/bin/env node

/**
 * Script untuk memperbaiki issue "no download-burst-time" di Mikrotik
 * 
 * Masalah: Jika rate-limit memiliki burst_limit tapi tidak ada burst_time,
 * Mikrotik akan error "could not add queue: no download-burst-time (6)"
 * 
 * Solusi: Hapus burst dari rate-limit jika tidak ada burst_time,
 * atau tambahkan burst_time default jika diperlukan
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

async function fixBurstTimeIssues() {
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
        
        // First, let's see all rate-limit entries
        const [allRows] = await conn.execute(`
            SELECT groupname, value 
            FROM radgroupreply 
            WHERE attribute = 'MikroTik-Rate-Limit'
            ORDER BY groupname
        `);
        
        console.log(`\n📋 Total rate-limit entries: ${allRows.length}`);
        if (allRows.length > 0) {
            console.log('\nCurrent rate-limit entries:');
            allRows.forEach(r => {
                const parts = r.value.trim().split(/\s+/);
                const hasBurst = parts.length > 1;
                const lastPart = parts[parts.length - 1];
                const hasTimeUnit = /^[0-9]+[smhd]$/i.test(lastPart);
                const status = hasBurst && !hasTimeUnit ? '⚠️  BERMASALAH' : '✅';
                console.log(`  ${status} ${r.groupname}: ${r.value}`);
            });
        }
        
        // Find all rate-limit that have burst but no burst_time
        // Format yang bermasalah: "10M/10M 20M/20M" atau "10M/10M 20M/20M 50M"
        // Format yang benar: "10M/10M 20M/20M 50M 10s" (harus ada burst_time di akhir)
        console.log('\n🔍 Checking for problematic rate-limit entries...');
        
        const [rows] = await conn.execute(`
            SELECT groupname, value 
            FROM radgroupreply 
            WHERE attribute = 'MikroTik-Rate-Limit'
            AND value LIKE '%/%/%'
            AND (
                -- Burst ada tapi tidak ada burst_time (tidak ada unit waktu di akhir)
                (value NOT REGEXP '[0-9]+[smhd]$') OR
                -- Burst ada tapi hanya ada 2 bagian (download/upload burst-download/burst-upload) tanpa threshold dan time
                (value REGEXP '^[0-9]+[KMGTkmgt]?/[0-9]+[KMGTkmgt]? [0-9]+[KMGTkmgt]?/[0-9]+[KMGTkmgt]?$')
            )
            ORDER BY groupname
        `);
        
        if (rows.length === 0) {
            console.log('✅ Tidak ada rate-limit yang bermasalah ditemukan!');
        } else {
            console.log(`\n⚠️  Ditemukan ${rows.length} rate-limit yang bermasalah:\n`);
            
            let fixed = 0;
            let skipped = 0;
            
            for (const row of rows) {
                const { groupname, value } = row;
                const parts = value.trim().split(/\s+/);
                
                console.log(`\n📦 Group: ${groupname}`);
                console.log(`   Current: ${value}`);
                
                // Parse rate-limit
                // Format: "download/upload [burst-download/burst-upload] [threshold] [time]"
                const baseLimit = parts[0]; // "10M/10M"
                
                if (parts.length === 1) {
                    // Tidak ada burst, sudah benar
                    console.log(`   ✅ Tidak ada burst, sudah benar`);
                    skipped++;
                    continue;
                }
                
                // Cek apakah ada burst_time (bagian terakhir harus berupa waktu dengan unit)
                const lastPart = parts[parts.length - 1];
                const hasTimeUnit = /^[0-9]+[smhd]$/i.test(lastPart);
                
                if (!hasTimeUnit && parts.length >= 2) {
                    // Burst ada tapi tidak ada burst_time - HAPUS burst
                    console.log(`   ⚠️  Burst ditemukan tapi tidak ada burst_time`);
                    console.log(`   🔧 Memperbaiki: Menghapus burst, menggunakan base limit saja`);
                    
                    await conn.execute(`
                        UPDATE radgroupreply 
                        SET value = ? 
                        WHERE groupname = ? AND attribute = 'MikroTik-Rate-Limit'
                    `, [baseLimit, groupname]);
                    
                    console.log(`   ✅ Diperbaiki menjadi: ${baseLimit}`);
                    fixed++;
                } else {
                    console.log(`   ✅ Sudah benar (ada burst_time)`);
                    skipped++;
                }
            }
            
            console.log(`\n\n📊 Ringkasan:`);
            console.log(`   ✅ Diperbaiki: ${fixed}`);
            console.log(`   ⏭️  Dilewati: ${skipped}`);
            console.log(`   📦 Total: ${rows.length}`);
        }
        
        // Check user-specific rate-limit in radreply
        console.log('\n\n🔍 Checking user-specific rate-limit (radreply)...');
        const [userReplyRows] = await conn.execute(`
            SELECT username, value 
            FROM radreply 
            WHERE attribute = 'MikroTik-Rate-Limit'
            ORDER BY username
        `);
        
        if (userReplyRows.length > 0) {
            console.log(`\n📋 Found ${userReplyRows.length} user-specific rate-limit entries:`);
            userReplyRows.forEach(r => {
                const parts = r.value.trim().split(/\s+/);
                const hasBurst = parts.length > 1;
                const lastPart = parts[parts.length - 1];
                const hasTimeUnit = /^[0-9]+[smhd]$/i.test(lastPart);
                const status = hasBurst && !hasTimeUnit ? '⚠️  BERMASALAH' : '✅';
                console.log(`  ${status} ${r.username}: ${r.value}`);
            });
        } else {
            console.log('✅ Tidak ada user-specific rate-limit ditemukan');
        }
        
        // Check user 'enos' specifically
        console.log('\n\n🔍 Checking user "enos" configuration...');
        const [enosGroup] = await conn.execute(`
            SELECT groupname 
            FROM radusergroup 
            WHERE username = 'enos'
        `);
        
        if (enosGroup.length > 0) {
            console.log(`✅ User 'enos' menggunakan groupname: ${enosGroup[0].groupname}`);
            
            const [enosGroupReply] = await conn.execute(`
                SELECT attribute, value 
                FROM radgroupreply 
                WHERE groupname = ?
                AND attribute = 'MikroTik-Rate-Limit'
            `, [enosGroup[0].groupname]);
            
            if (enosGroupReply.length > 0) {
                console.log(`📋 Rate-limit untuk group ${enosGroup[0].groupname}: ${enosGroupReply[0].value}`);
                const parts = enosGroupReply[0].value.trim().split(/\s+/);
                const hasBurst = parts.length > 1;
                const lastPart = parts[parts.length - 1];
                const hasTimeUnit = /^[0-9]+[smhd]$/i.test(lastPart);
                
                if (hasBurst && !hasTimeUnit) {
                    console.log(`⚠️  MASALAH: Group ${enosGroup[0].groupname} memiliki burst tapi tidak ada burst_time!`);
                    console.log(`   Format saat ini: ${enosGroupReply[0].value}`);
                    console.log(`   Format yang benar harus ada burst_time di akhir (contoh: 10s, 30s, 1m)`);
                } else {
                    console.log(`✅ Rate-limit untuk group ${enosGroup[0].groupname} sudah benar`);
                }
            }
        } else {
            console.log('⚠️  User "enos" tidak ditemukan di radusergroup');
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
    fixBurstTimeIssues()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { fixBurstTimeIssues };

