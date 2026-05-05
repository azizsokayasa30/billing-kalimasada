const fs = require('fs');
const FILE_PATH = 'config/billing.js';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const regex = /async getCustomerStatsByMonth\(month, year\) \{([\s\S]*?)this\.db\.get\(sql, \[startDate, endDate, monthStr, yearStr, endDate, monthStr, yearStr, endDate\], \(err, row\) => \{/m;

const match = content.match(regex);
if (match) {
    const newFunc = `async getCustomerStatsByMonth(month, year, filters = {}) {
        return new Promise((resolve, reject) => {
            const startDate = \`\${year}-\${String(month).padStart(2, '0')}-01\`;
            const nextMonth = month == 12 ? 1 : parseInt(month) + 1;
            const nextYear = month == 12 ? parseInt(year) + 1 : year;
            const endDate = \`\${nextYear}-\${String(nextMonth).padStart(2, '0')}-01\`;

            const monthStr = String(month).padStart(2, '0');
            const yearStr = String(year);

            let filterJoins = '';
            let filterWhere = '';
            let filterParams = [];

            if (filters.search) {
                filterWhere += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.pppoe_username LIKE ?)';
                const searchTerm = \`%\${filters.search}%\`;
                filterParams.push(searchTerm, searchTerm, searchTerm);
            }
            if (filters.package_id) {
                filterWhere += ' AND c.package_id = ?';
                filterParams.push(filters.package_id);
            }
            if (filters.area) {
                filterWhere += ' AND c.area = ?';
                filterParams.push(filters.area);
            }
            if (filters.collector_id) {
                filterJoins += ' LEFT JOIN collector_assignments ca ON ca.customer_id = c.id';
                filterJoins += ' LEFT JOIN collector_areas cra ON (c.area IS NOT NULL AND c.area != \\"\\" AND c.area = cra.area)';
                filterWhere += ' AND (ca.collector_id = ? OR cra.collector_id = ?)';
                filterParams.push(filters.collector_id, filters.collector_id);
            }

            const sql = \`
                SELECT 
                    COUNT(DISTINCT c.id) as total,
                    SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END) as aktif,
                    SUM(CASE WHEN c.status = 'suspended' OR c.status = 'isolir' THEN 1 ELSE 0 END) as nonaktif,
                    SUM(CASE WHEN date(c.join_date) >= date(?) AND date(c.join_date) < date(?) THEN 1 ELSE 0 END) as baru,
                    (
                        SELECT COUNT(DISTINCT i.customer_id) 
                        FROM invoices i 
                        JOIN customers c_sub ON c_sub.id = i.customer_id
                        \${filterJoins.replace(/ ca/g, ' ca_sub').replace(/ cra/g, ' cra_sub').replace(/ c\\./g, ' c_sub.')}
                        WHERE strftime('%m', i.created_at) = ? AND strftime('%Y', i.created_at) = ? AND i.status = 'paid'
                        \${filterWhere.replace(/c\\./g, 'c_sub.')}
                    ) as lunas,
                    (
                        SELECT COUNT(DISTINCT c2.id) 
                        FROM customers c2 
                        \${filterJoins.replace(/ ca/g, ' ca2').replace(/ cra/g, ' cra2').replace(/ c\\./g, ' c2.')}
                        WHERE date(c2.join_date) < date(?)
                        AND NOT EXISTS (
                            SELECT 1 FROM invoices i 
                            WHERE i.customer_id = c2.id 
                            AND strftime('%m', i.created_at) = ? AND strftime('%Y', i.created_at) = ? AND i.status = 'paid'
                        )
                        \${filterWhere.replace(/c\\./g, 'c2.')}
                    ) as belum_lunas
                FROM customers c
                \${filterJoins}
                WHERE date(c.join_date) < date(?) \${filterWhere}
            \`;
            
            const params = [
                startDate, endDate,
                monthStr, yearStr, ...filterParams,
                endDate, monthStr, yearStr, ...filterParams,
                endDate, ...filterParams
            ];
            
            this.db.get(sql, params, (err, row) => {`;
            
    content = content.replace(regex, newFunc);
    fs.writeFileSync(FILE_PATH, content, 'utf8');
    console.log("Updated getCustomerStatsByMonth with filters");
} else {
    console.log("Regex logic failed to match in config.js");
}
