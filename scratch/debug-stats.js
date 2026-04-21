const billingManager = require('../config/billing');

billingManager.getCustomerStatsByMonth(3, 2026).then(res => console.log('March 2026:', res)).catch(console.error);
