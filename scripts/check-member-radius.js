#!/usr/bin/env node

/**
 * Script untuk check member di RADIUS database
 * Usage: node scripts/check-member-radius.js <username>
 */

const { getRadiusConnection } = require('../config/mikrotik');
const billingManager = require('../config/billing');

const username = process.argv[2] || 'cust';

async function checkMemberRadius() {
    try {
        console.log(`\n🔍 Checking Member in RADIUS: ${username}\n`);
        console.log('='.repeat(60));
        
        // 1. Cek di database billing
        console.log('\n📊 1. DATA DI BILLING DATABASE:');
        console.log('-'.repeat(60));
        const member = await billingManager.getMemberByHotspotUsername(username);
        if (!member) {
            console.log(`   ❌ Member dengan hotspot_username "${username}" tidak ditemukan di billing database`);
            // Coba cari dengan username biasa
            const memberByUsername = await billingManager.getMemberById(username);
            if (memberByUsername) {
                console.log(`   ℹ️  Tapi ditemukan member dengan ID: ${username}`);
            }
        } else {
            console.log(`   ✅ Member ditemukan:`);
            console.log(`      - ID: ${member.id}`);
            console.log(`      - Nama: ${member.name}`);
            console.log(`      - Phone: ${member.phone}`);
            console.log(`      - Username: ${member.username}`);
            console.log(`      - Hotspot Username: ${member.hotspot_username}`);
            console.log(`      - Package: ${member.package_name || 'N/A'}`);
            console.log(`      - Hotspot Profile: ${member.hotspot_profile || 'N/A'}`);
            console.log(`      - Server Hotspot: ${member.server_hotspot || 'Global'}`);
            console.log(`      - Status: ${member.status}`);
        }
        
        // 2. Cek di RADIUS database
        console.log('\n📊 2. DATA DI RADIUS DATABASE:');
        console.log('-'.repeat(60));
        
        const conn = await getRadiusConnection();
        console.log('   ✅ Connected to RADIUS database\n');
        
        // Cek radcheck
        console.log('   📋 Checking radcheck table...');
        const [radcheck] = await conn.execute(
            'SELECT username, attribute, op, value FROM radcheck WHERE username = ?',
            [username]
        );
        
        if (radcheck.length === 0) {
            console.log(`   ❌ User "${username}" TIDAK DITEMUKAN di radcheck table!`);
            console.log(`   ⚠️  Ini masalah - user harus ada di radcheck untuk bisa login`);
        } else {
            console.log(`   ✅ User ditemukan di radcheck (${radcheck.length} entries):`);
            radcheck.forEach(row => {
                console.log(`      - ${row.attribute} (${row.op}) = ${row.value}`);
            });
        }
        
        // Cek radusergroup
        console.log('\n   📋 Checking radusergroup table...');
        const [radusergroup] = await conn.execute(
            'SELECT username, groupname, priority FROM radusergroup WHERE username = ?',
            [username]
        );
        
        if (radusergroup.length === 0) {
            console.log(`   ❌ User "${username}" TIDAK DITEMUKAN di radusergroup table!`);
            console.log(`   ⚠️  Ini masalah besar - user HARUS ada di radusergroup untuk bisa login`);
            console.log(`   💡 User perlu di-assign ke group/profile tertentu`);
        } else {
            console.log(`   ✅ User ditemukan di radusergroup (${radusergroup.length} entries):`);
            radusergroup.forEach(row => {
                console.log(`      - Group: ${row.groupname} (priority: ${row.priority})`);
                
                // Cek apakah group/profile ini ada di radgroupreply
                conn.execute(
                    'SELECT COUNT(*) as count FROM radgroupreply WHERE groupname = ?',
                    [row.groupname]
                ).then(([groupReply]) => {
                    if (groupReply[0].count === 0) {
                        console.log(`         ⚠️  WARNING: Group "${row.groupname}" tidak ditemukan di radgroupreply!`);
                        console.log(`         💡 Profile ini mungkin tidak dikonfigurasi dengan benar di RADIUS`);
                    } else {
                        console.log(`         ✅ Group "${row.groupname}" ada di radgroupreply`);
                    }
                }).catch(err => {
                    console.log(`         ⚠️  Error checking radgroupreply: ${err.message}`);
                });
            });
        }
        
        // Cek radreply
        console.log('\n   📋 Checking radreply table...');
        const [radreply] = await conn.execute(
            'SELECT username, attribute, op, value FROM radreply WHERE username = ?',
            [username]
        );
        
        if (radreply.length === 0) {
            console.log(`   ℹ️  Tidak ada data di radreply untuk user "${username}"`);
        } else {
            console.log(`   ✅ User ditemukan di radreply (${radreply.length} entries):`);
            radreply.forEach(row => {
                console.log(`      - ${row.attribute} (${row.op}) = ${row.value}`);
            });
        }
        
        // 3. Kesimpulan dan rekomendasi
        console.log('\n📊 3. KESIMPULAN:');
        console.log('-'.repeat(60));
        
        const hasPassword = radcheck.some(r => r.attribute === 'Cleartext-Password');
        const hasGroup = radusergroup.length > 0;
        
        if (!hasPassword) {
            console.log(`   ❌ User "${username}" TIDAK MEMILIKI PASSWORD di radcheck`);
            console.log(`   💡 Solusi: User perlu dibuat ulang di RADIUS dengan password`);
        } else if (!hasGroup) {
            console.log(`   ❌ User "${username}" TIDAK MEMILIKI GROUP ASSIGNMENT di radusergroup`);
            console.log(`   💡 Solusi: User perlu di-assign ke group/profile tertentu`);
        } else {
            console.log(`   ✅ User "${username}" memiliki password dan group assignment`);
            console.log(`   ⚠️  Tapi masih ditolak - mungkin masalah dengan konfigurasi profile atau RADIUS server`);
        }
        
        await conn.end();
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Check selesai\n');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

checkMemberRadius();
