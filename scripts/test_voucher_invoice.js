#!/usr/bin/env node

/**
 * Script test untuk memastikan invoice voucher dibuat dengan harga yang benar
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/billing.db');

// Test: Buat invoice voucher dengan harga
async function testCreateInvoice() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        // Get or create voucher customer
        db.get(`SELECT id FROM customers WHERE username = 'voucher_customer' LIMIT 1`, [], (err, row) => {
            if (err) {
                db.close();
                reject(err);
                return;
            }
            
            let voucherCustomerId = row ? row.id : null;
            
            if (!voucherCustomerId) {
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
                    createTestInvoice(voucherCustomerId, db, resolve, reject);
                });
            } else {
                createTestInvoice(voucherCustomerId, db, resolve, reject);
            }
        });
    });
}

function createTestInvoice(voucherCustomerId, db, resolve, reject) {
    const testUsername = 'TEST-' + Date.now();
    const testPrice = 15000;
    const invoiceNumber = `INV-VCR-TEST-${Date.now()}`;
    const dueDate = new Date().toISOString().split('T')[0];
    
    console.log(`Creating test invoice: username=${testUsername}, amount=${testPrice}`);
    
    db.run(`
        INSERT INTO invoices (customer_id, package_id, invoice_number, amount, due_date, notes, invoice_type, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
        voucherCustomerId,
        0, // Gunakan 0 bukan null karena constraint NOT NULL
        invoiceNumber,
        testPrice,
        dueDate,
        `Voucher Hotspot ${testUsername} - Profile: test`,
        'voucher',
        'unpaid'
    ], function(err) {
        if (err) {
            console.error(`Error: ${err.message}`);
            db.close();
            reject(err);
            return;
        }
        
        const invoiceId = this.lastID;
        console.log(`✅ Test invoice created: ID=${invoiceId}, amount=${testPrice}`);
        
        // Verify
        db.get(`SELECT invoice_number, amount FROM invoices WHERE id = ?`, [invoiceId], (verifyErr, verifyRow) => {
            db.close();
            if (verifyErr) {
                reject(verifyErr);
            } else if (verifyRow) {
                console.log(`✅ Verified: ${verifyRow.invoice_number}, amount=${verifyRow.amount}`);
                if (verifyRow.amount === testPrice) {
                    console.log(`✅ SUCCESS: Price correctly saved!`);
                    resolve({ success: true, invoiceId, amount: verifyRow.amount });
                } else {
                    console.error(`❌ FAILED: Price mismatch! Expected ${testPrice}, got ${verifyRow.amount}`);
                    reject(new Error(`Price mismatch: expected ${testPrice}, got ${verifyRow.amount}`));
                }
            } else {
                reject(new Error('Invoice not found after creation'));
            }
        });
    });
}

if (require.main === module) {
    testCreateInvoice()
        .then(result => {
            console.log('\n✅ Test passed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Test failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testCreateInvoice };

