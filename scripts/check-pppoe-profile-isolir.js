#!/usr/bin/env node

/**
 * Script untuk cek apakah profil PPPoE isolir sudah ada di database
 * Cek di RADIUS (radgroupreply, radgroupcheck) dan metadata (pppoe_profiles)
 */

const { getRadiusConnection } = require('../config/mikrotik');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkPPPoEProfileIsolir() {
    try {
        console.log('🔍 Memeriksa profil PPPoE isolir di database...\n');
        
        // 1. Cek di RADIUS database
        console.log('📋 1. Cek di RADIUS Database (radgroupreply & radgroupcheck):');
        const conn = await getRadiusConnection();
        
        // Cek radgroupreply
        const [replyRows] = await conn.execute(
            "SELECT attribute, op, value FROM radgroupreply WHERE groupname = 'isolir' ORDER BY attribute"
        );
        console.log(`   ✅ Attributes di radgroupreply: ${replyRows.length} attribute(s)`);
        if (replyRows.length > 0) {
            replyRows.forEach(row => {
                console.log(`      - ${row.attribute} (${row.op}) = ${row.value}`);
            });
        } else {
            console.log(`      ⚠️  TIDAK ADA attributes di radgroupreply untuk group 'isolir'!`);
        }
        
        // Cek radgroupcheck
        const [checkRows] = await conn.execute(
            "SELECT attribute, op, value FROM radgroupcheck WHERE groupname = 'isolir' ORDER BY attribute"
        );
        console.log(`\n   ✅ Attributes di radgroupcheck: ${checkRows.length} attribute(s)`);
        if (checkRows.length > 0) {
            checkRows.forEach(row => {
                console.log(`      - ${row.attribute} (${row.op}) = ${row.value}`);
            });
        } else {
            console.log(`      ⚠️  TIDAK ADA attributes di radgroupcheck untuk group 'isolir'!`);
        }
        
        await conn.end();
        
        // 2. Cek di metadata table (pppoe_profiles)
        console.log(`\n📋 2. Cek di Metadata Table (pppoe_profiles):`);
        const dbPath = path.join(__dirname, '../data/billing.db');
        const db = new sqlite3.Database(dbPath);
        
        return new Promise((resolve, reject) => {
            db.get(
                "SELECT * FROM pppoe_profiles WHERE groupname = 'isolir'",
                [],
                (err, row) => {
                    if (err) {
                        console.log(`   ⚠️  Error: ${err.message}`);
                        if (err.message.includes('no such table')) {
                            console.log(`   💡 Table pppoe_profiles belum dibuat. Ini tidak masalah, metadata opsional.`);
                        }
                        db.close();
                        resolve();
                        return;
                    }
                    
                    if (row) {
                        console.log(`   ✅ Metadata ditemukan:`);
                        console.log(`      - Groupname: ${row.groupname}`);
                        console.log(`      - Display Name: ${row.display_name || '-'}`);
                        console.log(`      - Comment: ${row.comment || '-'}`);
                        console.log(`      - Rate Limit: ${row.rate_limit || '-'}`);
                        console.log(`      - Local Address: ${row.local_address || '-'}`);
                        console.log(`      - Remote Address: ${row.remote_address || '-'}`);
                        console.log(`      - DNS Server: ${row.dns_server || '-'}`);
                    } else {
                        console.log(`   ℹ️  Tidak ada metadata di pppoe_profiles untuk group 'isolir'`);
                        console.log(`   💡 Ini tidak masalah, metadata opsional. Yang penting ada di radgroupreply.`);
                    }
                    
                    db.close();
                    resolve();
                }
            );
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkPPPoEProfileIsolir().then(() => {
    console.log('\n✅ Pemeriksaan selesai!');
    console.log('\n💡 KESIMPULAN:');
    console.log('   - Jika ada attributes di radgroupreply/radgroupcheck: ✅ Profile isolir ADA');
    console.log('   - Jika tidak ada: ⚠️  Profile isolir BELUM ADA, jalankan:');
    console.log('     node scripts/create-isolir-profile-radius.js');
    process.exit(0);
}).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});

