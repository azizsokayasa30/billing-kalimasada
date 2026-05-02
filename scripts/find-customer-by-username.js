#!/usr/bin/env node

/**
 * Script untuk mencari customer di billing database berdasarkan username
 */

const billingManager = require('../config/billing');

async function findCustomer(username) {
    try {
        console.log(`🔍 Mencari customer dengan username: ${username}\n`);
        
        // Coba berbagai variasi username
        const variations = [
            username,
            `pppoe-${username}`,
            username.replace('pppoe-', ''),
            username.toLowerCase(),
            username.toUpperCase()
        ];
        
        for (const variant of variations) {
            try {
                const customer = await billingManager.getCustomerByUsername(variant);
                if (customer) {
                    console.log(`✅ Customer ditemukan dengan username: "${variant}"`);
                    console.log(`   - ID: ${customer.id}`);
                    console.log(`   - Nama: ${customer.name}`);
                    console.log(`   - Phone: ${customer.phone || '-'}`);
                    console.log(`   - Username: ${customer.username || '-'}`);
                    console.log(`   - PPPoE Username: ${customer.pppoe_username || '-'}`);
                    console.log(`   - Status: ${customer.status || '-'}`);
                    console.log(`   - Package ID: ${customer.package_id || '-'}`);
                    return customer;
                }
            } catch (e) {
                // Continue
            }
        }
        
        console.log(`⚠️  Customer tidak ditemukan dengan variasi username apapun`);
        console.log(`\n💡 Mungkin user ini dibuat langsung di RADIUS tanpa melalui billing system`);
        return null;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return null;
    }
}

const username = process.argv[2] || 'enos';
findCustomer(username).then(() => {
    process.exit(0);
});

