const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'billing.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

db.all('SELECT * FROM routers', (err, rows) => {
    if (err) {
        console.error('Error querying routers:', err.message);
    } else {
        console.log('Routers in database:');
        console.log(JSON.stringify(rows, null, 2));
    }
    db.close();
});
