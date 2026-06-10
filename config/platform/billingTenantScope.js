'use strict';

/**
 * AUTO TENANT ISOLATION untuk database billing (SQLite).
 *
 * Modul ini mem-patch sqlite3.Database.prototype (all/get/run/each/map/prepare)
 * sehingga SEMUA query yang menyentuh tabel bisnis tenant otomatis disuntik
 * filter `tenant_id` sesuai konteks tenant aktif (AsyncLocalStorage):
 *
 *   - SELECT  : `FROM customers c`  →  `FROM (SELECT * FROM customers WHERE tenant_id = N) c`
 *   - UPDATE  : WHERE level-atas dibungkus  →  `WHERE (...) AND tenant_id = N`
 *   - DELETE  : sama seperti UPDATE
 *   - INSERT  : kolom `tenant_id` + nilai N ditambahkan jika belum ada
 *
 * Tanpa konteks tenant (background job, script CLI, portal management/central)
 * query TIDAK diubah. Hanya berlaku untuk file database `billing.db`.
 */

const path = require('path');

// Seluruh tabel bisnis per-tenant di data/billing.db.
// Tabel platform/global TIDAK boleh masuk daftar ini:
// tenants, subscription_plans, super_admins, tenant_provisioning_logs,
// platform_audit_logs, license, sqlite_master, dst.
const BILLING_TENANT_SCOPED_TABLES = [
    // inti billing
    'customers', 'packages', 'invoices', 'payments', 'routers',
    'technicians', 'collectors', 'areas', 'app_settings', 'agents',
    'members', 'member_packages', 'expenses', 'income', 'odps',
    // kepegawaian & absensi
    'employees', 'employee_attendance', 'employee_leave_requests', 'employee_payroll',
    'attendance_branches', 'attendance_settings', 'attendance_shifts',
    // operasional lapangan
    'installation_jobs', 'installation_job_status_history',
    'trouble_reports', 'collector_areas', 'collector_assignments',
    'collector_payments', 'collector_transactions', 'collector_field_notifications',
    'technician_field_notifications',
    // agen
    'agent_balances', 'agent_balance_requests', 'agent_transactions',
    'agent_voucher_sales', 'agent_monthly_payments', 'agent_notifications',
    // jaringan & infrastruktur
    'customer_router_map', 'odp_connections', 'cable_routes',
    'cable_maintenance_logs', 'network_segments', 'genieacs_servers',
    'hotspot_servers',
    // keuangan & lainnya
    'finance_categories', 'voucher_revenue', 'payment_gateway_transactions',
    'goods_invoices', 'goods_invoice_items',
    'warehouse_items', 'warehouse_units', 'warehouse_inbound_batches',
    'activity_logs', 'admin_notifications',
    'customer_portal_broadcasts', 'customer_portal_package_requests',
];

const TABLE_ALTERNATION = BILLING_TENANT_SCOPED_TABLES.join('|');
const TOUCHES_SCOPED_TABLE_RE = new RegExp(`\\b(?:${TABLE_ALTERNATION})\\b`, 'i');

// Kata kunci yang TIDAK boleh dianggap alias tabel setelah `FROM <table>`.
const NON_ALIAS_KEYWORDS = new Set([
    'WHERE', 'ON', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'FULL',
    'NATURAL', 'USING', 'GROUP', 'ORDER', 'LIMIT', 'OFFSET', 'HAVING', 'UNION',
    'INTERSECT', 'EXCEPT', 'SET', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN',
    'LIKE', 'IS', 'NULL', 'ASC', 'DESC', 'COLLATE', 'INDEXED', 'WHEN', 'THEN',
    'ELSE', 'END', 'CASE', 'AS', 'VALUES', 'RETURNING',
]);

function getActiveTenantId() {
    try {
        const { hasTenantContext, isCentralHost, getTenantId } = require('./tenantContext');
        if (!hasTenantContext() || isCentralHost()) return null;
        const id = Number(getTenantId());
        return Number.isInteger(id) && id > 0 ? id : null;
    } catch (_) {
        return null;
    }
}

/** Ganti string literal '...' dengan sentinel agar regex tidak menyentuh isi string. */
function maskStrings(sql) {
    const literals = [];
    const masked = String(sql).replace(/'(?:[^']|'')*'/g, (m) => {
        literals.push(m);
        return `\u0001${literals.length - 1}\u0001`;
    });
    return { masked, literals };
}

function unmaskStrings(sql, literals) {
    return sql.replace(/\u0001(\d+)\u0001/g, (_, i) => literals[Number(i)]);
}

/** Cari index kata kunci (regex) pertama pada kedalaman kurung 0, mulai dari `start`. */
function findTopLevelKeyword(sql, regex, start = 0) {
    let depth = 0;
    for (let i = start; i < sql.length; i++) {
        const ch = sql[i];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (depth === 0) {
            regex.lastIndex = i;
            const m = regex.exec(sql);
            if (m && m.index === i) return { index: i, length: m[0].length };
        }
    }
    return null;
}

/** Cari index `)` penutup yang berpasangan dengan `(` pada posisi openIdx. */
function findMatchingParen(sql, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < sql.length; i++) {
        if (sql[i] === '(') depth++;
        else if (sql[i] === ')') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/**
 * Substitusi `FROM/JOIN <scoped_table> [alias]` menjadi subquery ber-filter tenant.
 * Aman untuk JOIN bertingkat, subquery, dan agregasi karena alias dipertahankan.
 */
function scopeSelectSources(sql, tenantId) {
    const re = new RegExp(
        `\\b(FROM|JOIN)\\s+(${TABLE_ALTERNATION})\\b(\\s+AS\\s+(\\w+)|\\s+(\\w+))?`,
        'gi'
    );
    return sql.replace(re, (match, kw, table, _aliasPart, asAlias, bareAlias) => {
        const scoped = `(SELECT * FROM ${table} WHERE tenant_id = ${tenantId})`;
        if (asAlias) {
            return `${kw} ${scoped} ${asAlias}`;
        }
        if (bareAlias) {
            if (NON_ALIAS_KEYWORDS.has(bareAlias.toUpperCase())) {
                // Kata setelah nama tabel adalah keyword, bukan alias → kembalikan keyword-nya.
                return `${kw} ${scoped} ${table} ${bareAlias}`;
            }
            return `${kw} ${scoped} ${bareAlias}`;
        }
        return `${kw} ${scoped} ${table}`;
    });
}

/**
 * UPDATE/DELETE: bungkus WHERE level-atas → `WHERE (...) AND tenant_id = N`,
 * atau tambahkan `WHERE tenant_id = N` jika tidak ada WHERE.
 */
function scopeWriteStatement(sql, tenantId) {
    const whereHit = findTopLevelKeyword(sql, /\bWHERE\b/giy);
    const tailRe = /\b(ORDER\s+BY|LIMIT|RETURNING)\b/giy;

    if (whereHit) {
        const clauseStart = whereHit.index + whereHit.length;
        const tailHit = findTopLevelKeyword(sql, tailRe, clauseStart);
        const clauseEnd = tailHit ? tailHit.index : sql.length;
        const clause = sql.slice(clauseStart, clauseEnd).trim().replace(/;\s*$/, '');
        const suffix = tailHit ? ` ${sql.slice(clauseEnd)}` : '';
        return `${sql.slice(0, whereHit.index)}WHERE (${clause}) AND tenant_id = ${tenantId}${suffix}`;
    }

    const tailHit = findTopLevelKeyword(sql, tailRe, 0);
    if (tailHit) {
        return `${sql.slice(0, tailHit.index)} WHERE tenant_id = ${tenantId} ${sql.slice(tailHit.index)}`;
    }
    return `${sql.replace(/;\s*$/, '').trimEnd()} WHERE tenant_id = ${tenantId}`;
}

/**
 * INSERT: tambahkan kolom tenant_id + nilai ke setiap tuple VALUES.
 * Dilewati jika kolom tenant_id sudah ada, atau bentuknya INSERT ... SELECT /
 * DEFAULT VALUES / tanpa daftar kolom (di-log sebagai peringatan).
 */
function scopeInsertStatement(sql, tenantId, table) {
    const intoRe = new RegExp(
        `^(\\s*(?:INSERT(?:\\s+OR\\s+\\w+)?|REPLACE)\\s+INTO\\s+${table}\\b\\s*)`,
        'i'
    );
    const intoMatch = intoRe.exec(sql);
    if (!intoMatch) return sql;

    const afterInto = intoMatch[0].length;
    const colOpen = sql.indexOf('(', afterInto);
    if (colOpen === -1 || sql.slice(afterInto, colOpen).trim() !== '') {
        console.warn(`[tenantScope] INSERT tanpa daftar kolom dilewati: ${sql.slice(0, 120)}`);
        return sql;
    }
    const colClose = findMatchingParen(sql, colOpen);
    if (colClose === -1) return sql;

    const columns = sql.slice(colOpen + 1, colClose);
    if (/\btenant_id\b/i.test(columns)) return sql; // sudah eksplisit, jangan ganggu

    const valuesRe = /\bVALUES\b/giy;
    const valuesHit = findTopLevelKeyword(sql, valuesRe, colClose + 1);
    if (!valuesHit) {
        // INSERT ... SELECT: sumber SELECT sudah di-scope terpisah; kolom tujuan
        // akan memakai DEFAULT — beri peringatan supaya terdeteksi saat dev.
        console.warn(`[tenantScope] INSERT...SELECT tanpa tenant_id: ${sql.slice(0, 120)}`);
        return sql;
    }

    // Sisipkan nilai tenant ke SETIAP tuple VALUES (...), (...)
    let out = '';
    let cursor = valuesHit.index + valuesHit.length;
    out += sql.slice(0, colClose) + ', tenant_id' + sql.slice(colClose, cursor);

    let rest = sql.slice(cursor);
    for (;;) {
        const ws = rest.match(/^\s*/)[0];
        out += ws;
        rest = rest.slice(ws.length);
        if (rest[0] !== '(') break;
        const close = findMatchingParen(rest, 0);
        if (close === -1) break;
        out += rest.slice(0, close) + `, ${tenantId})`;
        rest = rest.slice(close + 1);
        const sep = rest.match(/^\s*,/);
        if (!sep) break;
        out += sep[0];
        rest = rest.slice(sep[0].length);
    }
    out += rest;
    return out;
}

/**
 * Rewrite SQL agar terisolasi per-tenant. Mengembalikan SQL apa adanya bila
 * tidak ada konteks tenant atau statement tidak menyentuh tabel ber-scope.
 */
function applyBillingTenantScope(sql) {
    if (typeof sql !== 'string') return sql;
    const tenantId = getActiveTenantId();
    if (tenantId === null) return sql;
    if (!TOUCHES_SCOPED_TABLE_RE.test(sql)) return sql;

    try {
        const { masked, literals } = maskStrings(sql);
        const verbMatch = masked.match(/^\s*(SELECT|WITH|INSERT|REPLACE|UPDATE|DELETE)\b/i);
        if (!verbMatch) return sql; // CREATE/ALTER/PRAGMA/BEGIN/dll → biarkan

        const verb = verbMatch[1].toUpperCase();
        let rewritten = masked;

        if (verb === 'SELECT' || verb === 'WITH') {
            rewritten = scopeSelectSources(masked, tenantId);
        } else if (verb === 'UPDATE' || verb === 'DELETE') {
            const targetRe = new RegExp(
                `^\\s*(?:UPDATE(?:\\s+OR\\s+\\w+)?\\s+|DELETE\\s+FROM\\s+)(${TABLE_ALTERNATION})\\b`,
                'i'
            );
            const target = targetRe.exec(masked);
            if (target) {
                rewritten = scopeWriteStatement(masked, tenantId);
            }
            if (verb === 'UPDATE') {
                // Subquery SELECT di dalam UPDATE tetap di-scope.
                rewritten = scopeSelectSources(rewritten, tenantId);
            }
        } else { // INSERT / REPLACE
            const tableMatch = masked.match(
                new RegExp(`^\\s*(?:INSERT(?:\\s+OR\\s+\\w+)?|REPLACE)\\s+INTO\\s+(${TABLE_ALTERNATION})\\b`, 'i')
            );
            if (tableMatch) {
                rewritten = scopeInsertStatement(masked, tenantId, tableMatch[1]);
            }
            // SELECT sebagai sumber INSERT atau subquery di VALUES tetap di-scope.
            rewritten = scopeSelectSources(rewritten, tenantId);
        }

        return unmaskStrings(rewritten, literals);
    } catch (err) {
        console.error('[tenantScope] gagal rewrite SQL, query asli dipakai:', err.message, '\nSQL:', String(sql).slice(0, 200));
        return sql;
    }
}

function isBillingDb(db) {
    try {
        return path.basename(String(db.filename || '')) === 'billing.db';
    } catch (_) {
        return false;
    }
}

let installed = false;

/**
 * Pasang interceptor pada sqlite3.Database.prototype. Panggil SEKALI di awal
 * bootstrap aplikasi, sebelum query pertama dijalankan.
 */
function installBillingTenantScope() {
    if (installed) return;
    installed = true;

    const sqlite3 = require('sqlite3');
    const Database = sqlite3.Database;
    const methods = ['all', 'get', 'run', 'each', 'map', 'prepare'];

    for (const method of methods) {
        const original = Database.prototype[method];
        if (typeof original !== 'function') continue;
        Database.prototype[method] = function tenantScoped(sql, ...rest) {
            if (typeof sql === 'string' && isBillingDb(this)) {
                sql = applyBillingTenantScope(sql);
            }
            return original.call(this, sql, ...rest);
        };
    }

    console.log('[tenantScope] Auto tenant isolation aktif untuk billing.db');
}

module.exports = {
    BILLING_TENANT_SCOPED_TABLES,
    applyBillingTenantScope,
    installBillingTenantScope,
};
