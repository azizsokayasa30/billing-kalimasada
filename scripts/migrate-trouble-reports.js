const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '../data/billing.db');
const jsonPath = path.join(__dirname, '../logs/trouble_reports.json');
const db = new sqlite3.Database(dbPath);

async function migrate() {
    console.log('🚀 Starting Trouble Reports migration...');

    // 1. Create Table
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS trouble_reports (
            id TEXT PRIMARY KEY,
            status TEXT DEFAULT 'open',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            name TEXT,
            phone TEXT,
            location TEXT,
            category TEXT,
            description TEXT,
            assigned_technician_id INTEGER,
            priority TEXT DEFAULT 'Normal',
            notes TEXT
        )
    `;

    await new Promise((resolve, reject) => {
        db.run(createTableQuery, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    console.log('✅ table trouble_reports ready.');

    // 2. Read JSON
    if (!fs.existsSync(jsonPath)) {
        console.log('⚠️ No JSON file found. Migration skipped.');
        db.close();
        return;
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`📦 Found ${data.length} records to migrate.`);

    // 3. Insert Data
    const insertQuery = `
        INSERT OR REPLACE INTO trouble_reports (
            id, status, created_at, updated_at, name, phone, location, 
            category, description, assigned_technician_id, priority, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const item of data) {
        const params = [
            item.id,
            item.status,
            item.createdAt || item.created_at,
            item.updatedAt || item.updated_at,
            item.name,
            item.phone,
            item.location,
            item.category,
            item.description,
            item.assignedTechnicianId || item.assigned_technician_id,
            item.priority,
            JSON.stringify(item.notes || [])
        ];

        await new Promise((resolve, reject) => {
            db.run(insertQuery, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log(`✅ Migrated ${item.id}`);
    }

    console.log('🎉 Migration completed successfully!');
    db.close();
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
