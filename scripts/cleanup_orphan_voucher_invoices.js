#!/usr/bin/env node

/**
 * Script untuk membersihkan invoice voucher yang tidak punya voucher lagi di RADIUS
 * Script ini akan:
 * 1. Cek semua invoice voucher di billing.db
 * 2. Cek apakah voucher masih ada di RADIUS database
 * 3. Hapus invoice yang tidak punya voucher lagi
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database paths
const billingDbPath = path.join(__dirname, '../data/billing.db');

// Gunakan getRadiusConnection dari config/mikrotik.js untuk konsistensi
async function getRadiusConnection() {
    try {
        const { getRadiusConnection: getRadiusConn } = require('../config/mikrotik');
        return await getRadiusConn();
    } catch (error) {
        console.error('Error connecting to RADIUS database:', error.message);
        throw error;
    }
}

async function getVoucherInvoices() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(billingDbPath);
        db.all(`
            SELECT id, invoice_number, notes, created_at
            FROM invoices
            WHERE invoice_type = 'voucher'
        `, [], (err, rows) => {
            db.close();
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

async function checkVoucherExists(username) {
    let conn = null;
    try {
        conn = await getRadiusConnection();
        const [rows] = await conn.execute(
            "SELECT COUNT(*) as count FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'",
            [username]
        );
        await conn.end();
        return rows[0].count > 0;
    } catch (error) {
        if (conn) {
            try {
                await conn.end();
            } catch (e) {
                // Ignore connection close errors
            }
        }
        console.error(`Error checking voucher ${username}: ${error.message}`);
        // Return false jika error, sehingga invoice akan dihapus sebagai orphan
        return false;
    }
}

async function deleteInvoice(invoiceId) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(billingDbPath);
        
        // Delete related records first - hanya tabel yang benar-benar ada dan punya kolom invoice_id
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Hanya query untuk tabel yang umum dan punya kolom invoice_id
            const deleteQueries = [
                'DELETE FROM payments WHERE invoice_id = ?',
                'DELETE FROM payment_gateway_transactions WHERE invoice_id = ?'
            ];
            
            let completedQueries = 0;
            let hasError = false;
            const errors = [];
            
            deleteQueries.forEach((query) => {
                db.run(query, [invoiceId], function(err) {
                    if (err) {
                        // Ignore "no such table" atau "no such column" errors
                        if (!err.message.includes('no such table') && !err.message.includes('no such column')) {
                            console.error(`Error deleting from related table: ${err.message}`);
                            errors.push(err.message);
                            hasError = true;
                        }
                    }
                    
                    completedQueries++;
                    if (completedQueries === deleteQueries.length) {
                        if (hasError) {
                            db.run('ROLLBACK', (rollbackErr) => {
                                if (rollbackErr) {
                                    console.error('Error rolling back transaction:', rollbackErr.message);
                                }
                                reject(new Error(`Failed to delete related records: ${errors.join('; ')}`));
                            });
                        } else {
                            // Delete the invoice itself
                            db.run('DELETE FROM invoices WHERE id = ?', [invoiceId], function(err) {
                                if (err) {
                                    db.run('ROLLBACK', (rollbackErr) => {
                                        if (rollbackErr) {
                                            console.error('Error rolling back transaction:', rollbackErr.message);
                                        }
                                    });
                                    reject(err);
                                } else {
                                    db.run('COMMIT', (commitErr) => {
                                        if (commitErr) {
                                            console.error('Error committing transaction:', commitErr.message);
                                            reject(commitErr);
                                        } else {
                                            resolve(true);
                                        }
                                    });
                                }
                            });
                        }
                    }
                });
            });
        });
    });
}

async function main() {
    console.log('🔍 Mencari invoice voucher yang tidak punya voucher lagi...\n');
    
    try {
        const invoices = await getVoucherInvoices();
        console.log(`📋 Ditemukan ${invoices.length} invoice voucher di billing.db\n`);
        
        const orphanInvoices = [];
        
        for (const invoice of invoices) {
            // Extract username from notes: "Voucher Hotspot {username} - Profile: {profile}"
            const match = invoice.notes.match(/Voucher Hotspot\s+(\S+)/i);
            if (!match || !match[1]) {
                console.log(`⚠️  Invoice ${invoice.invoice_number} tidak memiliki format notes yang valid: ${invoice.notes}`);
                orphanInvoices.push({ invoice, reason: 'Invalid notes format' });
                continue;
            }
            
            const username = match[1];
            try {
                const exists = await checkVoucherExists(username);
                
                if (!exists) {
                    console.log(`❌ Invoice ${invoice.invoice_number} (voucher: ${username}) - Voucher tidak ditemukan di RADIUS`);
                    orphanInvoices.push({ invoice, username, reason: 'Voucher not found in RADIUS' });
                } else {
                    console.log(`✅ Invoice ${invoice.invoice_number} (voucher: ${username}) - Voucher masih ada`);
                }
            } catch (error) {
                console.error(`⚠️  Error checking voucher ${username} for invoice ${invoice.invoice_number}: ${error.message}`);
                // Jika error, anggap sebagai orphan untuk amannya
                orphanInvoices.push({ invoice, username, reason: `Error checking: ${error.message}` });
            }
        }
        
        console.log(`\n📊 Summary:`);
        console.log(`   Total invoice: ${invoices.length}`);
        console.log(`   Orphan invoices: ${orphanInvoices.length}`);
        console.log(`   Valid invoices: ${invoices.length - orphanInvoices.length}`);
        
        if (orphanInvoices.length === 0) {
            console.log('\n✅ Tidak ada invoice yang perlu dihapus.');
            return;
        }
        
        console.log('\n🗑️  Menghapus orphan invoices...\n');
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const { invoice, username, reason } of orphanInvoices) {
            try {
                await deleteInvoice(invoice.id);
                console.log(`✅ Berhasil menghapus invoice ${invoice.invoice_number} (voucher: ${username || 'unknown'})`);
                successCount++;
            } catch (error) {
                console.error(`❌ Gagal menghapus invoice ${invoice.invoice_number}: ${error.message}`);
                errorCount++;
            }
        }
        
        console.log('\n📊 Final Summary:');
        console.log(`   ✅ Berhasil dihapus: ${successCount}`);
        console.log(`   ❌ Error: ${errorCount}`);
        console.log(`   📝 Total: ${orphanInvoices.length}`);
        
    } catch (error) {
        console.error('❌ Terjadi kesalahan fatal:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    getVoucherInvoices,
    checkVoucherExists,
    deleteInvoice
};

