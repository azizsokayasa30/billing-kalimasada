const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data/billing.db');
db.all("PRAGMA table_info(customers)", (err, rows) => {
    console.log("CUSTOMERS SCHEMA:");
    console.log(rows);
});
db.all("PRAGMA table_info(areas)", (err, rows) => {
    console.log("AREAS SCHEMA:");
    console.log(rows);
});
