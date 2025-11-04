#!/usr/bin/env node

/**
 * Script untuk update invoice voucher menjadi paid ketika voucher digunakan
 * Script ini akan:
 * 1. Cek voucher yang ada di radacct (sudah digunakan)
 * 2. Update invoice voucher menjadi 'paid' jika belum
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

async function updateVoucherInvoiceToPaid(username) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(billingDbPath);
        
        // Find invoice for this voucher username
        db.get(`
            SELECT id, invoice_number, status, amount
            FROM invoices
            WHERE invoice_type = 'voucher'
            AND notes LIKE ?
            AND status = 'unpaid'
            LIMIT 1
        `, [`%Voucher Hotspot ${username}%`], (err, invoice) => {
            if (err) {
                db.close();
                reject(err);
                return;
            }
            
            if (!invoice) {
                db.close();
                resolve(null); // No invoice found or already paid
                return;
            }
            
            // Update invoice to paid
            db.run(`
                UPDATE invoices
                SET status = 'paid',
                    payment_date = datetime('now')
                WHERE id = ?
            `, [invoice.id], function(updateErr) {
                db.close();
                if (updateErr) {
                    reject(updateErr);
                } else {
                    resolve({
                        id: invoice.id,
                        invoice_number: invoice.invoice_number,
                        amount: invoice.amount,
                        username: username
                    });
                }
            });
        });
    });
}

async function main() {
    console.log('🔄 Memulai proses update invoice voucher...\n');
    
    try {
        // Get vouchers that have been used
        console.log('🔍 Mencari voucher yang sudah digunakan di RADIUS...');
        const usedVouchers = await getUsedVouchers();
        
        if (usedVouchers.length === 0) {
            console.log('✅ Tidak ada voucher yang digunakan saat ini.');
            process.exit(0);
        }
        
        console.log(`✅ Ditemukan ${usedVouchers.length} voucher yang sudah digunakan.\n`);
        
        // Update invoices
        let updatedCount = 0;
        let skippedCount = 0;
        
        for (const username of usedVouchers) {
            try {
                const result = await updateVoucherInvoiceToPaid(username);
                if (result) {
                    console.log(`✅ Updated invoice untuk voucher ${username}:`);
                    console.log(`   Invoice: ${result.invoice_number}`);
                    console.log(`   Amount: Rp ${result.amount?.toLocaleString('id-ID') || 0}`);
                    updatedCount++;
                } else {
                    skippedCount++;
                }
            } catch (error) {
                console.error(`❌ Error updating invoice for ${username}:`, error.message);
            }
        }
        
        console.log(`\n✅ Selesai!`);
        console.log(`   Updated: ${updatedCount} invoice`);
        console.log(`   Skipped: ${skippedCount} (sudah paid atau tidak ada invoice)`);
        
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

module.exports = { updateVoucherInvoiceToPaid, getUsedVouchers };

