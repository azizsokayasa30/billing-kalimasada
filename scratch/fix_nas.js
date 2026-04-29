const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/radius.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to radius.db');
});

// Update the nas table where nasname and shortname are swapped
// nasname should be the IP address (like %.%.%.%)
// shortname should be the friendly name
const query = `
    UPDATE nas 
    SET shortname = nasname, 
        nasname = (SELECT n2.shortname FROM nas n2 WHERE n2.id = nas.id) 
    WHERE nasname NOT LIKE '%.%.%.%'
`;

db.run(query, function(err) {
    if (err) {
        console.error('Error updating nas table:', err);
    } else {
        console.log(`Successfully updated ${this.changes} rows in nas table.`);
        console.log('nasname is now the IP address, and shortname is the friendly name.');
    }
    db.close();
});
