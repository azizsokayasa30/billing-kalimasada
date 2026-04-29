const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'radius.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error connecting:", err);
        return;
    }
    console.log("Connected to", dbPath);
    
    db.all("SELECT * FROM nas", (err, rows) => {
        if (err) console.error("NAS error:", err);
        console.log("NAS Table:");
        console.table(rows);
        
        db.all("SELECT * FROM radcheck WHERE username='falisa'", (err, rows2) => {
            if (err) console.error("Radcheck error:", err);
            console.log("\nRadcheck Table for falisa:");
            console.table(rows2);
            
            db.all("SELECT * FROM radusergroup WHERE username='falisa'", (err, rows3) => {
                if (err) console.error("Radusergroup error:", err);
                console.log("\nRadusergroup Table for falisa:");
                console.table(rows3);
                
                db.close();
            });
        });
    });
});
