const fs = require('fs');
const FILE_PATH = 'config/billing.js';
let content = fs.readFileSync(FILE_PATH, 'utf8');

content = content.replace(/c2\.created_at/g, 'c2.join_date');

fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log('Replaced c2.created_at with c2.join_date');
