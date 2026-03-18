#!/usr/bin/env node

/**
 * Script untuk membuat invoice retroaktif untuk voucher yang sudah ada tapi belum punya invoice
 * Script ini akan:
 * 1. Mengambil semua voucher dari RADIUS database (radcheck dengan comment 'voucher')
 * 2. Membuat invoice untuk voucher yang belum punya invoice di billing.db
 * 3. Invoice dibuat dengan status 'unpaid' dan harga 0 (bisa diupdate manual nanti)
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

async function getAllVouchersFromRadius() {
    const conn = await getRadiusConnection();
    
    try {
        // Ambil semua voucher dari radcheck yang memiliki comment 'voucher' di radreply
        const [vouchers] = await conn.execute(`
            SELECT DISTINCT c.username,
                   (SELECT groupname FROM radusergroup WHERE username = c.username LIMIT 1) as profile,
                   (SELECT value FROM radreply WHERE username = c.username AND attribute = 'Reply-Message' LIMIT 1) as comment
            FROM radcheck c
            WHERE c.attribute = 'Cleartext-Password'
            AND EXISTS (
                SELECT 1 FROM radreply r 
                WHERE r.username = c.username 
                AND r.attribute = 'Reply-Message' 
                AND r.value LIKE '%voucher%'
            )
            ORDER BY c.username
        `);
        
        await conn.end();
        return vouchers.map(v => ({
            username: v.username,
            profile: v.profile || 'default',
            comment: v.comment || ''
        }));
    } catch (error) {
        await conn.end();
        console.error('Error getting vouchers from RADIUS:', error.message);
        throw error;
    }
}

async function getVoucherInvoices() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(billingDbPath);
        
        db.all(`
            SELECT invoice_number, notes
            FROM invoices
            WHERE invoice_type = 'voucher'
        `, [], (err, rows) => {
            db.close();
            if (err) {
                reject(err);
            } else {
                // Extract username dari notes
                const usernames = rows.map(row => {
                    const match = row.notes ? row.notes.match(/Voucher Hotspot\s+(\S+)/i) : null;
                    return match ? match[1] : null;
                }).filter(u => u !== null);
                
                resolve(usernames);
            }
        });
    });
}

async function createInvoiceForVoucher(username, profile) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(billingDbPath);
        
        // Get or create voucher customer
        db.get(`SELECT id FROM customers WHERE username = 'voucher_customer' LIMIT 1`, [], (err, row) => {
            if (err) {
                db.close();
                reject(err);
                return;
            }
            
            let voucherCustomerId = row ? row.id : null;
            
            if (!voucherCustomerId) {
                // Create voucher customer
                db.run(`
                    INSERT INTO customers (name, username, phone, status)
                    VALUES (?, ?, ?, ?)
                `, ['Voucher Customer', 'voucher_customer', '000000000000', 'active'], function(createErr) {
                    if (createErr) {
                        db.close();
                        reject(createErr);
                        return;
                    }
                    voucherCustomerId = this.lastID;
                    createInvoice();
                });
            } else {
                createInvoice();
            }
            
            function createInvoice() {
                const invoiceNumber = `INV-VCR-${Date.now()}-${username}`;
                const dueDate = new Date().toISOString().split('T')[0];
                
                db.run(`
                    INSERT INTO invoices (customer_id, package_id, invoice_number, amount, due_date, notes, invoice_type, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, [
                    voucherCustomerId,
                    0, // package_id default untuk voucher
                    invoiceNumber,
                    0, // Harga 0, bisa diupdate manual nanti
                    dueDate,
                    `Voucher Hotspot ${username} - Profile: ${profile}`,
                    'voucher',
                    'unpaid'
                ], function(insertErr) {
                    db.close();
                    if (insertErr) {
                        reject(insertErr);
                    } else {
                        resolve({
                            success: true,
                            invoiceId: this.lastID,
                            invoiceNumber: invoiceNumber,
                            username: username
                        });
                    }
                });
            }
        });
    });
}

async function main() {
    console.log('🔍 Mencari voucher yang belum punya invoice...\n');
    
    try {
        // Get all vouchers from RADIUS
        const vouchers = await getAllVouchersFromRadius();
        console.log(`📋 Ditemukan ${vouchers.length} voucher di RADIUS database`);
        
        // Get existing invoice usernames
        const existingInvoices = await getVoucherInvoices();
        console.log(`📋 Ditemukan ${existingInvoices.length} invoice voucher yang sudah ada\n`);
        
        // Filter vouchers yang belum punya invoice
        const vouchersWithoutInvoice = vouchers.filter(v => {
            return !existingInvoices.includes(v.username);
        });
        
        console.log(`📝 ${vouchersWithoutInvoice.length} voucher belum punya invoice\n`);
        
        if (vouchersWithoutInvoice.length === 0) {
            console.log('✅ Semua voucher sudah punya invoice!');
            return;
        }
        
        // Create invoices untuk voucher yang belum punya
        let successCount = 0;
        let errorCount = 0;
        
        console.log('🚀 Membuat invoice untuk voucher yang belum punya...\n');
        
        for (const voucher of vouchersWithoutInvoice) {
            try {
                const result = await createInvoiceForVoucher(voucher.username, voucher.profile);
                console.log(`✅ Invoice dibuat untuk ${voucher.username}: ${result.invoiceNumber} (ID: ${result.invoiceId})`);
                successCount++;
            } catch (error) {
                console.error(`❌ Error membuat invoice untuk ${voucher.username}: ${error.message}`);
                errorCount++;
            }
        }
        
        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Berhasil: ${successCount}`);
        console.log(`   ❌ Error: ${errorCount}`);
        console.log(`   📝 Total: ${vouchersWithoutInvoice.length}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run script
if (require.main === module) {
    main();
}

module.exports = { getAllVouchersFromRadius, getVoucherInvoices, createInvoiceForVoucher };

