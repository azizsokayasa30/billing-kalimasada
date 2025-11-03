#!/usr/bin/env node

/**
 * Script untuk initialize database setelah clone dari GitHub
 * Menjalankan semua migration SQL files untuk membuat tabel yang diperlukan
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

// Run SQL file
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
        
        if (statements.length === 0) {
            return resolve();
        }
        
        statements.forEach((statement, index) => {
            db.run(statement, (err) => {
                if (err && !err.message.includes('already exists') && !err.message.includes('duplicate column')) {
                    // Only log actual errors, not "already exists" warnings
                    console.warn(`    ⚠️  Warning in statement ${index + 1}: ${err.message}`);
                    errors.push(err);
                }
                completed++;
                if (completed === statements.length) {
                    if (errors.length === 0 || errors.every(e => e.message.includes('already exists') || e.message.includes('duplicate column'))) {
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

// Main function
async function initDatabase() {
    try {
        console.log('\n📋 Running migrations...');
        
        const migrationFiles = getMigrationFiles();
        
        if (migrationFiles.length === 0) {
            console.warn('⚠️  No migration files found');
        } else {
            console.log(`Found ${migrationFiles.length} migration file(s)`);
            
            for (const file of migrationFiles) {
                try {
                    await runSQLFile(file);
                } catch (error) {
                    console.error(`❌ Error running ${path.basename(file)}:`, error.message);
                    // Continue with other migrations
                }
            }
        }
        
        console.log('\n✅ Database initialization completed!');
        console.log('\n📝 Next steps:');
        console.log('  1. Restart CVLMEDIA: pm2 restart cvlmedia');
        console.log('  2. Access web UI and setup RADIUS config via /admin/radius');
        
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

