const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../data/billing.db');

console.log(`Connecting to database: ${dbPath}`);
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        process.exit(1);
    }
    console.log('Connected to the SQLite database.');
});

const migrations = [
    { query: 'ALTER TABLE technicians ADD COLUMN join_date DATETIME', isSchema: true },
    { query: 'UPDATE technicians SET join_date = CURRENT_TIMESTAMP WHERE join_date IS NULL', isSchema: false },
    { query: 'ALTER TABLE technicians ADD COLUMN whatsapp_group_id TEXT', isSchema: true },
    { query: 'ALTER TABLE technicians ADD COLUMN password TEXT', isSchema: true }
];

console.log('Running migrations to add missing columns to technicians table...');

let completed = 0;

migrations.forEach((item) => {
    db.run(item.query, (err) => {
        if (err) {
            if (err.message.includes('duplicate column')) {
                console.log(`Column already exists, skipping schema change: ${item.query}`);
            } else {
                console.error(`Error executing migration: ${item.query}`, err.message);
            }
        } else {
            console.log(`Successfully executed: ${item.query}`);
        }
        
        // Wait for all to finish before closing (very simple implementation)
        completed++;
        if (completed === migrations.length) {
            console.log('\nAll migrations completed.');
            db.close((err) => {
                if (err) console.error(err.message);
                console.log('Database connection closed.');
                process.exit(0);
            });
        }
    });
});
