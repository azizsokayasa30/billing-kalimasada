const db = require('../config/billing').db; 
const s = "SELECT id, name, join_date FROM customers WHERE date(join_date) < date('2026-04-01')"; 
db.all(s, (err, rows) => { 
    console.log('March customers:', rows); 
});
