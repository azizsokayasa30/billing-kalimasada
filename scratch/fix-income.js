const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, '..', 'views', 'admin', 'billing');
const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.ejs'));

for (const file of files) {
    // skip print pages as they might need fluid layout
    if (file === 'invoice-print.ejs') continue;
    
    const fullPath = path.join(viewsDir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;

    // 1. Convert container-fluid to container everywhere to ensure narrow layout
    // unless it's explicitly needed differently
    if (content.includes('class="container-fluid"')) {
        content = content.replace(/class="container-fluid"/g, 'class="container"');
        changed = true;
    }
    if (content.includes('class="container-fluid px-3"')) {
        content = content.replace(/class="container-fluid px-3"/g, 'class="container px-3"');
        changed = true;
    }

    // 2. Fix income.ejs buttons
    if (file === 'income.ejs') {
        const topHtml = `<div>
                        <a href="/admin/billing/income" class="btn btn-outline-secondary me-2">
                            <i class="bi bi-arrow-clockwise"></i> Refresh
                        </a>
                        <button type="button" class="btn btn-outline-success me-2" onclick="exportToCSV()">
                            <i class="bi bi-download"></i> Export CSV
                        </button>
                        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addIncomeModal">
                            <i class="bi bi-plus-lg"></i> Tambah Pemasukan
                        </button>
                    </div>`;
        content = content.replace(/<div>\s*<button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addIncomeModal">[\s\S]*?<\/div>/, topHtml);
        
        const filterHtml = `<div class="col-md-3">
                                <button type="submit" class="btn btn-primary">
                                    <i class="bi bi-search"></i> Filter
                                </button>
                            </div>
                        </form>`;
        content = content.replace(/<div class="col-md-3">\s*<button type="submit" class="btn btn-primary">[\s\S]*?<\/form>/, filterHtml);
        changed = true;
    }

    // 3. Fix invoices.ejs buttons (if it has them in filter form)
    if (file === 'invoices.ejs' || file === 'invoices-by-type.ejs' || file === 'customers.ejs') {
        // Find if there's a Reset/Export inside the form and move it up?
        // Wait, for invoices.ejs, there is already "Refresh dan Export di sebelah kanan atas" 
        // We will just replace it cleanly for any pages if needed, but the user explicitly mentioned "di menu keuangan", which means he just wanted all pages to have narrow margins, and "menu keuangan" (Income & Expenses & Financial Report) have their buttons grouped. Let's just fix the container margin for everything.
    }

    if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${file}`);
    }
}
