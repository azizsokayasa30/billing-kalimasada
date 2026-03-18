#!/usr/bin/env node

/**
 * Script untuk memperbaiki profile PPPoE yang menggunakan pool yang tidak ada
 * Mengubah pool ke pool yang tersedia di Mikrotik
 */

const { getRadiusConnection, getMikrotikConnectionForRouter } = require('../config/mikrotik');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function fixPPPoEProfilePool(groupname = 'SAMPLE-PROFIL-PPPOE', newPoolName = 'POOL-PPPoE') {
    try {
        console.log(`🔧 Memperbaiki Profile: ${groupname}\n`);
        console.log(`   Mengubah pool ke: ${newPoolName}\n`);
        
        // 1. Cek apakah pool baru ada di Mikrotik
        console.log(`📋 1. Cek pool di Mikrotik:`);
        const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
        const routers = await new Promise((resolve) => 
            db.all('SELECT * FROM routers ORDER BY id', (err, rows) => resolve(rows || []))
        );
        db.close();
        
        if (routers.length === 0) {
            console.log('⚠️  Tidak ada router yang dikonfigurasi!');
            return;
        }
        
        let poolExists = false;
        for (const router of routers) {
            try {
                const conn = await getMikrotikConnectionForRouter(router);
                const pools = await conn.write('/ip/pool/print', [`?name=${newPoolName}`]);
                if (pools.length > 0) {
                    poolExists = true;
                    console.log(`   ✅ Pool '${newPoolName}' ditemukan di router ${router.name}`);
                    console.log(`      Ranges: ${pools[0].ranges || '-'}`);
                    break;
                }
            } catch (e) {
                // Continue
            }
        }
        
        if (!poolExists) {
            console.log(`   ❌ Pool '${newPoolName}' TIDAK DITEMUKAN di Mikrotik!`);
            console.log(`   ⚠️  Pastikan pool ada sebelum melanjutkan.`);
            return;
        }
        
        // 2. Update profile di RADIUS
        console.log(`\n📋 2. Update profile di RADIUS:`);
        const conn = await getRadiusConnection();
        
        // Hapus Framed-Pool yang lama
        await conn.execute(
            "DELETE FROM radgroupreply WHERE groupname = ? AND attribute = 'Framed-Pool'",
            [groupname]
        );
        console.log(`   ✅ Menghapus Framed-Pool lama`);
        
        // Tambahkan Framed-Pool baru
        await conn.execute(
            "INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES (?, 'Framed-Pool', ':=', ?)",
            [groupname, newPoolName]
        );
        console.log(`   ✅ Menambahkan Framed-Pool baru: ${newPoolName}`);
        
        // Verifikasi
        const [verifyRows] = await conn.execute(
            "SELECT attribute, op, value FROM radgroupreply WHERE groupname = ? AND attribute = 'Framed-Pool'",
            [groupname]
        );
        
        if (verifyRows.length > 0) {
            console.log(`   ✅ Verifikasi berhasil:`);
            verifyRows.forEach(row => {
                console.log(`      - ${row.attribute} (${row.op}) = ${row.value}`);
            });
        } else {
            console.log(`   ⚠️  Verifikasi gagal - Framed-Pool tidak ditemukan`);
        }
        
        await conn.end();
        
        console.log(`\n✅ Profile berhasil diperbaiki!`);
        console.log(`\n💡 Langkah selanjutnya:`);
        console.log(`   1. User yang menggunakan profile ini perlu reconnect`);
        console.log(`   2. Atau bisa disconnect manual dari admin panel`);
        console.log(`   3. Koneksi baru akan menggunakan pool '${newPoolName}'`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Get parameters from command line
const groupname = process.argv[2] || 'SAMPLE-PROFIL-PPPOE';
const newPoolName = process.argv[3] || 'POOL-PPPoE';

console.log(`⚠️  PERINGATAN: Script ini akan mengubah profile '${groupname}'`);
console.log(`   Pool akan diubah dari yang lama ke '${newPoolName}'`);
console.log(`\n   Tekan Ctrl+C untuk membatalkan, atau tunggu 5 detik untuk melanjutkan...\n`);

setTimeout(() => {
    fixPPPoEProfilePool(groupname, newPoolName);
}, 5000);

