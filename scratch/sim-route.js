const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../data/billing.db');
const db = new sqlite3.Database(dbPath);

const month = 3;
const year = 2026;
const filters = { month: 3, year: 2026 };

const BillingManager = require('../config/billing').constructor;
const billingManager = require('../config/billing');

billingManager.getCustomerStatsByMonth(month, year, filters).then(stats => {
    console.log("March Stats from App:", stats);
}).catch(console.error);

billingManager.getCustomersPaginated(10, 0, filters).then(res => {
    console.log("March Customers length:", res.customers.length);
}).catch(console.error);
