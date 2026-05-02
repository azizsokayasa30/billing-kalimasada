const fs = require('fs');
const FILE_PATH = 'routes/adminBilling.js';
let content = fs.readFileSync(FILE_PATH, 'utf8');

content = content.replace(
    'const customerStats = await billingManager.getCustomerStatsByMonth(month, year);',
    'const customerStats = await billingManager.getCustomerStatsByMonth(month, year, filters);'
);

fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log('Passed filters to stats calculation');
