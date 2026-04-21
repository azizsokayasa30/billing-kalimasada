const db = require('../config/billing').db; 
db.get("SELECT sum(case when date(join_date) >= date('2026-04-01') and date(join_date) < date('2026-05-01') then 1 else 0 end) as baru_april, sum(case when date(join_date) >= date('2026-05-01') and date(join_date) < date('2026-06-01') then 1 else 0 end) as baru_mei FROM customers", (err, row) => console.log(row));
