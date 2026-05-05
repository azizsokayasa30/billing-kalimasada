const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const template = fs.readFileSync(path.join(__dirname, '../views/admin/billing/customers.ejs'), 'utf8');

const customerStats = { total: 5, aktif: 4, nonaktif: 1, lunas: 0, belum_lunas: 5, baru: 5 };
const html = ejs.render(template, {
    title: 'Test',
    customers: [1,2,3,4,5],
    customerStats: customerStats,
    selectedMonth: 4,
    selectedYear: 2026,
    packages: [],
    odps: [],
    routers: [],
    collectors: [],
    uniqueAreas: [],
    areasForDropdown: [],
    routerFilter: null,
    authMode: 'local',
    radiusRouterId: null,
    pagination: { page: 1, totalPages: 1 },
    filters: {}
}, { filename: path.join(__dirname, '../views/admin/billing/customers.ejs') });

const totalMatch = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/g);
console.log(totalMatch.slice(0, 7));
