const fs = require('fs');
let content = fs.readFileSync('routes/adminBilling.js', 'utf8');

// 1. Capture month and year early in router.get('/customers'...)
const oldQueryExtract = `        const search = req.query.search ? String(req.query.search).trim() : '';
        const statusFilter = req.query.status ? String(req.query.status).trim() : '';
        
        const routerFilter = req.query.router ? parseInt(req.query.router) : null;
        
        const filters = {};
        if (routerFilter) filters.router_id = routerFilter;
        if (search) filters.search = search;
        if (statusFilter) filters.status = statusFilter;
        
        // Add new filters
        if (req.query.package_id) filters.package_id = req.query.package_id;
        if (req.query.area) filters.area = req.query.area;
        if (req.query.collector_id) filters.collector_id = req.query.collector_id;
        if (req.query.payment_status) filters.payment_status = req.query.payment_status;`;

const newQueryExtract = `        const search = req.query.search ? String(req.query.search).trim() : '';
        const statusFilter = req.query.status ? String(req.query.status).trim() : '';
        
        const routerFilter = req.query.router ? parseInt(req.query.router) : null;
        
        const filters = {};
        if (routerFilter) filters.router_id = routerFilter;
        if (search) filters.search = search;
        if (statusFilter) filters.status = statusFilter;
        
        // Month and Year defaults to current if not provided
        const now = new Date();
        const month = req.query.month ? parseInt(req.query.month) : (now.getMonth() + 1);
        const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();
        filters.month = month;
        filters.year = year;
        
        // Add new filters
        if (req.query.package_id) filters.package_id = req.query.package_id;
        if (req.query.area) filters.area = req.query.area;
        if (req.query.collector_id) filters.collector_id = req.query.collector_id;
        if (req.query.payment_status) filters.payment_status = req.query.payment_status;
        if (req.query.customer_type) filters.customer_type = req.query.customer_type;`;

if (content.includes(oldQueryExtract)) {
    content = content.replace(oldQueryExtract, newQueryExtract);
}

// 2. Fetch customerStats
const oldCustomersRender = `        res.render('admin/billing/customers', {
            title: 'Kelola Pelanggan',
            customers,
            packages,`;

const newCustomersRender = `        
        const customerStats = await billingManager.getCustomerStatsByMonth(month, year);
        
        res.render('admin/billing/customers', {
            title: 'Kelola Pelanggan',
            customers,
            customerStats,
            selectedMonth: month,
            selectedYear: year,
            packages,`;

if (content.includes(oldCustomersRender)) {
    content = content.replace(oldCustomersRender, newCustomersRender);
}

fs.writeFileSync('routes/adminBilling.js', content, 'utf8');
console.log('Modified adminBilling.js');
