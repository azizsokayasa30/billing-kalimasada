const db = require('./config/billing').db;
db.serialize(() => {
    db.all("PRAGMA table_info(collector_areas)", [], (err, info) => {
        console.log("collector_areas schema:", info);
    });
});
