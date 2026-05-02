const fs = require('fs');

const FILE_PATH = 'views/admin/billing/customers.ejs';
let content = fs.readFileSync(FILE_PATH, 'utf8');

content = content.replace(
    /onchange="document\.getElementById\(\\'timeFilterForm\\'\)\.submit\(\)"/g,
    'onchange="this.form.submit()"'
);

fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log('Fixed onchange syntax to use this.form.submit()');
