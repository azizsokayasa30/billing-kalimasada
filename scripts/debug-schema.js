const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../data/billing.db');
const db = new sqlite3.Database(dbPath);

console.log('--- TECHNICIANS ---');
db.all('PRAGMA table_info(technicians)', [], (err, rows) => {
    console.log(JSON.stringify(rows, null, 2));
    
    console.log('\n--- CUSTOMERS ---');
    db.all('PRAGMA table_info(customers)', [], (err, rows) => {
        console.log(JSON.stringify(rows, null, 2));
        
        console.log('\n--- INVOICES ---');
        db.all('PRAGMA table_info(invoices)', [], (err, rows) => {
            console.log(JSON.stringify(rows, null, 2));
            db.close();
        });
    });
});
