const fs = require('fs');

let content = fs.readFileSync('config/billing.js', 'utf8');

// 1. Add getCustomerStatsByMonth method
if (!content.includes('async getCustomerStatsByMonth')) {
    const statsMethod = `
    async getCustomerStatsByMonth(month, year) {
        return new Promise((resolve, reject) => {
            const startDate = \`\${year}-\${String(month).padStart(2, '0')}-01\`;
            const nextMonth = month == 12 ? 1 : parseInt(month) + 1;
            const nextYear = month == 12 ? parseInt(year) + 1 : year;
            const endDate = \`\${nextYear}-\${String(nextMonth).padStart(2, '0')}-01\`;

            const monthStr = String(month).padStart(2, '0');
            const yearStr = String(year);

            const sql = \`
                SELECT 
                    COUNT(DISTINCT c.id) as total,
                    SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END) as aktif,
                    SUM(CASE WHEN c.status = 'suspended' OR c.status = 'isolir' THEN 1 ELSE 0 END) as nonaktif,
                    SUM(CASE WHEN date(c.created_at) >= date(?) AND date(c.created_at) < date(?) THEN 1 ELSE 0 END) as baru,
                    (
                        SELECT COUNT(DISTINCT i.customer_id) 
                        FROM invoices i 
                        WHERE strftime('%m', i.created_at) = ? AND strftime('%Y', i.created_at) = ? AND i.status = 'paid'
                    ) as lunas,
                    (
                        SELECT COUNT(DISTINCT c2.id) 
                        FROM customers c2 
                        WHERE date(c2.created_at) < date(?)
                        AND NOT EXISTS (
                            SELECT 1 FROM invoices i 
                            WHERE i.customer_id = c2.id 
                            AND strftime('%m', i.created_at) = ? AND strftime('%Y', i.created_at) = ? AND i.status = 'paid'
                        )
                    ) as belum_lunas
                FROM customers c
                WHERE date(c.created_at) < date(?)
            \`;
            
            this.db.get(sql, [startDate, endDate, monthStr, yearStr, endDate, monthStr, yearStr, endDate], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        total: row ? row.total : 0,
                        aktif: row ? row.aktif : 0,
                        nonaktif: row ? row.nonaktif : 0,
                        lunas: row ? row.lunas : 0,
                        belum_lunas: row ? row.belum_lunas : 0,
                        baru: row ? row.baru : 0
                    });
                }
            });
        });
    }

    // OPTIMASI: Get customers dengan pagination untuk menghindari load semua data sekaligus
`;
    content = content.replace('// OPTIMASI: Get customers dengan pagination untuk menghindari load semua data sekaligus', statsMethod);
}

// 2. Modify getCustomersPaginated parameter logic
const oldFilterCode = `
            // Filter status pembayaran (Lunas/Belum Lunas)
            if (filters.payment_status === 'paid') {
                whereClause += \` AND NOT EXISTS (
                    SELECT 1 FROM invoices i 
                    WHERE i.customer_id = c.id 
                    AND i.status = 'unpaid'
                ) AND EXISTS (
                    SELECT 1 FROM invoices i 
                    WHERE i.customer_id = c.id 
                    AND i.status = 'paid'
                )\`;
            } else if (filters.payment_status === 'unpaid') {
                whereClause += \` AND (
                    EXISTS (
                        SELECT 1 FROM invoices i 
                        WHERE i.customer_id = c.id 
                        AND i.status = 'unpaid'
                    ) 
                    OR NOT EXISTS (
                        SELECT 1 FROM invoices i 
                        WHERE i.customer_id = c.id 
                        AND i.status = 'paid'
                    )
                )\`;
            }
`;

const newFilterCode = `
            if (filters.year && filters.month) {
                const year = filters.year;
                const month = String(filters.month).padStart(2, '0');
                const nextMonth = month === '12' ? '01' : String(parseInt(month) + 1).padStart(2, '0');
                const nextYear = month === '12' ? String(parseInt(year) + 1) : year;
                const startDate = \`\${year}-\${month}-01\`;
                const endDate = \`\${nextYear}-\${nextMonth}-01\`;

                whereClause += ' AND date(c.created_at) < date(?)';
                params.push(endDate);

                if (filters.customer_type === 'baru') {
                    whereClause += ' AND date(c.created_at) >= date(?)';
                    params.push(startDate);
                } else if (filters.customer_type === 'aktif') {
                    whereClause += " AND c.status = 'active'";
                } else if (filters.customer_type === 'nonaktif') {
                    whereClause += " AND (c.status = 'suspended' OR c.status = 'isolir')";
                }

                if (filters.payment_status === 'paid') {
                    whereClause += \` AND EXISTS (
                        SELECT 1 FROM invoices i 
                        WHERE i.customer_id = c.id 
                        AND strftime('%m', i.created_at) = ? AND strftime('%Y', i.created_at) = ? AND i.status = 'paid'
                    )\`;
                    params.push(month, String(year));
                } else if (filters.payment_status === 'unpaid') {
                    whereClause += \` AND NOT EXISTS (
                        SELECT 1 FROM invoices i 
                        WHERE i.customer_id = c.id 
                        AND strftime('%m', i.created_at) = ? AND strftime('%Y', i.created_at) = ? AND i.status = 'paid'
                    )\`;
                    params.push(month, String(year));
                }
            } else {
                if (filters.customer_type === 'aktif') {
                    whereClause += " AND c.status = 'active'";
                } else if (filters.customer_type === 'nonaktif') {
                    whereClause += " AND (c.status = 'suspended' OR c.status = 'isolir')";
                }
                
                // Filter status pembayaran (Lunas/Belum Lunas) Default
                if (filters.payment_status === 'paid') {
                    whereClause += \` AND NOT EXISTS (
                        SELECT 1 FROM invoices i 
                        WHERE i.customer_id = c.id 
                        AND i.status = 'unpaid'
                    ) AND EXISTS (
                        SELECT 1 FROM invoices i 
                        WHERE i.customer_id = c.id 
                        AND i.status = 'paid'
                    )\`;
                } else if (filters.payment_status === 'unpaid') {
                    whereClause += \` AND (
                        EXISTS (
                            SELECT 1 FROM invoices i 
                            WHERE i.customer_id = c.id 
                            AND i.status = 'unpaid'
                        ) 
                        OR NOT EXISTS (
                            SELECT 1 FROM invoices i 
                            WHERE i.customer_id = c.id 
                            AND i.status = 'paid'
                        )
                    )\`;
                }
            }
`;
if (content.includes(oldFilterCode)) {
    content = content.replace(oldFilterCode, newFilterCode);
} else {
    console.log("Could not find oldFilterCode block");
}

// 3. Dynamic payment_status calculation during select
const oldCaseStmt = `                       CASE 
                           WHEN EXISTS (
                               SELECT 1 FROM invoices i 
                               WHERE i.customer_id = c.id 
                               AND i.status = 'unpaid' 
                               AND i.due_date < date('now')
                           ) THEN 'overdue'
                           WHEN EXISTS (
                               SELECT 1 FROM invoices i 
                               WHERE i.customer_id = c.id 
                               AND i.status = 'unpaid'
                           ) THEN 'unpaid'
                           WHEN EXISTS (
                               SELECT 1 FROM invoices i 
                               WHERE i.customer_id = c.id 
                               AND i.status = 'paid'
                           ) THEN 'paid'
                           ELSE 'no_invoice'
                       END as payment_status`;

const dynamicCaseStmt = `\${filters.year && filters.month ? \`
                       CASE 
                           WHEN EXISTS (
                               SELECT 1 FROM invoices i 
                               WHERE i.customer_id = c.id 
                               AND strftime('%m', i.created_at) = '\${String(filters.month).padStart(2, '0')}' 
                               AND strftime('%Y', i.created_at) = '\${String(filters.year)}' 
                               AND i.status = 'paid'
                           ) THEN 'paid'
                           ELSE 'unpaid'
                       END as payment_status\` : \`
                       CASE 
                           WHEN EXISTS (
                               SELECT 1 FROM invoices i 
                               WHERE i.customer_id = c.id 
                               AND i.status = 'unpaid' 
                               AND i.due_date < date('now')
                           ) THEN 'overdue'
                           WHEN EXISTS (
                               SELECT 1 FROM invoices i 
                               WHERE i.customer_id = c.id 
                               AND i.status = 'unpaid'
                           ) THEN 'unpaid'
                           WHEN EXISTS (
                               SELECT 1 FROM invoices i 
                               WHERE i.customer_id = c.id 
                               AND i.status = 'paid'
                           ) THEN 'paid'
                           ELSE 'no_invoice'
                       END as payment_status\`}`;

if (content.includes(oldCaseStmt)) {
    content = content.replace(oldCaseStmt, dynamicCaseStmt);
} else {
    console.log("Could not find oldCaseStmt");
}

fs.writeFileSync('config/billing.js', content, 'utf8');
console.log("Replaced successfully.");
