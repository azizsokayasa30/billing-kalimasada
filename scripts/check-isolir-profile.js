#!/usr/bin/env node

/**
 * Script untuk cek konfigurasi profile isolir di RADIUS
 * Mencari penyebab disconnect setelah Access-Accept
 */

const path = require('path');
const { getRadiusConnection } = require('../config/mikrotik');

async function checkIsolirProfile() {
    try {
        console.log('🔍 Memeriksa konfigurasi profile isolir di RADIUS...\n');
        
        const conn = await getRadiusConnection();
        
        // Cek radgroupreply untuk isolir
        console.log('📋 Attributes di radgroupreply untuk group "isolir":');
        const [replyRows] = await conn.execute(
            "SELECT attribute, op, value FROM radgroupreply WHERE groupname = 'isolir' ORDER BY attribute"
        );
        
        if (replyRows.length === 0) {
            console.log('   ⚠️  Tidak ada attributes di radgroupreply untuk group "isolir"!');
            console.log('   💡 Profile isolir mungkin belum dibuat di RADIUS.');
        } else {
            replyRows.forEach(row => {
                console.log(`   - ${row.attribute} (${row.op}) = ${row.value}`);
                
                // Cek attribute yang bisa menyebabkan disconnect
                if (row.attribute === 'Session-Timeout') {
                    const timeout = parseInt(row.value);
                    if (timeout > 0 && timeout < 60) {
                        console.log(`      ⚠️  PERINGATAN: Session-Timeout terlalu kecil (${timeout} detik)!`);
                        console.log(`      💡 Ini bisa menyebabkan disconnect cepat setelah Access-Accept.`);
                    }
                }
                
                if (row.attribute === 'Idle-Timeout') {
                    const timeout = parseInt(row.value);
                    if (timeout > 0 && timeout < 60) {
                        console.log(`      ⚠️  PERINGATAN: Idle-Timeout terlalu kecil (${timeout} detik)!`);
                        console.log(`      💡 Ini bisa menyebabkan disconnect jika tidak ada traffic.`);
                    }
                }
                
                if (row.attribute === 'MikroTik-Rate-Limit' || row.attribute === 'Mikrotik-Rate-Limit') {
                    if (row.value === '0/0' || row.value === '0k/0k' || row.value === '0M/0M') {
                        console.log(`      ⚠️  PERINGATAN: Rate-Limit adalah 0/0 (tidak ada bandwidth)!`);
                        console.log(`      💡 Ini bisa menyebabkan disconnect karena tidak ada bandwidth.`);
                        console.log(`      💡 Rekomendasi: Set minimal 1k/1k untuk isolir.`);
                    }
                }
            });
        }
        
        // Cek radgroupcheck untuk isolir
        console.log('\n📋 Attributes di radgroupcheck untuk group "isolir":');
        const [checkRows] = await conn.execute(
            "SELECT attribute, op, value FROM radgroupcheck WHERE groupname = 'isolir' ORDER BY attribute"
        );
        
        if (checkRows.length === 0) {
            console.log('   ⚠️  Tidak ada attributes di radgroupcheck untuk group "isolir"!');
        } else {
            checkRows.forEach(row => {
                console.log(`   - ${row.attribute} (${row.op}) = ${row.value}`);
            });
        }
        
        // Cek apakah ada user yang menggunakan isolir
        console.log('\n👥 User yang menggunakan group "isolir":');
        const [userRows] = await conn.execute(
            "SELECT username FROM radusergroup WHERE groupname = 'isolir' LIMIT 10"
        );
        
        if (userRows.length === 0) {
            console.log('   Tidak ada user yang menggunakan group "isolir" saat ini.');
        } else {
            console.log(`   Ditemukan ${userRows.length} user(s):`);
            userRows.forEach(row => {
                console.log(`   - ${row.username}`);
            });
        }
        
        // Rekomendasi
        console.log('\n💡 REKOMENDASI untuk Profile Isolir:');
        console.log('   1. Rate-Limit: Minimal 1k/1k (bukan 0/0)');
        console.log('   2. Session-Timeout: Kosongkan atau set nilai besar (misal: 86400 = 24 jam)');
        console.log('   3. Idle-Timeout: Kosongkan atau set nilai besar (misal: 3600 = 1 jam)');
        console.log('   4. Framed-IP-Address: Set IP range isolir (misal: 192.168.200.2-192.168.200.200)');
        console.log('   5. Framed-Pool: Atau gunakan pool name (misal: isolir-pool)');
        
        await conn.end();
        
        console.log('\n✅ Pemeriksaan selesai!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkIsolirProfile();

