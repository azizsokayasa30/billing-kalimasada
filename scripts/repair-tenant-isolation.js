#!/usr/bin/env node
'use strict';

/**
 * Backfill tenant_id untuk data lama (default 1) ke tenant yang benar.
 *
 * Usage:
 *   node scripts/repair-tenant-isolation.js --dry-run
 *   node scripts/repair-tenant-isolation.js --tenant=6 --table=employees
 *   node scripts/repair-tenant-isolation.js --tenant=6 --table=employees --ids=3,4
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '../data/billing.db');

const SCOPED_TABLES = [
    'employees', 'employee_attendance', 'employee_leave_requests', 'employee_payroll',
    'attendance_branches', 'attendance_settings', 'attendance_shifts',
    'technicians', 'collectors', 'areas', 'packages', 'customers',
];

function parseArgs() {
    const args = process.argv.slice(2);
    const out = { dryRun: false, tenant: null, table: null, ids: null };
    for (const arg of args) {
        if (arg === '--dry-run') out.dryRun = true;
        else if (arg.startsWith('--tenant=')) out.tenant = parseInt(arg.split('=')[1], 10);
        else if (arg.startsWith('--table=')) out.table = arg.split('=')[1];
        else if (arg.startsWith('--ids=')) out.ids = arg.split('=')[1].split(',').map((v) => parseInt(v, 10)).filter(Boolean);
    }
    return out;
}

function openDb() {
    return new sqlite3.Database(DB_PATH);
}

function dbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });
}

function dbRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
}

async function tableHasColumn(db, table, column) {
    const cols = await dbAll(db, `PRAGMA table_info(${table})`);
    return cols.some((c) => c.name === column);
}

async function audit(db) {
    console.log('\n=== Audit tenant_id (orphan = tenant_id IS NULL OR tenant_id = 1) ===\n');
    for (const table of SCOPED_TABLES) {
        const exists = await dbAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
        if (!exists.length) continue;
        if (!(await tableHasColumn(db, table, 'tenant_id'))) {
            console.log(`[SKIP] ${table} — kolom tenant_id belum ada (jalankan app restart untuk migrasi)`);
            continue;
        }
        const rows = await dbAll(
            db,
            `SELECT tenant_id, COUNT(*) as c FROM ${table} GROUP BY tenant_id ORDER BY tenant_id`
        );
        const orphan = await dbAll(
            db,
            `SELECT COUNT(*) as c FROM ${table} WHERE tenant_id IS NULL OR tenant_id = 1`
        );
        console.log(`${table}:`, rows.map((r) => `#${r.tenant_id}=${r.c}`).join(', ') || '(empty)',
            `| orphan/default: ${orphan[0]?.c || 0}`);
    }
    console.log('');
}

async function assign(db, { tenant, table, ids, dryRun }) {
    if (!tenant || !table) {
        console.error('Butuh --tenant=N dan --table=nama_tabel');
        process.exit(1);
    }
    if (!(await tableHasColumn(db, table, 'tenant_id'))) {
        console.error(`Tabel ${table} belum punya tenant_id`);
        process.exit(1);
    }
    let sql = `UPDATE ${table} SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id = 1`;
    const params = [tenant];
    if (ids && ids.length) {
        sql += ` AND id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
    }
    if (dryRun) {
        const preview = await dbAll(db, sql.replace(/^UPDATE/, 'SELECT id, tenant_id FROM').replace(/SET tenant_id = \? WHERE/, 'WHERE'), params);
        console.log(`[dry-run] Would update ${preview.length} rows in ${table} → tenant ${tenant}:`, preview);
        return;
    }
    const result = await dbRun(db, sql, params);
    console.log(`Updated ${result.changes} row(s) in ${table} → tenant ${tenant}`);
}

async function main() {
    const opts = parseArgs();
    const db = openDb();
    try {
        await audit(db);
        if (opts.tenant && opts.table) {
            await assign(db, opts);
        } else if (!opts.dryRun) {
            console.log('Hanya audit. Untuk assign: node scripts/repair-tenant-isolation.js --tenant=6 --table=employees --ids=3,4');
        }
    } finally {
        db.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
