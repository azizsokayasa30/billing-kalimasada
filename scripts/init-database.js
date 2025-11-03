#!/usr/bin/env node

/**
 * Script untuk initialize database setelah clone dari GitHub
 * 1. Membuat tabel dasar melalui BillingManager.createTables()
 * 2. Menjalankan semua migration SQL files untuk update schema
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/billing.db');
const migrationsPath = path.join(__dirname, '../migrations');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

console.log('📦 Initializing CVLMEDIA database...');
console.log(`Database path: ${dbPath}`);

// Open database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err);
        process.exit(1);
    }
    console.log('✅ Database connected');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON', (err) => {
    if (err) {
        console.error('⚠️  Warning: Could not enable foreign keys:', err);
    }
});

// Import BillingManager untuk create tabel dasar
// Note: billing.js exports instance, not class, so we'll create tables directly via SQL

// Run SQL file (ignore "no such table" errors for ALTER/CREATE INDEX - normal for migrations)
function runSQLFile(filePath) {
    return new Promise((resolve, reject) => {
        console.log(`  📄 Running: ${path.basename(filePath)}`);
        
        const sql = fs.readFileSync(filePath, 'utf-8');
        
        // Split by semicolon and run each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        let completed = 0;
        let errors = [];
        let warnings = 0;
        
        if (statements.length === 0) {
            return resolve();
        }
        
        statements.forEach((statement, index) => {
            // Skip empty or comment-only statements
            if (!statement || statement.startsWith('--')) {
                completed++;
                if (completed === statements.length) {
                    if (warnings > 0 && errors.length === 0) {
                        console.log(`    ✅ Completed with ${warnings} warning(s) (expected)`);
                        resolve();
                    } else if (errors.length === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Errors in ${filePath}: ${errors.map(e => e.message).join('; ')}`));
                    }
                }
                return;
            }
            
            db.run(statement, (err) => {
                if (err) {
                    // Ignore expected errors:
                    // - "already exists" (table/column/index already exists)
                    // - "duplicate column" (column already exists)
                    // - "no such table" (normal for ALTER/INDEX before CREATE TABLE)
                    // - "cannot commit - no transaction is active" (normal if no BEGIN)
                    const ignorableErrors = [
                        'already exists',
                        'duplicate column',
                        'no such table',
                        'cannot commit - no transaction is active'
                    ];
                    
                    const isIgnorable = ignorableErrors.some(msg => err.message.includes(msg));
                    
                    if (isIgnorable) {
                        warnings++;
                        // Don't log expected warnings to reduce noise
                    } else {
                        // Only log real errors
                        console.warn(`    ⚠️  Warning in statement ${index + 1}: ${err.message}`);
                        errors.push(err);
                    }
                }
                
                completed++;
                if (completed === statements.length) {
                    if (warnings > 0 && errors.length === 0) {
                        // All errors were ignorable
                        resolve();
                    } else if (errors.length === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Errors in ${filePath}: ${errors.map(e => e.message).join('; ')}`));
                    }
                }
            });
        });
    });
}

// Get all migration files
function getMigrationFiles() {
    if (!fs.existsSync(migrationsPath)) {
        console.warn('⚠️  Migrations directory not found:', migrationsPath);
        return [];
    }
    
    const files = fs.readdirSync(migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .map(file => path.join(migrationsPath, file))
        .sort(); // Run in alphabetical order
    
    return files;
}

// Create base tables directly via SQL (from billing.js createTables)
function createBaseTables() {
    return new Promise((resolve, reject) => {
        console.log('\n📋 Step 1: Creating base tables...');
        
        const baseTables = [
            `CREATE TABLE IF NOT EXISTS packages (
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
                image TEXT,
                FOREIGN KEY (router_id) REFERENCES routers(id)
            )`,
            `CREATE TABLE IF NOT EXISTS customers (
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
                FOREIGN KEY (package_id) REFERENCES packages (id)
            )`,
            `CREATE TABLE IF NOT EXISTS routers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                nas_ip TEXT NOT NULL,
                nas_identifier TEXT,
                secret TEXT,
                UNIQUE(nas_ip)
            )`,
            `CREATE TABLE IF NOT EXISTS customer_router_map (
                customer_id INTEGER NOT NULL,
                router_id INTEGER NOT NULL,
                PRIMARY KEY (customer_id),
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS invoices (
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
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers (id),
                FOREIGN KEY (package_id) REFERENCES packages (id)
            )`,
            `CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id INTEGER NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                payment_method TEXT NOT NULL,
                reference_number TEXT,
                notes TEXT,
                FOREIGN KEY (invoice_id) REFERENCES invoices (id)
            )`,
            `CREATE TABLE IF NOT EXISTS payment_gateway_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id INTEGER NOT NULL,
                gateway TEXT NOT NULL,
                order_id TEXT NOT NULL,
                payment_url TEXT,
                token TEXT,
                amount DECIMAL(10,2) NOT NULL,
                status TEXT DEFAULT 'pending',
                payment_type TEXT,
                fraud_status TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (invoice_id) REFERENCES invoices (id)
            )`,
            `CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                description TEXT NOT NULL,
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                expense_date DATE NOT NULL,
                payment_method TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS odps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL UNIQUE,
                code VARCHAR(50) NOT NULL UNIQUE,
                latitude DECIMAL(10,8) NOT NULL,
                longitude DECIMAL(11,8) NOT NULL,
                address TEXT,
                capacity INTEGER DEFAULT 64,
                used_ports INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
                installation_date DATE,
                notes TEXT,
                parent_odp_id INTEGER,
                is_pole BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS technicians (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('technician', 'field_officer', 'collector')),
                email TEXT,
                notes TEXT,
                is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
                area_coverage TEXT,
                whatsapp_group TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )`,
            `CREATE TABLE IF NOT EXISTS app_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];
        
        let completed = 0;
        let errors = [];
        
        baseTables.forEach((sql) => {
            db.run(sql, (err) => {
                if (err) {
                    // Ignore "already exists" errors
                    if (!err.message.includes('already exists')) {
                        console.warn(`    ⚠️  Warning: ${err.message}`);
                        errors.push(err);
                    }
                }
                completed++;
                if (completed === baseTables.length) {
                    if (errors.length === 0 || errors.every(e => e.message.includes('already exists'))) {
                        console.log('✅ Base tables created');
                        resolve();
                    } else {
                        console.warn(`⚠️  Some warnings occurred, but continuing...`);
                        resolve();
                    }
                }
            });
        });
    });
}

// Main function
async function initDatabase() {
    try {
        // Step 1: Create base tables first
        await createBaseTables();
        
        // Step 2: Run migrations
        console.log('\n📋 Step 2: Running migrations...');
        
        const migrationFiles = getMigrationFiles();
        
        if (migrationFiles.length === 0) {
            console.warn('⚠️  No migration files found');
        } else {
            console.log(`Found ${migrationFiles.length} migration file(s)`);
            
            let successCount = 0;
            let errorCount = 0;
            
            for (const file of migrationFiles) {
                try {
                    await runSQLFile(file);
                    successCount++;
                } catch (error) {
                    // Check if it's just "no such table" errors (expected)
                    if (error.message.includes('no such table')) {
                        console.log(`    ⚠️  ${path.basename(file)}: Skipped (tables will be created on app start)`);
                        successCount++;
                    } else {
                        console.error(`    ❌ ${path.basename(file)}: ${error.message}`);
                        errorCount++;
                    }
                }
            }
            
            console.log(`\n📊 Migration summary: ${successCount} succeeded, ${errorCount} failed`);
        }
        
        // Verify technicians table exists
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='technicians'", (err, row) => {
            if (err) {
                console.warn('⚠️  Could not verify technicians table');
            } else if (!row) {
                console.warn('⚠️  technicians table not found - will be created on app start');
            } else {
                console.log('✅ Verified: technicians table exists');
            }
        });
        
        console.log('\n✅ Database initialization completed!');
        console.log('\n📝 Next steps:');
        console.log('  1. Restart CVLMEDIA: pm2 restart BillCVLmedia');
        console.log('  2. Access web UI and setup RADIUS config via /admin/radius');
        console.log('\n⚠️  Note: Some tables will be created automatically on first app start');
        
        db.close((err) => {
            if (err) {
                console.error('⚠️  Error closing database:', err);
            }
            process.exit(0);
        });
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        db.close();
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    initDatabase();
}

module.exports = { initDatabase };

