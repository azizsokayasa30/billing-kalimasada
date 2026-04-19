#!/usr/bin/env node

/**
 * Script untuk mengecek IP pool PPPoE di Mikrotik
 */

const { getMikrotikConnectionForRouter } = require('../config/mikrotik');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkPPPoEPool(poolName = 'hs-pool-5') {
    try {
        console.log(`🔍 Cek IP Pool: ${poolName}\n`);
        
        // Ambil daftar router
        const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
        const routers = await new Promise((resolve) => 
            db.all('SELECT * FROM routers ORDER BY id', (err, rows) => resolve(rows || []))
        );
        db.close();
        
        if (routers.length === 0) {
            console.log('⚠️  Tidak ada router yang dikonfigurasi!');
            return;
        }
        
        // Cek di semua router
        for (const router of routers) {
            console.log(`\n📡 Router: ${router.name} (${router.nas_ip}:${router.port || 8728})`);
            try {
                const conn = await getMikrotikConnectionForRouter(router);
                
                // Cek pool
                const pools = await conn.write('/ip/pool/print', [`?name=${poolName}`]);
                
                if (pools.length === 0) {
                    console.log(`   ❌ Pool '${poolName}' TIDAK DITEMUKAN!`);
                    console.log(`   ⚠️  Ini penyebab "could not determine remote address"`);
                    
                    // Tampilkan daftar pool yang ada
                    const allPools = await conn.write('/ip/pool/print');
                    console.log(`\n   📋 Daftar pool yang tersedia:`);
                    if (allPools.length === 0) {
                        console.log(`      - Tidak ada pool yang dikonfigurasi`);
                    } else {
                        allPools.forEach(pool => {
                            console.log(`      - ${pool.name}: ${pool.ranges || '-'}`);
                        });
                    }
                } else {
                    const pool = pools[0];
                    console.log(`   ✅ Pool ditemukan:`);
                    console.log(`      - Name: ${pool.name}`);
                    console.log(`      - Ranges: ${pool.ranges || '-'}`);
                    
                    // Parse pool ranges untuk hitung total IP
                    const poolRanges = (pool.ranges || '').split(',');
                    let totalIPs = 0;
                    const ipRanges = [];
                    
                    poolRanges.forEach(range => {
                        const trimmed = range.trim();
                        const parts = trimmed.split('-');
                        if (parts.length === 2) {
                            const start = parts[0].trim();
                            const end = parts[1].trim();
                            ipRanges.push({ start, end });
                            const startIP = ipToNumber(start);
                            const endIP = ipToNumber(end);
                            if (startIP && endIP && endIP >= startIP) {
                                totalIPs += (endIP - startIP + 1);
                            }
                        } else if (parts.length === 1) {
                            ipRanges.push({ start: trimmed, end: trimmed });
                            totalIPs += 1;
                        }
                    });
                    
                    console.log(`      - Total IPs: ~${totalIPs}`);
                    console.log(`      - IP Ranges:`);
                    ipRanges.forEach(range => {
                        if (range.start === range.end) {
                            console.log(`         • ${range.start}`);
                        } else {
                            console.log(`         • ${range.start} - ${range.end}`);
                        }
                    });
                    
                    // Cek IP yang digunakan
                    const activeConnections = await conn.write('/ppp/active/print');
                    const usedIPs = new Set();
                    activeConnections.forEach(conn => {
                        if (conn['remote-address']) {
                            usedIPs.add(conn['remote-address']);
                        }
                    });
                    
                    console.log(`      - Used IPs: ${usedIPs.size}`);
                    console.log(`      - Available IPs: ~${totalIPs - usedIPs.size}`);
                    
                    if (usedIPs.size >= totalIPs) {
                        console.log(`\n   ⚠️  POOL PENUH! Tidak ada IP yang tersedia.`);
                        console.log(`   ⚠️  Ini bisa menyebabkan "could not determine remote address"`);
                    } else {
                        console.log(`\n   ✅ Pool masih memiliki IP yang tersedia`);
                    }
                    
                    // Cek apakah ada IP yang digunakan dari pool ini
                    const usedFromPool = [];
                    usedIPs.forEach(ip => {
                        // Cek apakah IP ini dalam range pool
                        for (const range of ipRanges) {
                            if (isIPInRange(ip, range.start, range.end)) {
                                usedFromPool.push(ip);
                                break;
                            }
                        }
                    });
                    
                    if (usedFromPool.length > 0) {
                        console.log(`\n   📊 IP yang digunakan dari pool ini (${usedFromPool.length}):`);
                        usedFromPool.slice(0, 10).forEach(ip => {
                            console.log(`      - ${ip}`);
                        });
                        if (usedFromPool.length > 10) {
                            console.log(`      ... dan ${usedFromPool.length - 10} IP lainnya`);
                        }
                    }
                }
                
            } catch (routerError) {
                console.log(`   ❌ Error: ${routerError.message}`);
            }
        }
        
        console.log(`\n💡 REKOMENDASI:`);
        console.log(`   1. Jika pool tidak ada, buat pool di Mikrotik dengan nama '${poolName}'`);
        console.log(`   2. Jika pool penuh, tambahkan range IP baru atau hapus koneksi yang tidak aktif`);
        console.log(`   3. Pastikan pool memiliki range IP yang cukup`);
        
        console.log(`\n✅ Cek selesai!`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Helper function untuk convert IP to number
function ipToNumber(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    try {
        return parseInt(parts[0]) * 256 * 256 * 256 +
               parseInt(parts[1]) * 256 * 256 +
               parseInt(parts[2]) * 256 +
               parseInt(parts[3]);
    } catch (e) {
        return null;
    }
}

// Helper function untuk cek apakah IP dalam range
function isIPInRange(ip, startIP, endIP) {
    const ipNum = ipToNumber(ip);
    const startNum = ipToNumber(startIP);
    const endNum = ipToNumber(endIP);
    
    if (!ipNum || !startNum || !endNum) return false;
    return ipNum >= startNum && ipNum <= endNum;
}

// Get pool name from command line argument
const poolName = process.argv[2] || 'hs-pool-5';
checkPPPoEPool(poolName);

