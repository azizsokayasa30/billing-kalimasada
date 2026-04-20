const path = require('path');
const fs = require('fs');

console.log('--- Path Debug ---');
console.log('process.cwd():', process.cwd());
console.log('__dirname:', __dirname);

const path1 = path.join(process.cwd(), 'data/billing.db');
const path2 = path.join(__dirname, '../data/billing.db');

console.log('Path from cwd:', path1, 'Exists:', fs.existsSync(path1));
console.log('Path from __dirname:', path2, 'Exists:', fs.existsSync(path2));

if (fs.existsSync(path1)) {
    const stats = fs.statSync(path1);
    console.log('cwd DB size:', stats.size);
}

if (fs.existsSync(path2)) {
    const stats = fs.statSync(path2);
    console.log('dirname DB size:', stats.size);
}

// Check routers count in both
const sqlite3 = require('sqlite3').verbose();

async function check(p, label) {
    return new Promise((resolve) => {
        if (!fs.existsSync(p)) {
            console.log(`${label}: File not found`);
            return resolve();
        }
        const db = new sqlite3.Database(p);
        db.all('SELECT * FROM routers', (err, rows) => {
            if (err) {
                console.log(`${label}: Error - ${err.message}`);
            } else {
                console.log(`${label}: Found ${rows.length} routers`);
            }
            db.close();
            resolve();
        });
    });
}

async function run() {
    await check(path1, 'CWD DB');
    await check(path2, 'DIRNAME DB');
}

run();
