const db = require('../config/billing').db;

// Test SQL untuk bulan April - harusnya total=5, aktif=4, nonaktif=1
const endDateApril = '2026-05-01';
db.get(
    `SELECT 
        COUNT(DISTINCT c.id) as total,
        SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END) as aktif,
        SUM(CASE WHEN c.status = 'suspended' OR c.status = 'isolir' THEN 1 ELSE 0 END) as nonaktif
    FROM customers c
    WHERE date(c.join_date) < date(?)`,
    [endDateApril],
    (err, row) => {
        if (err) console.error('Error April:', err);
        else console.log('Stats April (join_date < 2026-05-01):', row);
    }
);

// Test SQL untuk bulan Maret - harusnya total=0
const endDateMarch = '2026-04-01';
db.get(
    `SELECT 
        COUNT(DISTINCT c.id) as total,
        SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END) as aktif,
        SUM(CASE WHEN c.status = 'suspended' OR c.status = 'isolir' THEN 1 ELSE 0 END) as nonaktif
    FROM customers c
    WHERE date(c.join_date) < date(?)`,
    [endDateMarch],
    (err, row) => {
        if (err) console.error('Error March:', err);
        else console.log('Stats March (join_date < 2026-04-01):', row);
        process.exit(0);
    }
);
