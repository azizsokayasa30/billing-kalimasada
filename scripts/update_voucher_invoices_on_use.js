#!/usr/bin/env node

/**
 * Script untuk update voucher revenue menjadi paid ketika voucher digunakan
 * Script ini akan:
 * 1. Cek voucher yang ada di radacct (sudah digunakan)
 * 2. Update voucher_revenue menjadi 'paid' jika belum
 * 
 * Bisa dijalankan manual atau via cron job
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database paths
const billingDbPath = path.join(__dirname, '../data/billing.db');

// Use existing getRadiusConnection function from config/mikrotik.js
async function getRadiusConnection() {
    const { getRadiusConnection } = require('../config/mikrotik');
    return await getRadiusConnection();
}

async function getUsedVouchers() {
    const conn = await getRadiusConnection();
    
    try {
        // Get vouchers that have been used (have accounting records)
        // Extract username from invoice notes (format: "Voucher Hotspot {username} - Profile: {profile}")
        const [vouchers] = await conn.execute(`
            SELECT DISTINCT username
            FROM radacct
            WHERE username IS NOT NULL
            AND username != ''
            ORDER BY username
        `);
        
        await conn.end();
        return vouchers.map(v => v.username);
    } catch (error) {
        await conn.end();
        console.error('Error getting used vouchers from RADIUS:', error.message);
        throw error;
    }
}

async function updateVoucherRevenueToPaid(username) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(billingDbPath);
        
        // Find voucher revenue record for this username
        db.get(`
            SELECT id, username, price, status
            FROM voucher_revenue
            WHERE username = ?
            AND status = 'unpaid'
            LIMIT 1
        `, [username], (err, voucher) => {
            if (err) {
                db.close();
                reject(err);
                return;
            }
            
            if (!voucher) {
                db.close();
                resolve(null); // No voucher record found or already paid
                return;
            }
            
            // Get usage count from radacct
            getRadiusConnection().then(async (conn) => {
                try {
                    const [usageRows] = await conn.execute(`
                        SELECT COUNT(*) as usage_count,
                               MIN(acctstarttime) as first_used_at,
                               MAX(acctstoptime) as last_used_at
                        FROM radacct
                        WHERE username = ?
                        AND acctstarttime IS NOT NULL
                    `, [username]);
                    
                    await conn.end();
                    
                    const usageCount = usageRows && usageRows.length > 0 ? parseInt(usageRows[0].usage_count) : 0;
                    const firstUsedAt = usageRows && usageRows.length > 0 ? usageRows[0].first_used_at : null;
                    
                    // Update voucher revenue to paid
                    db.run(`
                        UPDATE voucher_revenue
                        SET status = 'paid',
                            used_at = datetime('now'),
                            usage_count = ?
                        WHERE id = ?
                    `, [usageCount, voucher.id], function(updateErr) {
                        db.close();
                        if (updateErr) {
                            reject(updateErr);
                        } else {
                            resolve({
                                id: voucher.id,
                                username: voucher.username,
                                price: voucher.price,
                                usage_count: usageCount,
                                first_used_at: firstUsedAt
                            });
                        }
                    });
                } catch (usageErr) {
                    await conn.end();
                    // Update anyway without usage info
                    db.run(`
                        UPDATE voucher_revenue
                        SET status = 'paid',
                            used_at = datetime('now')
                        WHERE id = ?
                    `, [voucher.id], function(updateErr) {
                        db.close();
                        if (updateErr) {
                            reject(updateErr);
                        } else {
                            resolve({
                                id: voucher.id,
                                username: voucher.username,
                                price: voucher.price,
                                usage_count: 0
                            });
                        }
                    });
                }
            }).catch((connErr) => {
                db.close();
                reject(connErr);
            });
        });
    });
}

async function main() {
    console.log('🔄 Memulai proses update voucher revenue...\n');
    
    try {
        // Get vouchers that have been used
        console.log('🔍 Mencari voucher yang sudah digunakan di RADIUS...');
        const usedVouchers = await getUsedVouchers();
        
        if (usedVouchers.length === 0) {
            console.log('✅ Tidak ada voucher yang digunakan saat ini.');
            process.exit(0);
        }
        
        console.log(`✅ Ditemukan ${usedVouchers.length} voucher yang sudah digunakan.\n`);
        
        // Update voucher revenue records
        let updatedCount = 0;
        let skippedCount = 0;
        
        for (const username of usedVouchers) {
            try {
                const result = await updateVoucherRevenueToPaid(username);
                if (result) {
                    console.log(`✅ Updated voucher revenue untuk ${username}:`);
                    console.log(`   Price: Rp ${result.price?.toLocaleString('id-ID') || 0}`);
                    console.log(`   Usage Count: ${result.usage_count || 0}`);
                    updatedCount++;
                } else {
                    skippedCount++;
                }
            } catch (error) {
                console.error(`❌ Error updating voucher revenue for ${username}:`, error.message);
            }
        }
        
        console.log(`\n✅ Selesai!`);
        console.log(`   Updated: ${updatedCount} voucher revenue records`);
        console.log(`   Skipped: ${skippedCount} (sudah paid atau tidak ada record)`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run script
if (require.main === module) {
    main();
}

module.exports = { updateVoucherRevenueToPaid, getUsedVouchers };

