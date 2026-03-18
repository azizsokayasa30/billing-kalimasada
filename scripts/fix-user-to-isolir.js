#!/usr/bin/env node

/**
 * Script untuk memperbaiki user yang sudah di-suspend tapi belum di group isolir
 */

const { suspendUserRadius, getRouterForCustomer, disconnectPPPoEUser, getRadiusConnection } = require('../config/mikrotik');
const billingManager = require('../config/billing');

async function fixUserToIsolir(username = 'enos_rotua_151125') {
    try {
        console.log(`🔧 Memperbaiki User ke Isolir: ${username}\n`);
        
        // 1. Cek customer di billing
        const customer = await billingManager.getCustomerByUsername(username);
        if (!customer) {
            console.log(`❌ Customer tidak ditemukan dengan username: ${username}`);
            return;
        }
        
        console.log(`✅ Customer ditemukan: ${customer.name}`);
        console.log(`   - Status: ${customer.status || '-'}`);
        console.log(`   - PPPoE Username: ${customer.pppoe_username || customer.username || '-'}`);
        
        const pppUser = (customer.pppoe_username && String(customer.pppoe_username).trim()) || 
                        (customer.username && String(customer.username).trim());
        
        if (!pppUser) {
            console.log(`❌ Customer tidak memiliki PPPoE username!`);
            return;
        }
        
        console.log(`\n📌 PPPoE Username: ${pppUser}`);
        
        // 2. Cek status di RADIUS
        const conn = await getRadiusConnection();
        const [usergroupRows] = await conn.execute(
            "SELECT groupname FROM radusergroup WHERE username = ?",
            [pppUser]
        );
        await conn.end();
        
        if (usergroupRows.length > 0) {
            const currentGroup = usergroupRows[0].groupname;
            console.log(`\n📊 Group saat ini: ${currentGroup}`);
            
            if (currentGroup === 'isolir') {
                console.log(`✅ User sudah di group 'isolir'!`);
                return;
            }
        }
        
        // 3. Disconnect session aktif terlebih dahulu
        console.log(`\n🔌 1. Memutuskan sesi aktif...`);
        try {
            const routerObj = await getRouterForCustomer(customer);
            const disconnectResult = await disconnectPPPoEUser(pppUser, routerObj);
            
            if (disconnectResult.success && disconnectResult.disconnected > 0) {
                console.log(`   ✅ Berhasil memutuskan ${disconnectResult.disconnected} sesi aktif`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else if (disconnectResult.disconnected === 0) {
                console.log(`   ℹ️  User tidak sedang online`);
            } else {
                console.log(`   ⚠️  Disconnect result: ${disconnectResult.message}`);
            }
        } catch (disconnectError) {
            console.log(`   ⚠️  Gagal disconnect: ${disconnectError.message}`);
            console.log(`   💡 Melanjutkan ke isolir meskipun disconnect gagal...`);
        }
        
        // 4. Pindahkan ke group isolir
        console.log(`\n🔄 2. Memindahkan user ke group 'isolir'...`);
        const suspendResult = await suspendUserRadius(pppUser);
        
        if (suspendResult && suspendResult.success) {
            console.log(`   ✅ User berhasil dipindahkan ke group 'isolir'`);
            
            // Verifikasi
            const conn2 = await getRadiusConnection();
            const [verifyRows] = await conn2.execute(
                "SELECT groupname FROM radusergroup WHERE username = ?",
                [pppUser]
            );
            await conn2.end();
            
            if (verifyRows.length > 0 && verifyRows[0].groupname === 'isolir') {
                console.log(`   ✅ Verifikasi berhasil - user sekarang di group 'isolir'`);
            } else {
                console.log(`   ⚠️  Verifikasi gagal - group masih: ${verifyRows[0]?.groupname || 'tidak ditemukan'}`);
            }
        } else {
            console.log(`   ❌ Gagal memindahkan user: ${suspendResult?.message || 'Unknown error'}`);
            return;
        }
        
        console.log(`\n✅ User berhasil diperbaiki!`);
        console.log(`\n💡 Langkah selanjutnya:`);
        console.log(`   1. Refresh halaman /admin/mikrotik untuk melihat perubahan`);
        console.log(`   2. User akan mendapatkan IP isolir saat reconnect`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Get username from command line argument
const username = process.argv[2] || 'enos_rotua_151125';
fixUserToIsolir(username);

