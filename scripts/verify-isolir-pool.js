#!/usr/bin/env node

/**
 * Script untuk verifikasi dan membuat pool isolir di Mikrotik
 * Pastikan pool 'isolir-pool' sudah ada dengan IP range yang benar
 */

const { getMikrotikConnection } = require('../config/mikrotik');
const { getSetting } = require('../config/settingsManager');

async function verifyIsolirPool() {
    try {
        console.log('🔍 Memeriksa pool isolir di Mikrotik...\n');
        
        const conn = await getMikrotikConnection();
        if (!conn) {
            console.error('❌ Gagal koneksi ke Mikrotik');
            process.exit(1);
        }
        
        // Cek apakah pool isolir-pool sudah ada
        const pools = await conn.write('/ip/pool/print', [
            '?name=isolir-pool'
        ]);
        
        if (pools && pools.length > 0) {
            const pool = pools[0];
            console.log('✅ Pool "isolir-pool" sudah ada:');
            console.log(`   - Name: ${pool.name}`);
            console.log(`   - Ranges: ${pool.ranges || 'Tidak ada'}`);
            console.log(`   - Comment: ${pool.comment || '-'}`);
            
            if (!pool.ranges || pool.ranges === '') {
                console.log('\n⚠️  Pool tidak punya ranges! Perlu diupdate.');
                console.log('💡 Jalankan script generator isolir Mikrotik untuk membuat pool dengan IP range yang benar.');
            }
        } else {
            console.log('⚠️  Pool "isolir-pool" BELUM ada di Mikrotik!');
            console.log('\n💡 REKOMENDASI:');
            console.log('   1. Buka halaman /admin/settings');
            console.log('   2. Scroll ke "Script Generator Menu Isolir Mikrotik"');
            console.log('   3. Isi form dengan:');
            console.log('      - IP PPPoE Aktif: (IP range aktif, misal: 192.168.10.0/24)');
            console.log('      - IP PPPoE Isolir: (IP range isolir, misal: 192.168.200.1)');
            console.log('      - Domain/IP Aplikasi: (IP atau domain aplikasi isolir)');
            console.log('   4. Klik "Generate & Execute Script"');
            console.log('   5. Script akan otomatis membuat pool "isolir-pool" dengan IP range yang benar');
        }
        
        conn.close();
        console.log('\n✅ Verifikasi selesai!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

verifyIsolirPool();

