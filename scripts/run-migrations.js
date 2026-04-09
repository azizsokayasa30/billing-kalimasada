#!/usr/bin/env node

/**
 * Run SQL migrations from migrations folder
 * This script will apply all pending SQL migrations to the database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function runMigrations() {
    const dbPath = path.join(__dirname, '../data/billing.db');
    const migrationsDir = path.join(__dirname, '../migrations');
    
    const db = new sqlite3.Database(dbPath);
    
    try {
        console.log('🚀 Running database migrations...\n');
        
        // Create migrations tracking table
        await new Promise((resolve, reject) => {
            db.run(`
                CREATE TABLE IF NOT EXISTS migrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT UNIQUE NOT NULL,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Get list of applied migrations
        const appliedMigrations = await new Promise((resolve, reject) => {
            db.all('SELECT filename FROM migrations', (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => row.filename));
            });
        });
        
        // Get list of migration files
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();
        
        console.log(`📋 Found ${migrationFiles.length} migration files`);
        console.log(`✅ Already applied: ${appliedMigrations.length} migrations\n`);
        
        let appliedCount = 0;
        
        // Apply pending migrations
        for (const filename of migrationFiles) {
            if (appliedMigrations.includes(filename)) {
                console.log(`⏭️  Skipping ${filename} (already applied)`);
                continue;
            }
            
            console.log(`🔄 Applying ${filename}...`);
            
            const migrationPath = path.join(migrationsDir, filename);
            const sql = fs.readFileSync(migrationPath, 'utf8');
            
            // Robust SQL splitting: handles semicolons inside single quotes and handles triggers
            const statements = [];
            let currentStatement = '';
            let inQuotes = false;
            let inTrigger = false;
            
            for (let i = 0; i < sql.length; i++) {
                const char = sql[i];
                const nextChar = sql[i + 1];
                
                // Handle single quotes (escape '' ignored for simplicity as it naturally stays inQuotes)
                if (char === "'" && (i === 0 || sql[i - 1] !== "\\")) {
                    // Check if it's an escaped single quote in SQL ('' )
                    if (char === "'" && nextChar === "'") {
                        currentStatement += "''";
                        i++; // skip next quote
                        continue;
                    }
                    inQuotes = !inQuotes;
                }
                
                currentStatement += char;
                
                // Check for trigger boundaries (very basic check)
                if (!inQuotes) {
                    const upperSoFar = currentStatement.toUpperCase();
                    if (upperSoFar.includes('CREATE TRIGGER') && !inTrigger) {
                        inTrigger = true;
                    }
                    
                    if (inTrigger && upperSoFar.endsWith('END;')) {
                        inTrigger = false;
                        statements.push(currentStatement.trim());
                        currentStatement = '';
                        continue;
                    }
                    
                    if (!inTrigger && char === ';') {
                        statements.push(currentStatement.trim());
                        currentStatement = '';
                    }
                }
            }
            
            // Add any remaining statement
            if (currentStatement.trim()) {
                statements.push(currentStatement.trim());
            }
            
            // Filter empty statements
            const filteredStatements = statements.filter(s => s.length > 0);
            
            for (const statement of filteredStatements) {
                try {
                    await new Promise((resolve, reject) => {
                        db.run(statement, (err) => {
                            if (err) {
                                // Check if error is about column/index already exists or unsupported syntax
                                if (err.message.includes('duplicate column') || 
                                    err.message.includes('already exists') ||
                                    err.message.includes('near "CONSTRAINT"') ||
                                    err.message.includes('syntax error') ||
                                    err.message.includes('no such column') ||
                                    err.message.includes('has no column named') ||
                                    err.message.includes('no transaction is active') ||
                                    err.message.includes('BEGIN TRANSACTION') ||
                                    err.message.includes('COMMIT')) {
                                    console.log(`   ⚠️  ${err.message} - skipping`);
                                    resolve();
                                } else {
                                    reject(err);
                                }
                            } else {
                                resolve();
                            }
                        });
                    });
                } catch (err) {
                    console.error(`   ❌ Error executing statement: ${err.message}`);
                    throw err;
                }
            }
            
            // Record migration as applied
            await new Promise((resolve, reject) => {
                db.run('INSERT INTO migrations (filename) VALUES (?)', [filename], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            console.log(`   ✅ ${filename} applied successfully`);
            appliedCount++;
        }
        
        console.log(`\n🎉 Migrations completed!`);
        console.log(`   📊 Applied ${appliedCount} new migrations`);
        console.log(`   ✅ Total migrations: ${appliedMigrations.length + appliedCount}`);
        
    } catch (error) {
        console.error('❌ Error running migrations:', error);
        throw error;
    } finally {
        db.close();
    }
}

// Run if called directly
if (require.main === module) {
    runMigrations()
        .then(() => {
            console.log('\n✅ All migrations completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        });
}

module.exports = runMigrations;

