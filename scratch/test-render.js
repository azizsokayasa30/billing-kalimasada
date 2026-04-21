const fs = require('fs');
const ejs = require('ejs');
const path = require('path');
const billingManager = require('../config/billing');
const db = require('../config/billing').db;

async function test() {
    const month = 4; // Let's check April
    const year = 2026;
    const filters = { month, year };
    
    const customerStats = await billingManager.getCustomerStatsByMonth(month, year, filters);
    console.log("Stats from DB (April):", customerStats);

    const month3 = 3;
    const filters3 = { month: 3, year: 2026 };
    const stats3 = await billingManager.getCustomerStatsByMonth(month3, year, filters3);
    console.log("Stats from DB (March):", stats3);

    const template = fs.readFileSync(path.join(__dirname, '../views/admin/billing/customers.ejs'), 'utf8');
    
    // Test EJS output
    const html = ejs.render(template, {
        customerStats: stats3,
        // Provide mock locals to avoid reference errors
        title: 'B', customers: [], selectedMonth: 3, selectedYear: 2026, packages: [], odps: [], routers: [],
        collectors: [], uniqueAreas: [], areasForDropdown: [], routerFilter: null, authMode: 'local',
        radiusRouterId: null, pagination: { page: 1, totalPages: 1 }, filters: {}, settings: {}
    }, { filename: path.join(__dirname, '../views/admin/billing/customers.ejs') });

    const totalMatch = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/g);
    console.log("EJS Outputs (March):", totalMatch.slice(0, 6));
}

test().catch(console.error);
