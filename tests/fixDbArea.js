const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data/billing.db');

db.all(`
    SELECT c.id, c.area, c.area_id, a.nama_area 
    FROM customers c 
    JOIN areas a ON c.area_id = a.id 
    WHERE c.area = CAST(c.area_id AS TEXT) OR c.area IS NULL OR c.area = ''
`, (err, rows) => {
    if (err) {
        console.error("Error finding bad customers:", err);
        return;
    }
    
    if (!rows || rows.length === 0) {
        console.log("No customers need fixing.");
        return;
    }
    
    console.log(`Found ${rows.length} customers with incorrect area names. Fixing...`);
    
    const stmt = db.prepare("UPDATE customers SET area = ? WHERE id = ?");
    let completed = 0;
    
    rows.forEach(row => {
        stmt.run(row.nama_area, row.id, (updateErr) => {
            if (updateErr) console.error("Error updating customer:", row.id, updateErr);
            completed++;
            if (completed === rows.length) {
                stmt.finalize();
                console.log("Finished fixing areas.");
            }
        });
    });
});
