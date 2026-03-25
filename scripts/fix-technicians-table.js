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
    'ALTER TABLE technicians ADD COLUMN join_date DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE technicians ADD COLUMN whatsapp_group_id TEXT',
    'ALTER TABLE technicians ADD COLUMN password TEXT'
];

console.log('Running migrations to add missing columns to technicians table...');

let completed = 0;

migrations.forEach((query) => {
    db.run(query, (err) => {
        if (err) {
            if (err.message.includes('duplicate column')) {
                console.log(`Column already exists, skipping: ${query}`);
            } else {
                console.error(`Error executing migration: ${query}`, err.message);
            }
        } else {
            console.log(`Successfully added column: ${query}`);
        }
        
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
