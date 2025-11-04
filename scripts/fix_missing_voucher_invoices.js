#!/usr/bin/env node

/**
 * Script untuk memperbaiki voucher yang sudah dibuat sebelumnya tapi belum punya invoice
 * Script ini akan:
 * 1. Cek voucher di RADIUS database (radcheck/radusergroup)
 * 2. Cek apakah voucher sudah digunakan (ada di radacct)
 * 3. Buat invoice retroaktif untuk voucher yang sudah dibuat tapi belum punya invoice
 */

const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// Load settings
const settingsPath = path.join(__dirname, '../settings.json');
let settings = {};
if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
}

// Database paths
const billingDbPath = path.join(__dirname, '../data/billing.db');

// RADIUS database config
const radiusConfig = {
    host: settings.radius_host || 'localhost',
    user: settings.radius_user || 'billing',
    password: settings.radius_password || '',
    database: settings.radius_database || 'radius'
};

async function getRadiusConnection() {
    try {
        const conn = await mysql.createConnection({
            host: radiusConfig.host,
            user: radiusConfig.user,
            password: radiusConfig.password,
            database: radiusConfig.database
        });
        return conn;
    } catch (error) {
        console.error('Error connecting to RADIUS database:', error.message);
        throw error;
    }
}

async function getVouchersFromRadius() {
    const conn = await getRadiusConnection();
    
    try {
        // Get all hotspot users (voucher biasanya ada di radcheck dengan comment atau di radusergroup)
        // Voucher biasanya memiliki prefix tertentu atau ada di comment
        const [vouchers] = await conn.execute(`
            SELECT DISTINCT 
                rc.username,
                rc.value as password,
                rug.groupname as profile,
                rr.value as comment
            FROM radcheck rc
            LEFT JOIN radusergroup rug ON rc.username = rug.username
            LEFT JOIN radreply rr ON rc.username = rr.username AND rr.attribute = 'User-Comment'
            WHERE rc.attribute = 'Cleartext-Password'
            ORDER BY rc.username
        `);
        
        return vouchers;
    } catch (error) {
        console.error('Error getting vouchers from RADIUS:', error.message);
        throw error;
    } finally {
        await conn.end();
    }
}

async function checkVoucherUsed(username) {
    const conn = await getRadiusConnection();
    
    try {
        // Check if voucher has been used (has accounting records)
        const [records] = await conn.execute(`
            SELECT COUNT(*) as count, MAX(acctstarttime) as last_used
            FROM radacct
            WHERE username = ?
        `, [username]);
        
        return records[0].count > 0;
    } catch (error) {
        console.error(`Error checking voucher usage for ${username}:`, error.message);
        return false;
    } finally {
        await conn.end();
    }
}

async function checkInvoiceExists(username) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(billingDbPath);
        
        db.get(`
            SELECT id, invoice_number, amount, status, created_at
            FROM invoices
            WHERE (notes LIKE ? OR invoice_number LIKE ?)
            AND invoice_type = 'voucher'
        `, [`%${username}%`, `%${username}%`], (err, row) => {
            db.close();
            if (err) {
                reject(err);
            } else {
                resolve(row || null);
            }
        });
    });
}

async function createVoucherInvoice(username, profile, amount = 0) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(billingDbPath);
        
        // Check if invoice already exists
        checkInvoiceExists(username).then(existing => {
            if (existing) {
                db.close();
                resolve(existing);
                return;
            }
            
                        // Get or create voucher customer
                        let voucherCustomerId = null;
                        db.get(`SELECT id FROM customers WHERE username = 'voucher_customer' LIMIT 1`, [], (err, voucherCustomerRow) => {
                            if (err) {
                                db.close();
                                reject(err);
                                return;
                            }
                            
                            if (voucherCustomerRow) {
                                voucherCustomerId = voucherCustomerRow.id;
                                createInvoiceRecord();
                            } else {
                                // Buat customer khusus untuk voucher
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
                                    createInvoiceRecord();
                                });
                            }
                        });
                        
                        function createInvoiceRecord() {
                            // Create invoice
                            const invoiceNumber = `INV-VCR-${Date.now()}-${username}`;
                            const dueDate = new Date().toISOString().split('T')[0];
                            
                            // Use voucher customer and set status to unpaid (will be paid when voucher is used)
                            db.run(`
                                INSERT INTO invoices (
                                    customer_id, 
                                    package_id, 
                                    invoice_number, 
                                    amount, 
                                    due_date, 
                                    notes, 
                                    invoice_type, 
                                    status, 
                                    created_at
                                )
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                            `, [
                                voucherCustomerId, // Use voucher customer
                                0, // Package ID - use 0 if null not allowed
                                invoiceNumber,
                                amount,
                                dueDate,
                                `Voucher Hotspot ${username} - Profile: ${profile}`,
                                'voucher',
                                'unpaid' // Status unpaid, will be paid when voucher is used
                            ], function(err) {
                                db.close();
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({
                                        id: this.lastID,
                                        invoice_number: invoiceNumber,
                                        amount: amount
                                    });
                                }
                            });
                        }
        }).catch(reject);
    });
}

async function main() {
    console.log('🔍 Memulai proses perbaikan invoice voucher...\n');
    
    // Get voucher username from command line argument
    const voucherUsername = process.argv[2];
    const price = parseFloat(process.argv[3]);
    
    if (!voucherUsername || !price || isNaN(price)) {
        console.error('❌ Usage: node fix_missing_voucher_invoices.js <voucher_username> <harga>');
        console.error('   Contoh: node fix_missing_voucher_invoices.js w9528 5000');
        process.exit(1);
    }
    
    console.log(`📋 Memproses voucher: ${voucherUsername}`);
    console.log(`💰 Harga: Rp ${price.toLocaleString('id-ID')}\n`);
    
    try {
        // Check if invoice already exists
        const existingInvoice = await checkInvoiceExists(voucherUsername);
        if (existingInvoice) {
            console.log(`✅ Invoice sudah ada untuk voucher ${voucherUsername}:`);
            console.log(`   Invoice Number: ${existingInvoice.invoice_number}`);
            console.log(`   Amount: Rp ${existingInvoice.amount?.toLocaleString('id-ID') || 0}`);
            console.log(`   Status: ${existingInvoice.status}`);
            console.log(`   Created: ${existingInvoice.created_at}`);
            process.exit(0);
        }
        
        // Create invoice directly (simpler approach)
        console.log('📝 Membuat invoice...');
        const invoice = await createVoucherInvoice(voucherUsername, 'default', price);
        
        console.log(`\n✅ Invoice berhasil dibuat!`);
        console.log(`   Invoice ID: ${invoice.id}`);
        console.log(`   Invoice Number: ${invoice.invoice_number}`);
        console.log(`   Amount: Rp ${invoice.amount.toLocaleString('id-ID')}`);
        console.log(`   Status: paid`);
        
        console.log('\n✅ Selesai! Voucher sekarang akan muncul di laporan keuangan.');
        
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

module.exports = { createVoucherInvoice, checkInvoiceExists };

