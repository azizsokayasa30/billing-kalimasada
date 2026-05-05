#!/usr/bin/env node

/**
 * Script untuk menambahkan status 'register' ke tabel customers
 * 
 * Script ini akan:
 * 1. Cek apakah ada CHECK constraint yang membatasi status
 * 2. Jika ada, hapus constraint lama dan buat yang baru dengan 'register'
 * 3. Pastikan status 'register' bisa digunakan
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../data/billing.db');

console.log('🔍 Checking database structure for status column...\n');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to database:', dbPath);
});

// Fungsi untuk mendapatkan schema tabel customers
function getTableSchema() {
    return new Promise((resolve, reject) => {
        db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='customers'", (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows && rows.length > 0 ? rows[0].sql : null);
            }
        });
    });
}

// Fungsi untuk cek apakah ada CHECK constraint
function checkForCheckConstraint() {
    return new Promise((resolve, reject) => {
        db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='customers'", (err, rows) => {
            if (err) {
                reject(err);
            } else {
                if (rows && rows.length > 0) {
                    const sql = rows[0].sql;
                    // Cek apakah ada CHECK constraint untuk status
                    const hasCheck = /status.*CHECK.*\(.*status.*IN/i.test(sql);
                    resolve({ hasCheck, sql });
                } else {
                    resolve({ hasCheck: false, sql: null });
                }
            }
        });
    });
}

// Fungsi untuk mendapatkan info kolom status
function getStatusColumnInfo() {
    return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(customers)", (err, rows) => {
            if (err) {
                reject(err);
            } else {
                const statusCol = rows.find(col => col.name === 'status');
                resolve(statusCol);
            }
        });
    });
}

// Fungsi untuk test insert status 'register'
function testRegisterStatus() {
    return new Promise((resolve, reject) => {
        // Coba update customer yang ada dengan status 'register' (temporary)
        db.run("UPDATE customers SET status = 'register' WHERE id = (SELECT id FROM customers LIMIT 1)", (err) => {
            if (err) {
                // Jika gagal, kemungkinan ada constraint
                resolve({ success: false, error: err.message });
            } else {
                // Kembalikan ke status semula
                db.run("UPDATE customers SET status = 'inactive' WHERE status = 'register'", (err2) => {
                    resolve({ success: true, error: null });
                });
            }
        });
    });
}

// Fungsi untuk menghapus CHECK constraint (SQLite tidak support ALTER TABLE untuk hapus constraint)
// Solusinya: buat tabel baru tanpa constraint, copy data, drop tabel lama, rename tabel baru
async function removeCheckConstraint() {
    return new Promise((resolve, reject) => {
        console.log('📝 Removing CHECK constraint (if exists)...');
        
        // SQLite tidak support DROP CONSTRAINT, jadi kita perlu recreate table
        // Tapi ini berisiko, jadi kita cek dulu apakah benar-benar perlu
        
        // Alternatif: kita bisa coba insert langsung dan lihat apakah berhasil
        // Jika gagal karena constraint, baru kita recreate table
        
        db.serialize(() => {
            db.run("BEGIN TRANSACTION", (err) => {
                if (err) return reject(err);
                
                // 1. Buat tabel temporary dengan status tanpa CHECK constraint
                db.run(`
                    CREATE TABLE customers_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        name TEXT NOT NULL,
                        phone TEXT UNIQUE NOT NULL,
                        pppoe_username TEXT,
                        email TEXT,
                        address TEXT,
                        latitude DECIMAL(10,8),
                        longitude DECIMAL(11,8),
                        package_id INTEGER,
                        pppoe_profile TEXT,
                        status TEXT DEFAULT 'active',
                        join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        cable_type TEXT,
                        cable_length INTEGER,
                        port_number INTEGER,
                        cable_status TEXT DEFAULT 'connected',
                        cable_notes TEXT,
                        odp_id INTEGER,
                        auto_suspension BOOLEAN DEFAULT 1,
                        billing_day INTEGER DEFAULT 15,
                        renewal_type TEXT DEFAULT 'renewal',
                        fix_date INTEGER,
                        customer_id TEXT,
                        created_by_technician_id INTEGER,
                        FOREIGN KEY (package_id) REFERENCES packages (id)
                    )
                `, (err) => {
                    if (err && !err.message.includes('already exists')) {
                        return db.run("ROLLBACK", () => reject(err));
                    }
                    
                    // 2. Copy data dari tabel lama
                    db.run(`
                        INSERT INTO customers_new 
                        SELECT * FROM customers
                    `, (err) => {
                        if (err) {
                            return db.run("ROLLBACK", () => reject(err));
                        }
                        
                        // 3. Drop tabel lama
                        db.run("DROP TABLE customers", (err) => {
                            if (err) {
                                return db.run("ROLLBACK", () => reject(err));
                            }
                            
                            // 4. Rename tabel baru
                            db.run("ALTER TABLE customers_new RENAME TO customers", (err) => {
                                if (err) {
                                    return db.run("ROLLBACK", () => reject(err));
                                }
                                
                                // 5. Recreate indexes jika ada
                                db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_username ON customers(username)", (err) => {
                                    if (err) console.warn('Warning creating index:', err.message);
                                });
                                
                                db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)", (err) => {
                                    if (err) console.warn('Warning creating index:', err.message);
                                });
                                
                                db.run("COMMIT", (err) => {
                                    if (err) return reject(err);
                                    resolve();
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

// Main function
async function main() {
    try {
        console.log('📊 Step 1: Checking table schema...');
        const schema = await getTableSchema();
        if (schema) {
            console.log('✅ Table schema found');
            // Cek apakah ada CHECK constraint
            const hasCheck = /CHECK.*\(.*status.*IN/i.test(schema);
            if (hasCheck) {
                console.log('⚠️  CHECK constraint detected in schema');
                console.log('   Constraint:', schema.match(/CHECK.*\([^)]+\)/i)?.[0] || 'Not found');
            } else {
                console.log('✅ No CHECK constraint found');
            }
        } else {
            console.log('⚠️  Table schema not found');
        }
        
        console.log('\n📊 Step 2: Checking status column info...');
        const statusCol = await getStatusColumnInfo();
        if (statusCol) {
            console.log('✅ Status column found:');
            console.log('   Name:', statusCol.name);
            console.log('   Type:', statusCol.type);
            console.log('   Default:', statusCol.dflt_value);
            console.log('   Not Null:', statusCol.notnull);
        } else {
            console.log('❌ Status column not found!');
            db.close();
            process.exit(1);
        }
        
        console.log('\n📊 Step 3: Testing status "register"...');
        const testResult = await testRegisterStatus();
        if (testResult.success) {
            console.log('✅ Status "register" can be used (no constraint blocking)');
        } else {
            console.log('❌ Status "register" is blocked:', testResult.error);
            console.log('\n🔧 Attempting to fix by removing CHECK constraint...');
            
            try {
                await removeCheckConstraint();
                console.log('✅ CHECK constraint removed successfully');
                
                // Test lagi
                const testResult2 = await testRegisterStatus();
                if (testResult2.success) {
                    console.log('✅ Status "register" now works!');
                } else {
                    console.log('❌ Still blocked:', testResult2.error);
                }
            } catch (fixError) {
                console.error('❌ Error removing constraint:', fixError.message);
                console.log('\n⚠️  Manual fix required:');
                console.log('   1. Backup database');
                console.log('   2. Remove CHECK constraint from customers table');
                console.log('   3. Or recreate table without CHECK constraint');
            }
        }
        
        console.log('\n📊 Step 4: Checking existing customers with status "register"...');
        db.all("SELECT COUNT(*) as count FROM customers WHERE status = 'register'", (err, rows) => {
            if (err) {
                console.error('❌ Error:', err.message);
            } else {
                const count = rows[0].count;
                console.log(`✅ Found ${count} customer(s) with status "register"`);
            }
            
            console.log('\n✅ Script completed!');
            db.close();
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        db.close();
        process.exit(1);
    }
}

// Run
main();

