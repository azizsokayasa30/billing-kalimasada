#!/usr/bin/env node

/**
 * Script untuk debug restore user dari isolir
 * Menampilkan data di database RADIUS dan billing
 */

const mysql = require('mysql2/promise');

const username = process.argv[2] || 'enos';

async function debugRestoreUser() {
    console.log(`\n🔍 Debug Restore User: ${username}\n`);
    console.log('='.repeat(60));
    
    // 1. Cek di RADIUS database
    console.log('\n📊 1. DATA DI RADIUS DATABASE:');
    console.log('-'.repeat(60));
    
    let radiusConn = null;
    try {
        const radiusConfig = require('../config/radiusConfig');
        const config = await radiusConfig.getRadiusConfig();
        
        radiusConn = await mysql.createConnection({
            host: config.host || 'localhost',
            user: config.user || 'radius',
            password: config.password || 'radius',
            database: config.database || 'radius'
        });
        
        // Cek radusergroup
        const [groups] = await radiusConn.execute(
            "SELECT * FROM radusergroup WHERE username = ?",
            [username]
        );
        console.log('\n📋 radusergroup:');
        if (groups.length === 0) {
            console.log('   ❌ Tidak ada group assignment');
        } else {
            groups.forEach(g => {
                console.log(`   ✅ Group: ${g.groupname} (priority: ${g.priority})`);
            });
        }
        
        // Cek radcheck untuk PREVGROUP
        const [prevGroups] = await radiusConn.execute(
            "SELECT * FROM radcheck WHERE username = ? AND attribute = 'NT-Password' AND value LIKE 'PREVGROUP:%'",
            [username]
        );
        console.log('\n📋 radcheck (PREVGROUP):');
        if (prevGroups.length === 0) {
            console.log('   ❌ Tidak ada previous group tersimpan');
        } else {
            prevGroups.forEach(pg => {
                const prevGroup = pg.value.replace('PREVGROUP:', '');
                console.log(`   ✅ Previous Group: ${prevGroup}`);
                console.log(`      Attribute: ${pg.attribute}, Op: ${pg.op}, Value: ${pg.value}`);
            });
        }
        
        // Cek radreply untuk X-Previous-Group (legacy)
        const [legacyPrevGroups] = await radiusConn.execute(
            "SELECT * FROM radreply WHERE username = ? AND attribute = 'X-Previous-Group'",
            [username]
        );
        console.log('\n📋 radreply (X-Previous-Group - legacy):');
        if (legacyPrevGroups.length === 0) {
            console.log('   ℹ️  Tidak ada (ini normal, sudah pindah ke radcheck)');
        } else {
            legacyPrevGroups.forEach(pg => {
                console.log(`   ⚠️  Legacy Previous Group: ${pg.value}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error accessing RADIUS database:', error.message);
    } finally {
        if (radiusConn) await radiusConn.end();
    }
    
    // 2. Cek di Billing database
    console.log('\n\n📊 2. DATA DI BILLING DATABASE:');
    console.log('-'.repeat(60));
    
    try {
        const billingManager = require('../config/billing');
        
        // Cari customer
        let customer = null;
        try {
            customer = await billingManager.getCustomerByUsername(username);
        } catch (e) {
            // Coba query langsung
            const db = billingManager.db;
            customer = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT c.*, p.name as package_name, p.pppoe_profile as package_pppoe_profile
                    FROM customers c
                    LEFT JOIN packages p ON c.package_id = p.id
                    WHERE c.pppoe_username = ? OR c.username = ?
                    LIMIT 1
                `, [username, username], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }
        
        if (!customer) {
            console.log('   ❌ Customer tidak ditemukan di billing database');
        } else {
            console.log('\n📋 Customer Data:');
            console.log(`   ✅ Name: ${customer.name}`);
            console.log(`   ✅ Username: ${customer.username || 'N/A'}`);
            console.log(`   ✅ PPPoE Username: ${customer.pppoe_username || 'N/A'}`);
            console.log(`   ✅ Status: ${customer.status || 'N/A'}`);
            console.log(`   ✅ Package ID: ${customer.package_id || 'N/A'}`);
            console.log(`   ✅ Package Name: ${customer.package_name || 'N/A'}`);
            console.log(`   ✅ Customer PPPoE Profile: ${customer.pppoe_profile || 'N/A'}`);
            console.log(`   ✅ Package PPPoE Profile: ${customer.package_pppoe_profile || 'N/A'}`);
            
            // Tentukan profile yang seharusnya digunakan
            const expectedProfile = customer.pppoe_profile || 
                                   customer.package_pppoe_profile ||
                                   (customer.package_name ? customer.package_name.toLowerCase().replace(/\s+/g, '-') : null) ||
                                   customer.package_name ||
                                   'default';
            
            console.log(`\n   🎯 Expected Profile/Group: ${expectedProfile}`);
        }
        
    } catch (error) {
        console.error('❌ Error accessing billing database:', error.message);
    }
    
    // 3. Simulasi proses restore
    console.log('\n\n📊 3. SIMULASI PROSES RESTORE:');
    console.log('-'.repeat(60));
    
    try {
        const { unsuspendUserRadius } = require('../config/mikrotik');
        console.log(`\n   🔄 Memanggil unsuspendUserRadius('${username}')...`);
        
        const result = await unsuspendUserRadius(username);
        
        console.log(`\n   📋 Hasil Restore:`);
        console.log(`      Success: ${result.success}`);
        console.log(`      Message: ${result.message}`);
        console.log(`      Previous Group: ${result.previousGroup || 'N/A'}`);
        
        // Cek lagi setelah restore
        if (radiusConn) {
            await radiusConn.end();
            const radiusConfig = require('../config/radiusConfig');
            const config = await radiusConfig.getRadiusConfig();
            radiusConn = await mysql.createConnection({
                host: config.host || 'localhost',
                user: config.user || 'radius',
                password: config.password || 'radius',
                database: config.database || 'radius'
            });
            
            const [groupsAfter] = await radiusConn.execute(
                "SELECT * FROM radusergroup WHERE username = ?",
                [username]
            );
            console.log(`\n   📋 Group Setelah Restore:`);
            if (groupsAfter.length === 0) {
                console.log('      ❌ Tidak ada group assignment');
            } else {
                groupsAfter.forEach(g => {
                    console.log(`      ✅ Group: ${g.groupname} (priority: ${g.priority})`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error saat restore:', error.message);
        console.error(error.stack);
    } finally {
        if (radiusConn) await radiusConn.end();
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Debug selesai\n');
}

// Jalankan
debugRestoreUser().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

