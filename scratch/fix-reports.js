const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'views', 'admin', 'billing', 'reports.ejs');
let content = fs.readFileSync(target, 'utf8');

// Replace the nested container-fluid
content = content.replace(/<div class="container-fluid">\s*<div class="row">\s*<div class="col-12">/, '<div><div><div>');

fs.writeFileSync(target, content, 'utf8');
console.log('Fixed reports.ejs nested container-fluid.');
