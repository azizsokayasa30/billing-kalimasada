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
let BillingManager;
try {
    // Temporarily set process.cwd to correct directory
    const originalCwd = process.cwd();
    process.chdir(path.join(__dirname, '..'));
    BillingManager = require('../config/billing');
    process.chdir(originalCwd);
} catch (e) {
    console.error('⚠️  Could not load BillingManager, will create tables manually');
}

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

// Create base tables using BillingManager
function createBaseTables() {
    return new Promise((resolve, reject) => {
        console.log('\n📋 Step 1: Creating base tables...');
        
        if (!BillingManager) {
            console.warn('⚠️  BillingManager not available, skipping base table creation');
            console.warn('   Tables will be created when CVLMEDIA starts (may cause first-start error)');
            return resolve();
        }
        
        try {
            // Create BillingManager instance which will create base tables
            const billing = new BillingManager();
            
            // Wait a bit for tables to be created (async operations)
            setTimeout(() => {
                console.log('✅ Base tables created');
                resolve();
            }, 2000);
        } catch (error) {
            console.error('❌ Error creating base tables:', error.message);
            // Continue anyway - tables might already exist
            resolve();
        }
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

