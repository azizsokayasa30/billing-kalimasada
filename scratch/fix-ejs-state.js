const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'views/admin/billing/expenses.ejs',
    'views/admin/billing/financial-report.ejs',
    'views/admin/billing/monthly-summary.ejs',
    'views/admin/billing/invoices.ejs'
];

for (const relPath of filesToUpdate) {
    const fullPath = path.join(__dirname, '..', relPath);
    if (!fs.existsSync(fullPath)) continue;

    let content = fs.readFileSync(fullPath, 'utf8');

    // 1. Change container-fluid to container at the outermost level
    // Some files might have multiple container-fluids, we want the body direct child usually,
    // or we can just replace all <div class="container-fluid"> with <div class="container">
    if (relPath !== 'views/admin/billing/invoice-print.ejs') {
        content = content.replace(/<div class="container-fluid( px-3)?">/g, '<div class="container">');
    }

    // 2. Move Refresh & Export buttons to top right
    if (relPath === 'views/admin/billing/expenses.ejs') {
        const topHtml = `<div>
                        <a href="/admin/billing/expenses" class="btn btn-outline-secondary me-2">
                            <i class="bi bi-arrow-clockwise"></i> Refresh
                        </a>
                        <button type="button" class="btn btn-outline-success me-2" onclick="exportToCSV()">
                            <i class="bi bi-download"></i> Export CSV
                        </button>
                        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addExpenseModal">
                            <i class="bi bi-plus-lg"></i> Tambah Pengeluaran
                        </button>
                    </div>`;
        content = content.replace(/<div>\s*<button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addExpenseModal">[\s\S]*?<\/div>/, topHtml);
        
        // Remove from form
        const filterHtml = `<div class="col-md-3">
                                <button type="submit" class="btn btn-primary">
                                    <i class="bi bi-search"></i> Filter
                                </button>
                            </div>
                        </form>`;
        content = content.replace(/<div class="col-md-3">\s*<button type="submit" class="btn btn-primary">[\s\S]*?<\/form>/, filterHtml);
    }
    
    if (relPath === 'views/admin/billing/financial-report.ejs') {
        // financial-report.ejs buttons might be different
        // They typically have Export/Print. Let's see if there are buttons to move.
        // Actually financial report ONLY has form filters. We can move them if they exist.
    }
    
    if (relPath === 'views/admin/billing/monthly-summary.ejs') {
        // Already top right, but maybe a container change is enough
    }

    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated ${relPath}`);
}
