const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Simulate the logic in routes/adminMikrotik.js
const DB_PATH = path.join(__dirname, '../data/billing.db');

console.log('Testing connection to:', DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

db.all('SELECT * FROM routers ORDER BY id', [], (err, rows) => {
    if (err) {
        console.error('Error executing query:', err.message);
    } else {
        console.log('Successfully fetched routers count:', rows.length);
        if (rows.length > 0) {
            console.log('First router:', rows[0].name);
        } else {
            console.log('No routers found in table.');
        }
    }
    db.close();
});
