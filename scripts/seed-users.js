#!/usr/bin/env node

/**
 * Seeder: Membuat akun Collector dan Technician untuk testing login di mobile app
 * 
 * Usage: node scripts/seed-users.js
 * Atau di Docker: docker exec gembok-bill node scripts/seed-users.js
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, '../data/billing.db');
const db = new sqlite3.Database(dbPath);

const SALT_ROUNDS = 10;

function hashPassword(password) {
    return bcrypt.hashSync(password, SALT_ROUNDS);
}

async function seed() {
    console.log('🌱 Starting database seeder...\n');

    // 1. Ensure collectors table exists
    await new Promise((resolve, reject) => {
        db.run(`CREATE TABLE IF NOT EXISTS collectors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            email TEXT,
            password TEXT,
            area TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    // 1b. Ensure collector_payments table exists
    await new Promise((resolve, reject) => {
        db.run(`CREATE TABLE IF NOT EXISTS collector_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collector_id INTEGER NOT NULL,
            invoice_id INTEGER NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            commission_amount DECIMAL(10,2) NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            paid_at DATETIME
        )`, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    // 2. Ensure technicians table has password column
    await new Promise((resolve) => {
        db.run(`ALTER TABLE technicians ADD COLUMN password TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column')) console.log('ALTER techs:', err.message);
            resolve();
        });
    });
    
    await new Promise((resolve) => {
        db.run(`ALTER TABLE collectors ADD COLUMN password TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column')) console.log('ALTER collectors password:', err.message);
            resolve();
        });
    });

    await new Promise((resolve) => {
        db.run(`ALTER TABLE collectors ADD COLUMN area TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column')) console.log('ALTER collectors area:', err.message);
            resolve();
        });
    });

    // 2b. Ensure technicians table exists (if not created yet)
    await new Promise((resolve, reject) => {
        db.run(`CREATE TABLE IF NOT EXISTS technicians (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL DEFAULT 'technician',
            email TEXT,
            password TEXT,
            notes TEXT,
            is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
            area_coverage TEXT,
            whatsapp_group TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )`, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    // 3. Seed Collector
    let collectorId = 1;
    const collectorPassword = hashPassword('collector123');
    try {
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO collectors (name, phone, email, password, area, status) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                ['Collector Demo', '6281368888498', 'collector@demo.com', collectorPassword, 'Bengkulu', 'active'],
                function(err) {
                    if (err) reject(err);
                    else {
                        collectorId = this.lastID || collectorId;
                        resolve(collectorId);
                    }
                }
            );
        });
        console.log('✅ Collector seeded:');
        console.log('   📱 Phone/Username: 6281368888498');
        console.log('   🔑 Password: collector123\n');
    } catch (err) {
        console.log('⚠️  Collector already exists or error:', err.message);
    }

    // 4. Seed Technician
    let technicianId = 1;
    const techPassword = hashPassword('tech123');
    try {
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO technicians (name, phone, role, password, is_active, area_coverage) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                ['Teknisi Demo', '6281368888498', 'technician', techPassword, 1, 'Bengkulu'],
                function(err) {
                    if (err) reject(err);
                    else {
                        technicianId = this.lastID || technicianId;
                        resolve(technicianId);
                    }
                }
            );
        });
        console.log('✅ Technician seeded:');
        console.log('   📱 Phone/Username: 6281368888498');
        console.log('   🔑 Password: tech123\n');
    } catch (err) {
        console.log('⚠️  Technician already exists or error:', err.message);
    }

    // 5. Seed Router
    let routerId = 1;
    try {
        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS routers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                nas_ip TEXT NOT NULL,
                nas_identifier TEXT,
                secret TEXT,
                UNIQUE(nas_ip)
            )`, (err) => err ? reject(err) : resolve());
        });

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR IGNORE INTO routers (id, name, nas_ip, nas_identifier, secret) 
                 VALUES (?, ?, ?, ?, ?)`,
                [routerId, 'Router Utama', '192.168.1.1', 'MikroTik-Main', 'rahasia123'],
                function(err) {
                    if (err) reject(err);
                    else {
                        routerId = this.lastID || routerId;
                        resolve(routerId);
                    }
                }
            );
        });
        console.log('✅ Router seeded');
    } catch (err) {
        console.log('⚠️  Router error:', err.message);
    }

    // 6. Seed Package
    let packageId = 1;
    try {
        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS packages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                speed TEXT NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                tax_rate DECIMAL(5,2) DEFAULT 11.00,
                description TEXT,
                pppoe_profile TEXT DEFAULT 'default',
                router_id INTEGER,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                image TEXT
            )`, (err) => err ? reject(err) : resolve());
        });

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR IGNORE INTO packages (id, name, speed, price, description, router_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [packageId, 'Paket Family 20Mbps', '20Mbps', 150000, 'Paket internet keluarga murah meriah', routerId],
                function(err) {
                    if (err) reject(err);
                    else {
                        packageId = this.lastID || packageId;
                        resolve(packageId);
                    }
                }
            );
        });
        console.log('✅ Package seeded');
    } catch (err) {
        console.log('⚠️  Package error:', err.message);
    }

    // 7. Seed ODP
    let odpId = 1;
    try {
        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS odps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL UNIQUE,
                code VARCHAR(50) NOT NULL UNIQUE,
                latitude DECIMAL(10,8) NOT NULL,
                longitude DECIMAL(11,8) NOT NULL,
                address TEXT,
                capacity INTEGER DEFAULT 64,
                used_ports INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'active',
                installation_date DATE,
                parent_odp_id INTEGER,
                is_pole BOOLEAN DEFAULT 0
            )`, (err) => err ? reject(err) : resolve());
        });

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR IGNORE INTO odps (id, name, code, latitude, longitude, address, capacity) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [odpId, 'ODP Pusat', 'ODP-001', -3.788, 102.266, 'Jl. Jend. Sudirman, Bengkulu', 16],
                function(err) {
                    if (err) reject(err);
                    else {
                        odpId = this.lastID || odpId;
                        resolve(odpId);
                    }
                }
            );
        });
        console.log('✅ ODP seeded');
    } catch (err) {
        console.log('⚠️  ODP error:', err.message);
    }

    // 8. Seed Multiple Customers
    const dummyCustomers = [
        { id: 1, user: 'budi001', name: 'Budi Santoso', phone: '6281234567890', address: 'Jl. Merdeka No 1' },
        { id: 2, user: 'siti002', name: 'Siti Aminah', phone: '6281234567891', address: 'Jl. Sudirman No 15' },
        { id: 3, user: 'bambang003', name: 'Bambang Pamungkas', phone: '6281234567892', address: 'Jl. Melati No 8' },
        { id: 4, user: 'ayu004', name: 'Ayu Lestari', phone: '6281234567893', address: 'Jl. Mawar No 22' },
        { id: 5, user: 'hendra005', name: 'Hendra Wijaya', phone: '6281234567894', address: 'Jl. Anggrek No 5' }
    ];

    try {
        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS customers (
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
                fix_date INTEGER
            )`, (err) => err ? reject(err) : resolve());
        });

        for (const cust of dummyCustomers) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR REPLACE INTO customers (id, username, name, phone, email, address, package_id, odp_id) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [cust.id, cust.user, cust.name, cust.phone, cust.user + '@demo.com', cust.address, packageId, odpId],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
        console.log('✅ 5 Customers seeded');
    } catch (err) {
        console.log('⚠️  Customer error:', err.message);
    }

    // 9. Seed Multiple Invoices
    try {
        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
                package_id INTEGER NOT NULL,
                invoice_number TEXT UNIQUE NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                due_date DATE NOT NULL,
                status TEXT DEFAULT 'unpaid',
                payment_date DATETIME,
                payment_method TEXT,
                payment_gateway TEXT,
                payment_token TEXT,
                payment_url TEXT,
                payment_status TEXT DEFAULT 'pending',
                notes TEXT,
                description TEXT,
                invoice_type TEXT DEFAULT 'monthly',
                package_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => err ? reject(err) : resolve());
        });

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7); // Due in 7 days
        
        let invCounter = 1;
        for (const cust of dummyCustomers) {
            // Create 1 unpaid invoice for each
            const invoiceNoUnpaid = 'INV-' + new Date().getFullYear() + '000' + invCounter++;
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR REPLACE INTO invoices (customer_id, package_id, invoice_number, amount, due_date, status, description, package_name) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [cust.id, packageId, invoiceNoUnpaid, 150000, dueDate.toISOString().split('T')[0], 'unpaid', 'Tagihan Internet Bulan Ini', 'Paket Family 20Mbps'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            // Create 1 paid invoice for each
            const invoiceNoPaid = 'INV-' + new Date().getFullYear() + '000' + invCounter++;
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR REPLACE INTO invoices (customer_id, package_id, invoice_number, amount, due_date, status, payment_date, description, package_name) 
                     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
                    [cust.id, packageId, invoiceNoPaid, 150000, dueDate.toISOString().split('T')[0], 'paid', 'Tagihan Internet Bulan Lalu', 'Paket Family 20Mbps'],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
        console.log('✅ 10 Invoices seeded (5 unpaid, 5 paid)');
    } catch (err) {
        console.log('⚠️  Invoice error:', err.message);
    }

    // 10. Seed Members
    try {
        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                email TEXT,
                address TEXT,
                status TEXT DEFAULT 'active',
                join_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => err ? reject(err) : resolve());
        });

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR IGNORE INTO members (name, phone, email, address) 
                 VALUES (?, ?, ?, ?)`,
                ['Member Demo', '6289876543210', 'member@demo.com', 'Jl. Sudirman No 2'],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
        console.log('✅ Member seeded');
    } catch (err) {
        console.log('⚠️  Member error:', err.message);
    }

    // 11. Seed Multiple Collector Payments (for mobile app stats)
    try {
        for (let i = 1; i <= 5; i++) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR REPLACE INTO collector_payments (collector_id, invoice_id, amount, commission_amount, status) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [collectorId, i * 2, 150000, 7500, 'completed'], // Link to the even (paid) invoices
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
        console.log('✅ 5 Collector Payments seeded');
    } catch (err) {
        console.log('⚠️  Collector Payment error:', err.message);
    }

    // 12. Seed Installation Job (for mobile app technician dashboard)
    try {
        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS installation_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sn TEXT,
                odp TEXT,
                customer_name TEXT NOT NULL,
                address TEXT NOT NULL,
                phone TEXT NOT NULL,
                latitude DECIMAL(10,8),
                longitude DECIMAL(11,8),
                package_id INTEGER,
                assigned_technician_id INTEGER,
                assigned_by INTEGER,
                status VARCHAR(20) DEFAULT 'pending',
                scheduled_date DATE,
                completed_date DATETIME,
                signal_level TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => err ? reject(err) : resolve());
        });

        await new Promise(resolve => db.run(`ALTER TABLE installation_jobs ADD COLUMN address TEXT`, () => resolve()));
        await new Promise(resolve => db.run(`ALTER TABLE installation_jobs ADD COLUMN customer_name TEXT`, () => resolve()));
        await new Promise(resolve => db.run(`ALTER TABLE installation_jobs ADD COLUMN phone TEXT`, () => resolve()));
        await new Promise(resolve => db.run(`ALTER TABLE installation_jobs ADD COLUMN scheduled_date DATE`, () => resolve()));
        await new Promise(resolve => db.run(`ALTER TABLE installation_jobs ADD COLUMN package_id INTEGER`, () => resolve()));
        await new Promise(resolve => db.run(`ALTER TABLE installation_jobs ADD COLUMN assigned_technician_id INTEGER`, () => resolve()));
        await new Promise(resolve => db.run(`ALTER TABLE installation_jobs ADD COLUMN assigned_by INTEGER`, () => resolve()));
        await new Promise(resolve => db.run(`ALTER TABLE installation_jobs ADD COLUMN sn TEXT`, () => resolve()));
        await new Promise(resolve => db.run(`ALTER TABLE installation_jobs ADD COLUMN odp TEXT`, () => resolve()));
        await new Promise(resolve => db.run(`ALTER TABLE installation_jobs ADD COLUMN signal_level TEXT`, () => resolve()));

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR IGNORE INTO installation_jobs (customer_name, address, phone, package_id, assigned_technician_id, status, scheduled_date) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['Joko Kendil', 'Jl. Pahlawan No 10', '6281999999999', packageId, technicianId, 'pending', new Date().toISOString().split('T')[0]],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
        console.log('✅ Installation Job seeded');
    } catch (err) {
        console.log('⚠️  Installation Job error:', err.message);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 Login di Mobile App:');
    console.log('');
    console.log('  Collector:');
    console.log('    Username: 6281368888498');
    console.log('    Password: collector123');
    console.log('');
    console.log('');
    console.log('  Customer/Member (via Web):');
    console.log('    Phone: 6281234567890 (Customer Budi)');
    console.log('    Phone: 6289876543210 (Member Demo)');
    console.log('      *Login pakai OTP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    db.close();
    console.log('\n🌱 Seeder completed!');
}

seed().catch(err => {
    console.error('❌ Seeder error:', err);
    db.close();
    process.exit(1);
});
