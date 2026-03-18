#!/usr/bin/env node

/**
 * Script untuk sync status suspended customers dari billing ke RADIUS
 * Mengecek semua customer yang statusnya 'suspended' di billing
 * dan memastikan mereka di group 'isolir' di RADIUS
 */

const billingManager = require('../config/billing');
const { getRadiusConnection, suspendUserRadius, getUserAuthModeAsync } = require('../config/mikrotik');
const { getMikrotikConnectionForCustomer } = require('../config/mikrotik');

async function syncSuspendedStatusToRadius() {
    try {
        console.log('🔄 Sync status suspended customers ke RADIUS...\n');
        
        // Cek auth mode
        const authMode = await getUserAuthModeAsync();
        if (authMode !== 'radius') {
            console.log('⚠️  Auth mode bukan RADIUS, skip sync');
            return;
        }
        
        // Ambil semua customer yang statusnya suspended
        const customers = await billingManager.getCustomers();
        const suspendedCustomers = customers.filter(c => c.status === 'suspended');
        
        console.log(`📋 Ditemukan ${suspendedCustomers.length} customer dengan status 'suspended'\n`);
        
        if (suspendedCustomers.length === 0) {
            console.log('✅ Tidak ada customer yang suspended');
            return;
        }
        
        const conn = await getRadiusConnection();
        let synced = 0;
        let alreadyIsolir = 0;
        let errors = 0;
        
        for (const customer of suspendedCustomers) {
            const pppUser = (customer.pppoe_username && String(customer.pppoe_username).trim()) || 
                           (customer.username && String(customer.username).trim());
            
            if (!pppUser) {
                console.log(`⏭️  Skip ${customer.name || customer.phone}: tidak punya PPPoE username`);
                continue;
            }
            
            try {
                // Cek group saat ini di RADIUS
                const [currentGroup] = await conn.execute(
                    "SELECT groupname FROM radusergroup WHERE username = ? LIMIT 1",
                    [pppUser]
                );
                
                if (currentGroup && currentGroup.length > 0 && currentGroup[0].groupname === 'isolir') {
                    console.log(`✅ ${pppUser} (${customer.name || customer.phone}): sudah di group isolir`);
                    alreadyIsolir++;
                } else {
                    console.log(`🔄 ${pppUser} (${customer.name || customer.phone}): pindahkan ke group isolir...`);
                    
                    // Disconnect active session TERLEBIH DAHULU
                    try {
                        const mikrotik = await getMikrotikConnectionForCustomer(customer);
                        const activeSessions = await mikrotik.write('/ppp/active/print', [
                            `?name=${pppUser}`
                        ]);
                        
                        if (activeSessions && activeSessions.length > 0) {
                            for (const session of activeSessions) {
                                await mikrotik.write('/ppp/active/remove', [
                                    `=.id=${session['.id']}`
                                ]);
                            }
                            console.log(`   ⚡ Disconnected ${activeSessions.length} active session(s)`);
                        }
                    } catch (disconnectError) {
                        console.log(`   ⚠️  Gagal disconnect session: ${disconnectError.message}`);
                    }
                    
                    // Pindahkan ke group isolir
                    const result = await suspendUserRadius(pppUser);
                    if (result && result.success) {
                        console.log(`   ✅ Berhasil dipindahkan ke group isolir`);
                        synced++;
                    } else {
                        console.log(`   ❌ Gagal: ${result?.message || 'Unknown error'}`);
                        errors++;
                    }
                }
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                errors++;
            }
        }
        
        await conn.end();
        
        console.log(`\n✅ Sync selesai!`);
        console.log(`   - Synced: ${synced}`);
        console.log(`   - Sudah isolir: ${alreadyIsolir}`);
        console.log(`   - Errors: ${errors}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

syncSuspendedStatusToRadius();

