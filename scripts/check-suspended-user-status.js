#!/usr/bin/env node

/**
 * Script untuk mengecek status user yang sudah di-suspend
 * dan memastikan profile sudah berubah ke isolir
 */

const { getRadiusConnection, getUserAuthModeAsync } = require('../config/mikrotik');
const billingManager = require('../config/billing');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkSuspendedUserStatus(username = 'enos_rotua_151125') {
    try {
        console.log(`🔍 Cek Status User Suspended: ${username}\n`);
        
        // 1. Cek di Billing Database
        console.log('📋 1. Cek di Billing Database:');
        const customer = await billingManager.getCustomerByUsername(username);
        if (!customer) {
            console.log(`   ❌ Customer tidak ditemukan dengan username: ${username}`);
            console.log(`   💡 Mencoba mencari dengan variasi username...`);
            
            // Coba cari dengan variasi
            const variants = [
                username.replace('_rotua_151125', ''),
                username.replace('_151125', ''),
                username.split('_')[0]
            ];
            
            for (const variant of variants) {
                try {
                    const found = await billingManager.getCustomerByUsername(variant);
                    if (found) {
                        console.log(`   ✅ Ditemukan dengan username: ${variant}`);
                        return await checkSuspendedUserStatus(found.pppoe_username || found.username || variant);
                    }
                } catch (e) {
                    // Continue
                }
            }
            return;
        }
        
        console.log(`   ✅ Customer ditemukan:`);
        console.log(`      - ID: ${customer.id}`);
        console.log(`      - Nama: ${customer.name}`);
        console.log(`      - Username: ${customer.username || '-'}`);
        console.log(`      - PPPoE Username: ${customer.pppoe_username || '-'}`);
        console.log(`      - Status: ${customer.status || '-'}`);
        console.log(`      - Phone: ${customer.phone || '-'}`);
        
        const pppUser = (customer.pppoe_username && String(customer.pppoe_username).trim()) || 
                        (customer.username && String(customer.username).trim());
        
        if (!pppUser) {
            console.log(`\n   ⚠️  Customer tidak memiliki PPPoE username!`);
            return;
        }
        
        console.log(`\n   📌 PPPoE Username yang digunakan: ${pppUser}`);
        
        // 2. Cek di RADIUS Database
        console.log(`\n📋 2. Cek di RADIUS Database (username: ${pppUser}):`);
        const authMode = await getUserAuthModeAsync();
        console.log(`   Mode: ${authMode}`);
        
        if (authMode === 'radius') {
            const conn = await getRadiusConnection();
            
            // Cek user di radcheck
            const [radcheckRows] = await conn.execute(
                "SELECT username, attribute, op, value FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'",
                [pppUser]
            );
            
            if (radcheckRows.length === 0) {
                console.log(`   ⚠️  User tidak ditemukan di radcheck!`);
                console.log(`   💡 Mungkin username berbeda. Cek di Mikrotik untuk username yang benar.`);
            } else {
                console.log(`   ✅ User ditemukan di radcheck`);
            }
            
            // Cek group di radusergroup
            const [usergroupRows] = await conn.execute(
                "SELECT username, groupname, priority FROM radusergroup WHERE username = ?",
                [pppUser]
            );
            
            if (usergroupRows.length === 0) {
                console.log(`   ❌ User TIDAK ada di radusergroup!`);
                console.log(`   ⚠️  Ini masalah - user harus ada di radusergroup`);
            } else {
                console.log(`   ✅ User ada di radusergroup:`);
                usergroupRows.forEach(row => {
                    const isIsolir = row.groupname === 'isolir';
                    const icon = isIsolir ? '✅' : '⚠️';
                    console.log(`      ${icon} Group: ${row.groupname} (priority: ${row.priority})`);
                    
                    if (!isIsolir) {
                        console.log(`      ❌ User BELUM di group 'isolir'!`);
                        console.log(`      💡 User masih di group '${row.groupname}'`);
                    }
                });
            }
            
            await conn.end();
        } else {
            // Mikrotik API mode
            console.log(`   Mode Mikrotik API - perlu cek di router`);
            
            // Cek router mapping
            const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
            const routerMapping = await new Promise((resolve) => 
                db.get('SELECT r.* FROM customer_router_map m JOIN routers r ON r.id = m.router_id WHERE m.customer_id = ? LIMIT 1', 
                    [customer.id], (err, row) => resolve(row || null))
            );
            db.close();
            
            if (!routerMapping) {
                console.log(`   ⚠️  Customer tidak memiliki router mapping!`);
            } else {
                console.log(`   ✅ Router mapping ditemukan: ${routerMapping.name} (${routerMapping.nas_ip})`);
                console.log(`   💡 Perlu cek manual di router apakah profile sudah berubah ke 'isolir'`);
            }
        }
        
        // 3. Rekomendasi
        console.log(`\n💡 REKOMENDASI:`);
        
        if (authMode === 'radius') {
            const conn = await getRadiusConnection();
            const [usergroupRows] = await conn.execute(
                "SELECT groupname FROM radusergroup WHERE username = ?",
                [pppUser]
            );
            await conn.end();
            
            const isIsolir = usergroupRows.some(r => r.groupname === 'isolir');
            
            if (!isIsolir) {
                console.log(`   1. ⚠️  User belum di group 'isolir' di RADIUS!`);
                console.log(`      Jalankan isolir lagi untuk user ini.`);
                console.log(`      Atau jalankan: node scripts/fix-user-to-isolir.js ${pppUser}`);
            } else {
                console.log(`   1. ✅ User sudah di group 'isolir' di RADIUS`);
                console.log(`   2. 💡 Jika profile masih belum berubah di /admin/mikrotik:`);
                console.log(`      - Refresh halaman /admin/mikrotik`);
                console.log(`      - Atau cek apakah ada cache yang perlu di-clear`);
            }
        } else {
            console.log(`   1. Cek di router apakah profile user sudah berubah ke 'isolir'`);
            console.log(`   2. Jika belum, jalankan isolir lagi untuk user ini`);
        }
        
        console.log(`\n✅ Cek selesai!`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Get username from command line argument
const username = process.argv[2] || 'enos_rotua_151125';
checkSuspendedUserStatus(username);

