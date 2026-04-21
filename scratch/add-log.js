const fs = require('fs');
const FILE_PATH = 'routes/adminBilling.js';
let content = fs.readFileSync(FILE_PATH, 'utf8');

content = content.replace(
    'const customerStats = await billingManager.getCustomerStatsByMonth(month, year, filters);',
    'const customerStats = await billingManager.getCustomerStatsByMonth(month, year, filters); console.log("== CUSTOMER STATS FOR", month, year, "==\\n", customerStats);'
);

fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log('Added console.log');
