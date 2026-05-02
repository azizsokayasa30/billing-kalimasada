const fs = require('fs');

const FILE_PATH = 'config/billing.js';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// Replace c.created_at with c.join_date everywhere inside getCustomerStatsByMonth and getCustomersPaginated parameter logic
content = content.replace(/c\.created_at/g, 'c.join_date');

fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log('Replaced c.created_at with c.join_date');
