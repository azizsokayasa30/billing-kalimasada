#!/usr/bin/env node

/**
 * Script untuk debug user yang diisolir tapi masih disconnect
 * Cek database RADIUS dan billing
 */

const { getRadiusConnection } = require('../config/mikrotik');
const billingManager = require('../config/billing');

async function debugIsolirUser(username = 'enos') {
    try {
        console.log(`🔍 Debug user isolir: ${username}\n`);
        
        // 1. Cek di RADIUS database
        console.log('📋 1. Cek di RADIUS Database:');
        const conn = await getRadiusConnection();
        
        // Cek user di radcheck
        const [radcheckRows] = await conn.execute(
            "SELECT username, attribute, op, value FROM radcheck WHERE username = ?",
            [username]
        );
        console.log(`   ✅ User ada di radcheck: ${radcheckRows.length > 0 ? 'Ya' : 'Tidak'}`);
        if (radcheckRows.length > 0) {
            radcheckRows.forEach(row => {
                console.log(`      - ${row.attribute} (${row.op}) = ${row.value}`);
            });
        }
        
        // Cek user di radusergroup
        const [usergroupRows] = await conn.execute(
            "SELECT username, groupname, priority FROM radusergroup WHERE username = ?",
            [username]
        );
        console.log(`\n   📦 Group assignment:`);
        if (usergroupRows.length === 0) {
            console.log(`      ⚠️  User TIDAK ada di radusergroup!`);
        } else {
            usergroupRows.forEach(row => {
                console.log(`      - Group: ${row.groupname} (priority: ${row.priority})`);
            });
        }
        
        // Cek attributes untuk group isolir
        if (usergroupRows.some(r => r.groupname === 'isolir')) {
            console.log(`\n   🔍 Attributes untuk group 'isolir':`);
            const [isolirReplyRows] = await conn.execute(
                "SELECT attribute, op, value FROM radgroupreply WHERE groupname = 'isolir' ORDER BY attribute"
            );
            if (isolirReplyRows.length === 0) {
                console.log(`      ⚠️  TIDAK ADA attributes di radgroupreply untuk group 'isolir'!`);
            } else {
                isolirReplyRows.forEach(row => {
                    console.log(`      - ${row.attribute} (${row.op}) = ${row.value}`);
                });
            }
            
            const [isolirCheckRows] = await conn.execute(
                "SELECT attribute, op, value FROM radgroupcheck WHERE groupname = 'isolir' ORDER BY attribute"
            );
            if (isolirCheckRows.length > 0) {
                isolirCheckRows.forEach(row => {
                    console.log(`      - ${row.attribute} (${row.op}) = ${row.value}`);
                });
            }
        }
        
        // Cek X-Previous-Group (untuk restore)
        try {
            const [prevGroupRows] = await conn.execute(
                "SELECT attribute, op, value FROM radreply WHERE username = ? AND attribute = 'X-Previous-Group'",
                [username]
            );
            if (prevGroupRows.length > 0) {
                console.log(`\n   📝 Previous group (untuk restore): ${prevGroupRows[0].value}`);
            }
        } catch (e) {
            // Ignore error jika connection sudah closed
        }
        
        try {
            await conn.end();
        } catch (e) {
            // Ignore error jika connection sudah closed
        }
        
        // 2. Cek di Billing database
        console.log(`\n📋 2. Cek di Billing Database:`);
        try {
            const customer = await billingManager.getCustomerByUsername(username);
            if (customer) {
                console.log(`   ✅ Customer ditemukan:`);
                console.log(`      - ID: ${customer.id}`);
                console.log(`      - Nama: ${customer.name}`);
                console.log(`      - Username: ${customer.username || customer.pppoe_username || '-'}`);
                console.log(`      - Status: ${customer.status || '-'}`);
                console.log(`      - Package ID: ${customer.package_id || '-'}`);
                console.log(`      - PPPoE Profile: ${customer.pppoe_profile || '-'}`);
            } else {
                console.log(`   ⚠️  Customer TIDAK ditemukan di billing database!`);
            }
        } catch (billingError) {
            console.log(`   ❌ Error cek billing: ${billingError.message}`);
        }
        
        // 3. Rekomendasi
        console.log(`\n💡 REKOMENDASI:`);
        if (usergroupRows.length === 0) {
            console.log(`   1. ⚠️  User belum dipindahkan ke group isolir!`);
            console.log(`      Jalankan isolir lagi untuk user ini.`);
        } else if (!usergroupRows.some(r => r.groupname === 'isolir')) {
            console.log(`   1. ⚠️  User tidak di group 'isolir'!`);
            console.log(`      User saat ini di group: ${usergroupRows.map(r => r.groupname).join(', ')}`);
            console.log(`      Jalankan isolir lagi untuk user ini.`);
        } else {
            console.log(`   1. ✅ User sudah di group 'isolir'`);
            
            // Cek attributes isolir (gunakan connection yang sama, jangan close dulu)
            try {
                const [isolirReplyRows] = await conn.execute(
                    "SELECT attribute, op, value FROM radgroupreply WHERE groupname = 'isolir' ORDER BY attribute"
                );
                const hasRateLimit = isolirReplyRows.some(r => r.attribute === 'MikroTik-Rate-Limit');
                const hasFramedIP = isolirReplyRows.some(r => r.attribute === 'Framed-IP-Address');
                const hasFramedPool = isolirReplyRows.some(r => r.attribute === 'Framed-Pool');
                
                if (!hasRateLimit) {
                    console.log(`   2. ⚠️  Group 'isolir' tidak punya Rate-Limit!`);
                    console.log(`      Jalankan: node scripts/create-isolir-profile-radius.js`);
                }
                
                if (!hasFramedIP && !hasFramedPool) {
                    console.log(`   3. ⚠️  Group 'isolir' tidak punya Framed-IP-Address atau Framed-Pool!`);
                    console.log(`      Ini bisa menyebabkan "could not determine remote address"`);
                    console.log(`      Tambahkan IP range isolir di settings atau buat pool di Mikrotik.`);
                }
            } catch (e) {
                // Ignore error jika connection sudah closed
            }
        }
        
        console.log(`\n✅ Debug selesai!`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Get username from command line argument
const username = process.argv[2] || 'enos';
debugIsolirUser(username);

