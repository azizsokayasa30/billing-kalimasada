#!/usr/bin/env node

/**
 * Script untuk debug user PPPoE yang langsung disconnect
 * Cek profile, IP pool, dan konfigurasi Mikrotik
 */

const { getMikrotikConnection, getMikrotikConnectionForRouter, getUserAuthModeAsync } = require('../config/mikrotik');
const { getRadiusConnection } = require('../config/mikrotik');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function debugPPPoEDisconnect(username = 'enos') {
    try {
        console.log(`🔍 Debug PPPoE Disconnect: ${username}\n`);
        
        // 1. Cek mode autentikasi
        const authMode = await getUserAuthModeAsync();
        console.log(`📋 1. Mode Autentikasi: ${authMode}\n`);
        
        if (authMode === 'radius') {
            // RADIUS mode
            console.log('📋 2. Cek di RADIUS Database:');
            const conn = await getRadiusConnection();
            
            // Cek user di radusergroup
            const [usergroupRows] = await conn.execute(
                "SELECT username, groupname, priority FROM radusergroup WHERE username = ? ORDER BY priority DESC",
                [username]
            );
            
            if (usergroupRows.length === 0) {
                console.log(`   ⚠️  User TIDAK ada di radusergroup!`);
                await conn.end();
                return;
            }
            
            const groupname = usergroupRows[0].groupname;
            console.log(`   ✅ User di group: ${groupname} (priority: ${usergroupRows[0].priority})`);
            
            // Cek attributes untuk group
            console.log(`\n   🔍 Attributes untuk group '${groupname}':`);
            const [replyRows] = await conn.execute(
                "SELECT attribute, op, value FROM radgroupreply WHERE groupname = ? ORDER BY attribute",
                [groupname]
            );
            
            if (replyRows.length === 0) {
                console.log(`      ⚠️  TIDAK ADA attributes di radgroupreply!`);
            } else {
                replyRows.forEach(row => {
                    console.log(`      - ${row.attribute} (${row.op}) = ${row.value}`);
                });
            }
            
            // Cek Framed-Pool atau Framed-IP-Address
            const framedPool = replyRows.find(r => r.attribute === 'Framed-Pool');
            const framedIP = replyRows.find(r => r.attribute === 'Framed-IP-Address');
            
            console.log(`\n   📊 Remote Address Configuration:`);
            if (framedPool) {
                console.log(`      ✅ Framed-Pool: ${framedPool.value}`);
                console.log(`      🔍 Perlu cek apakah pool '${framedPool.value}' ada di Mikrotik`);
            } else if (framedIP) {
                console.log(`      ✅ Framed-IP-Address: ${framedIP.value}`);
                const isIpRange = /^\d+\.\d+\.\d+\.\d+(-\d+\.\d+\.\d+\.\d+)?$/.test(framedIP.value);
                if (isIpRange) {
                    console.log(`      ✅ Format IP range valid`);
                } else {
                    console.log(`      ⚠️  Format tidak valid untuk IP range`);
                }
            } else {
                console.log(`      ❌ TIDAK ADA Framed-Pool atau Framed-IP-Address!`);
                console.log(`      ⚠️  Ini penyebab "could not determine remote address"`);
            }
            
            await conn.end();
        } else {
            // Mikrotik API mode
            console.log('📋 2. Cek di Mikrotik:');
            
            // Ambil daftar router
            const db = new sqlite3.Database(path.join(process.cwd(), 'data/billing.db'));
            const routers = await new Promise((resolve) => 
                db.all('SELECT * FROM routers ORDER BY id', (err, rows) => resolve(rows || []))
            );
            db.close();
            
            if (routers.length === 0) {
                console.log('   ⚠️  Tidak ada router yang dikonfigurasi!');
                return;
            }
            
            // Cek di semua router
            for (const router of routers) {
                console.log(`\n   🔍 Router: ${router.name} (${router.nas_ip})`);
                try {
                    const conn = await getMikrotikConnectionForRouter(router);
                    
                    // Cek user secret
                    const secrets = await conn.write('/ppp/secret/print', [`?name=${username}`]);
                    if (secrets.length === 0) {
                        console.log(`      ⚠️  User tidak ditemukan di router ini`);
                        continue;
                    }
                    
                    const secret = secrets[0];
                    console.log(`      ✅ User ditemukan:`);
                    console.log(`         - Profile: ${secret.profile || 'default'}`);
                    console.log(`         - Comment: ${secret.comment || '-'}`);
                    
                    // Cek profile
                    const profileName = secret.profile || 'default';
                    const profiles = await conn.write('/ppp/profile/print', [`?name=${profileName}`]);
                    
                    if (profiles.length === 0) {
                        console.log(`      ❌ Profile '${profileName}' TIDAK DITEMUKAN!`);
                        continue;
                    }
                    
                    const profile = profiles[0];
                    console.log(`\n      📊 Profile '${profileName}' Configuration:`);
                    console.log(`         - Local Address: ${profile['local-address'] || '-'}`);
                    console.log(`         - Remote Address: ${profile['remote-address'] || '-'}`);
                    console.log(`         - DNS Server: ${profile['dns-server'] || '-'}`);
                    console.log(`         - Rate Limit: ${profile['rate-limit'] || '-'}`);
                    
                    // Cek remote-address
                    const remoteAddress = profile['remote-address'];
                    if (!remoteAddress || remoteAddress === '') {
                        console.log(`\n      ❌ Remote Address TIDAK DIKONFIGURASI!`);
                        console.log(`      ⚠️  Ini penyebab "could not determine remote address"`);
                    } else {
                        // Cek apakah ini IP pool atau IP range
                        const isIpRange = /^\d+\.\d+\.\d+\.\d+(-\d+\.\d+\.\d+\.\d+)?$/.test(remoteAddress);
                        
                        if (isIpRange) {
                            console.log(`      ✅ Remote Address adalah IP range: ${remoteAddress}`);
                        } else {
                            // Ini adalah pool name, cek apakah pool ada
                            console.log(`      ✅ Remote Address adalah pool name: ${remoteAddress}`);
                            const pools = await conn.write('/ip/pool/print', [`?name=${remoteAddress}`]);
                            
                            if (pools.length === 0) {
                                console.log(`\n      ❌ IP Pool '${remoteAddress}' TIDAK DITEMUKAN di Mikrotik!`);
                                console.log(`      ⚠️  Ini penyebab "could not determine remote address"`);
                            } else {
                                const pool = pools[0];
                                console.log(`      ✅ IP Pool ditemukan:`);
                                console.log(`         - Ranges: ${pool.ranges || '-'}`);
                                
                                // Cek apakah pool masih ada IP yang tersedia
                                const activeConnections = await conn.write('/ppp/active/print');
                                const usedIPs = new Set();
                                activeConnections.forEach(conn => {
                                    if (conn['remote-address']) {
                                        usedIPs.add(conn['remote-address']);
                                    }
                                });
                                
                                // Parse pool ranges
                                const poolRanges = (pool.ranges || '').split(',');
                                let totalIPs = 0;
                                poolRanges.forEach(range => {
                                    const parts = range.trim().split('-');
                                    if (parts.length === 2) {
                                        const start = parts[0].trim();
                                        const end = parts[1].trim();
                                        const startIP = ipToNumber(start);
                                        const endIP = ipToNumber(end);
                                        if (startIP && endIP) {
                                            totalIPs += (endIP - startIP + 1);
                                        }
                                    } else if (parts.length === 1) {
                                        totalIPs += 1;
                                    }
                                });
                                
                                console.log(`         - Total IPs: ~${totalIPs}`);
                                console.log(`         - Used IPs: ${usedIPs.size}`);
                                
                                if (usedIPs.size >= totalIPs) {
                                    console.log(`\n      ⚠️  IP Pool mungkin sudah penuh!`);
                                }
                            }
                        }
                    }
                    
                    // Cek active session
                    const activeSessions = await conn.write('/ppp/active/print', [`?name=${username}`]);
                    if (activeSessions.length > 0) {
                        console.log(`\n      🔴 User sedang online:`);
                        activeSessions.forEach(session => {
                            console.log(`         - ID: ${session['.id']}`);
                            console.log(`         - Remote Address: ${session['remote-address'] || '-'}`);
                            console.log(`         - Uptime: ${session.uptime || '-'}`);
                        });
                    } else {
                        console.log(`\n      ✅ User tidak sedang online`);
                    }
                    
                } catch (routerError) {
                    console.log(`      ❌ Error: ${routerError.message}`);
                }
            }
        }
        
        console.log(`\n💡 REKOMENDASI:`);
        console.log(`   1. Pastikan profile memiliki remote-address yang valid`);
        console.log(`   2. Jika menggunakan pool name, pastikan pool ada di Mikrotik`);
        console.log(`   3. Pastikan IP pool masih memiliki IP yang tersedia`);
        console.log(`   4. Cek log Mikrotik untuk detail error lebih lanjut`);
        
        console.log(`\n✅ Debug selesai!`);
        
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
    return parseInt(parts[0]) * 256 * 256 * 256 +
           parseInt(parts[1]) * 256 * 256 +
           parseInt(parts[2]) * 256 +
           parseInt(parts[3]);
}

// Get username from command line argument
const username = process.argv[2] || 'enos';
debugPPPoEDisconnect(username);

