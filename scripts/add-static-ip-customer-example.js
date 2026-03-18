#!/usr/bin/env node

/**
 * Contoh Script untuk Menambah Pelanggan IP Statik
 * Menunjukkan cara menambah pelanggan dengan berbagai tipe koneksi
 */

const billingManager = require('../config/billing');
const { getSetting } = require('../config/settingsManager');

// Contoh data pelanggan untuk berbagai scenario
const customerExamples = {
    // 1. Pelanggan PPPoE Traditional
    pppoe: {
        name: 'Budi Santoso',
        username: 'budi_santoso_001',
        phone: '081234567890',
        email: 'budi@example.com',
        address: 'Jl. Merdeka No. 123, Jakarta',
        package_id: 1, // Sesuaikan dengan ID paket yang ada
        pppoe_username: 'budi_santoso_pppoe',
        pppoe_profile: 'paket_10mb',
        auto_suspension: 1,
        billing_day: 1,
        latitude: -6.2088,
        longitude: 106.8456
    },

    // 2. Pelanggan IP Statik Murni
    static_ip: {
        name: 'Sari Dewi',
        username: 'sari_dewi_002',
        phone: '081234567891',
        email: 'sari@example.com',
        address: 'Jl. Sudirman No. 456, Jakarta',
        package_id: 2, // Sesuaikan dengan ID paket yang ada
        static_ip: '192.168.100.10',
        assigned_ip: '192.168.100.10',
        mac_address: '00:11:22:33:44:55',
        auto_suspension: 1,
        billing_day: 15,
        latitude: -6.2145,
        longitude: 106.8451
    },

    // 3. Pelanggan DHCP (IP dinamis tapi MAC tetap)
    dhcp: {
        name: 'Ahmad Rizki',
        username: 'ahmad_rizki_003',
        phone: '081234567892',
        email: 'ahmad@example.com',
        address: 'Jl. Thamrin No. 789, Jakarta',
        package_id: 3, // Sesuaikan dengan ID paket yang ada
        assigned_ip: '192.168.100.20', // IP yang biasa didapat dari DHCP
        mac_address: '00:11:22:33:44:56',
        auto_suspension: 1,
        billing_day: 10,
        latitude: -6.2070,
        longitude: 106.8470
    },

    // 4. Pelanggan Mixed (PPPoE + Static IP backup)
    mixed: {
        name: 'Lisa Permata',
        username: 'lisa_permata_004',
        phone: '081234567893',
        email: 'lisa@example.com',
        address: 'Jl. Gatot Subroto No. 321, Jakarta',
        package_id: 1, // Sesuaikan dengan ID paket yang ada
        pppoe_username: 'lisa_permata_pppoe',
        pppoe_profile: 'paket_20mb',
        static_ip: '192.168.100.30', // Backup static IP
        assigned_ip: '192.168.100.30',
        mac_address: '00:11:22:33:44:57',
        auto_suspension: 1,
        billing_day: 20,
        latitude: -6.2100,
        longitude: 106.8400
    }
};

async function addCustomerExample(type) {
    try {
        console.log(`\n🔧 Menambah pelanggan tipe: ${type.toUpperCase()}`);
        console.log('=' .repeat(50));

        const customerData = customerExamples[type];
        if (!customerData) {
            throw new Error(`Tipe pelanggan '${type}' tidak dikenal`);
        }

        console.log('📋 Data pelanggan:');
        console.log(`   Nama: ${customerData.name}`);
        console.log(`   Username: ${customerData.username}`);
        console.log(`   Telepon: ${customerData.phone}`);
        console.log(`   Alamat: ${customerData.address}`);
        
        if (customerData.pppoe_username) {
            console.log(`   PPPoE Username: ${customerData.pppoe_username}`);
            console.log(`   PPPoE Profile: ${customerData.pppoe_profile}`);
        }
        
        if (customerData.static_ip) {
            console.log(`   Static IP: ${customerData.static_ip}`);
        }
        
        if (customerData.assigned_ip) {
            console.log(`   Assigned IP: ${customerData.assigned_ip}`);
        }
        
        if (customerData.mac_address) {
            console.log(`   MAC Address: ${customerData.mac_address}`);
        }

        console.log('\n⏳ Menambahkan ke database...');
        
        const result = await billingManager.createCustomer(customerData);
        
        console.log('✅ Pelanggan berhasil ditambahkan!');
        console.log(`   Customer ID: ${result.id}`);
        console.log(`   Username: ${result.username}`);
        
        // Tampilkan konfigurasi isolir
        console.log('\n🔧 Konfigurasi isolir untuk pelanggan ini:');
        
        if (customerData.pppoe_username) {
            console.log('   Metode isolir: PPPoE Profile (isolir)');
            console.log('   Command: isolir ' + customerData.phone + ' [alasan]');
        }
        
        if (customerData.static_ip || customerData.assigned_ip || customerData.mac_address) {
            const method = getSetting('static_ip_suspension_method', 'address_list');
            console.log(`   Metode isolir IP statik: ${method}`);
            console.log('   Command: isolir ' + customerData.phone + ' [alasan]');
            
            if (method === 'address_list' && customerData.static_ip) {
                console.log(`   Mikrotik: IP ${customerData.static_ip} akan ditambah ke blocked_customers`);
            }
            
            if (method === 'dhcp_block' && customerData.mac_address) {
                console.log(`   Mikrotik: MAC ${customerData.mac_address} akan diblokir di DHCP`);
            }
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Error menambah pelanggan:', error.message);
        throw error;
    }
}

async function demonstrateAllTypes() {
    console.log('🚀 DEMO MENAMBAH PELANGGAN IP STATIK');
    console.log('=' .repeat(60));
    
    const results = [];
    
    // Demo semua tipe pelanggan
    for (const type of ['pppoe', 'static_ip', 'dhcp', 'mixed']) {
        try {
            const result = await addCustomerExample(type);
            results.push({ type, success: true, customer: result });
        } catch (error) {
            results.push({ type, success: false, error: error.message });
        }
    }
    
    // Summary
    console.log('\n\n📊 RINGKASAN HASIL');
    console.log('=' .repeat(60));
    
    results.forEach(result => {
        const status = result.success ? '✅ BERHASIL' : '❌ GAGAL';
        console.log(`${status} - ${result.type.toUpperCase()}`);
        
        if (result.success) {
            console.log(`        Customer ID: ${result.customer.id}`);
            console.log(`        Username: ${result.customer.username}`);
        } else {
            console.log(`        Error: ${result.error}`);
        }
    });
    
    console.log('\n💡 Langkah selanjutnya:');
    console.log('1. Test isolir dengan: node scripts/test-isolation.js');
    console.log('2. Cek via WhatsApp: isolir 081234567890 Test isolir');
    console.log('3. Monitor di admin dashboard');
    console.log('4. Verifikasi di Mikrotik');
}

// Fungsi untuk menambah satu pelanggan spesifik
async function addSingleCustomer() {
    console.log('🔧 MENAMBAH PELANGGAN IP STATIK');
    console.log('=' .repeat(40));
    
    // Data pelanggan baru - EDIT SESUAI KEBUTUHAN
    const newCustomer = {
        name: 'Test Customer Static IP',
        username: 'test_customer_static',
        phone: '081999888777', // Ganti dengan nomor yang valid
        email: 'test@example.com',
        address: 'Jl. Test No. 123, Jakarta',
        package_id: 1, // Ganti dengan ID paket yang ada di sistem
        static_ip: '192.168.100.99', // IP statik yang akan digunakan
        assigned_ip: '192.168.100.99',
        mac_address: '00:11:22:33:44:99', // MAC address perangkat
        auto_suspension: 1,
        billing_day: 1,
        latitude: -6.2088,
        longitude: 106.8456
    };
    
    try {
        console.log('📋 Data pelanggan yang akan ditambahkan:');
        Object.entries(newCustomer).forEach(([key, value]) => {
            if (value) console.log(`   ${key}: ${value}`);
        });
        
        console.log('\n⏳ Menambahkan ke database...');
        const result = await billingManager.createCustomer(newCustomer);
        
        console.log('\n✅ Pelanggan berhasil ditambahkan!');
        console.log(`   Customer ID: ${result.id}`);
        console.log(`   Username: ${result.username}`);
        
        console.log('\n🧪 Test isolir:');
        console.log(`   WhatsApp command: isolir ${newCustomer.phone} Test isolir`);
        console.log(`   Expected: IP ${newCustomer.static_ip} akan ditambah ke address list`);
        
        return result;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.message.includes('UNIQUE constraint')) {
            console.log('\n💡 Tips: Customer dengan data tersebut sudah ada.');
            console.log('   Coba ganti username, phone, atau static_ip');
        }
        
        throw error;
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === 'demo') {
        demonstrateAllTypes()
            .then(() => process.exit(0))
            .catch(err => {
                console.error('Demo failed:', err.message);
                process.exit(1);
            });
    } else if (command === 'single') {
        addSingleCustomer()
            .then(() => process.exit(0))
            .catch(err => {
                console.error('Add customer failed:', err.message);
                process.exit(1);
            });
    } else {
        console.log('📚 PENGGUNAAN:');
        console.log('');
        console.log('  node scripts/add-static-ip-customer-example.js demo');
        console.log('    - Demo menambah semua tipe pelanggan');
        console.log('');
        console.log('  node scripts/add-static-ip-customer-example.js single');
        console.log('    - Menambah satu pelanggan IP statik');
        console.log('');
        console.log('📋 FIELD YANG TERSEDIA UNTUK PELANGGAN IP STATIK:');
        console.log('  - name: Nama lengkap pelanggan');
        console.log('  - username: Username unik untuk login');
        console.log('  - phone: Nomor telepon (format: 08xxxxxxxxxx)');
        console.log('  - email: Email pelanggan');
        console.log('  - address: Alamat lengkap');
        console.log('  - package_id: ID paket internet');
        console.log('  - static_ip: IP address statik utama');
        console.log('  - assigned_ip: IP yang di-assign (bisa sama dengan static_ip)');
        console.log('  - mac_address: MAC address untuk DHCP blocking');
        console.log('  - latitude/longitude: Koordinat lokasi');
        console.log('  - auto_suspension: Auto isolir (1=yes, 0=no)');
        console.log('  - billing_day: Tanggal tagihan (1-28)');
    }
}

module.exports = {
    addCustomerExample,
    demonstrateAllTypes,
    addSingleCustomer,
    customerExamples
};
