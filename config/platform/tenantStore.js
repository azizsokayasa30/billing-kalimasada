'use strict';

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const bcrypt = require('bcrypt');

function newUuid() {
    return crypto.randomUUID();
}

const DB_PATH = path.join(__dirname, '../../data/billing.db');

let db = null;

function getDb() {
    if (db) return db;
    db = new sqlite3.Database(DB_PATH);
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA busy_timeout = 5000');
    db.run('PRAGMA synchronous = NORMAL');
    return db;
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().run(sql, params, function onRun(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });
}

function parseTenant(row) {
    if (!row) return null;
    let settings = {};
    try {
        settings = row.settings ? JSON.parse(row.settings) : {};
    } catch (_) {
        settings = {};
    }
    return { ...row, settings };
}

const RESERVED_SUBDOMAINS = new Set([
    'manage', 'management', 'api', 'www', 'admin', 'mail', 'ftp', 'cdn', 'static', 'app', 'billing',
]);

function isReservedSubdomain(subdomain) {
    return RESERVED_SUBDOMAINS.has(String(subdomain || '').toLowerCase());
}

function resolveAdminCredentials(data, existing = null) {
    const username = String(data.admin_username ?? existing?.admin_username ?? 'admin').trim();
    if (!username) {
        throw new Error('Username admin tenant wajib diisi.');
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
        throw new Error('Username admin hanya boleh huruf, angka, titik, strip, dan underscore.');
    }

    const rawPassword = data.admin_password !== undefined ? String(data.admin_password).trim() : '';
    let password;
    if (rawPassword) {
        password = rawPassword;
    } else if (existing?.admin_password) {
        password = existing.admin_password;
    } else {
        password = generatePassword(12);
    }
    if (password.length < 4) {
        throw new Error('Password admin minimal 4 karakter.');
    }

    return { admin_username: username, admin_password: password };
}

function defaultTenantSettings(tenant) {
    const creds = resolveAdminCredentials(
        {
            admin_username: tenant.admin_username ?? tenant.settings?.admin_username,
            admin_password: tenant.admin_password ?? tenant.settings?.admin_password,
        },
        null
    );
    try {
        const { seedSettingsForNewTenant } = require('./tenantSettingsManager');
        const full = seedSettingsForNewTenant({
            ...tenant,
            settings: creds,
        });
        return full;
    } catch (_) {
        return {
            ...creds,
            company_header: tenant.name,
            company_name: tenant.name,
            footer_info: `© ${new Date().getFullYear()} ${tenant.name}`,
            contact_phone: tenant.owner_phone,
            server_port: process.env.PORT || '4555',
            timezone: 'Asia/Jakarta',
        };
    }
}

async function updateTenantSettings(tenantId, settingsObj) {
    await dbRun(
        `UPDATE tenants SET settings = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
        [JSON.stringify(settingsObj), tenantId]
    );
}

async function syncTenantContactEmailsFromOwner() {
    const { resolveTenantContactEmail } = require('./saasTenantSettings');
    const rows = await dbAll('SELECT id, owner_email, settings FROM tenants WHERE deleted_at IS NULL');
    for (const row of rows) {
        let settings = {};
        try {
            settings = row.settings ? JSON.parse(row.settings) : {};
        } catch (_) {
            settings = {};
        }
        const tenant = { owner_email: row.owner_email, settings };
        const resolved = resolveTenantContactEmail(tenant, settings);
        if (resolved && settings.contact_email !== resolved) {
            settings.contact_email = resolved;
            await updateTenantSettings(row.id, settings);
            console.log(`[tenantStore] contact_email synced for tenant #${row.id} → ${resolved}`);
        }
    }
}

async function ensureTenantPaymentFormDefaults() {
    const { emptyPaymentSettings } = require('./saasTenantSettings');
    const defaults = emptyPaymentSettings();
    const tenants = await dbAll('SELECT id, settings FROM tenants WHERE deleted_at IS NULL');
    for (const row of tenants) {
        let settings = {};
        try {
            settings = row.settings ? JSON.parse(row.settings) : {};
        } catch (_) {
            settings = {};
        }
        let changed = false;
        Object.keys(defaults).forEach((key) => {
            if (settings[key] === undefined) {
                settings[key] = '';
                changed = true;
            }
        });
        if (changed) {
            await updateTenantSettings(row.id, settings);
            console.log(`[tenantStore] payment form defaults added for tenant #${row.id}`);
        }
    }
}

async function backfillTenantSettingsFromTemplate() {
    const { scrubStoredTenantSettings } = require('./tenantSettingsManager');
    const tenants = await dbAll('SELECT id FROM tenants WHERE deleted_at IS NULL');
    for (const row of tenants) {
        const tenant = await getTenantById(row.id);
        if (!tenant) continue;
        const scrubbed = scrubStoredTenantSettings(tenant.settings || {});
        const keysBefore = Object.keys(tenant.settings || {}).length;
        const keysAfter = Object.keys(scrubbed).length;
        if (keysBefore !== keysAfter || JSON.stringify(tenant.settings) !== JSON.stringify(scrubbed)) {
            await updateTenantSettings(row.id, scrubbed);
            console.log(`[tenantStore] settings scrubbed for tenant #${row.id} (${keysBefore} → ${keysAfter} keys)`);
        }
    }
}

function generatePassword(length = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#';
    let out = '';
    for (let i = 0; i < length; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}

async function ensurePlatformSchema() {
    const fs = require('fs');
    const migrationPath = path.join(__dirname, '../../migrations/create_saas_platform_tables.sql');
    if (!fs.existsSync(migrationPath)) return;
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
        try {
            await dbRun(stmt);
        } catch (err) {
            const msg = String(err.message || '').toLowerCase();
            if (!msg.includes('already exists') && !msg.includes('duplicate')) {
                console.warn('[tenantStore] migration warn:', err.message);
            }
        }
    }
}

// Satu sumber kebenaran: daftar tabel bisnis per-tenant ada di billingTenantScope
// (dipakai juga oleh interceptor auto-isolasi SQL).
const { BILLING_TENANT_SCOPED_TABLES: TENANT_SCOPED_TABLES } = require('./billingTenantScope');

async function tableExists(tableName) {
    const row = await dbGet(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
        [tableName]
    );
    return !!row;
}

async function tableHasColumn(tableName, columnName) {
    const cols = await dbAll(`PRAGMA table_info(${tableName})`);
    return cols.some((c) => c.name === columnName);
}

async function ensureTenantIdColumns() {
    for (const table of TENANT_SCOPED_TABLES) {
        try {
            if (!(await tableExists(table))) continue;
            if (await tableHasColumn(table, 'tenant_id')) continue;
            await dbRun(`ALTER TABLE ${table} ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1`);
            await dbRun(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant_id ON ${table}(tenant_id)`);
            console.log(`[tenantStore] tenant_id added → ${table}`);
        } catch (err) {
            const msg = String(err.message || '').toLowerCase();
            if (msg.includes('duplicate column')) continue;
            console.warn(`[tenantStore] tenant_id migration warn (${table}):`, err.message);
        }
    }
}

/**
 * Constraint UNIQUE global (warisan single-tenant) membuat tenant baru tidak
 * bisa memakai username/nomor/kode yang sudah dipakai tenant lain, dan upsert
 * bisa menimpa baris milik tenant lain. Migrasi ini mengubahnya menjadi
 * UNIQUE per-tenant: (tenant_id, kolom). Idempotent — hanya rebuild bila
 * DDL tabel masih mengandung UNIQUE global.
 */
const PER_TENANT_UNIQUE_SPECS = [
    { table: 'customers', dropColumnUnique: ['username', 'phone'], dropIndexes: ['idx_customers_customer_id'], composite: ['username', 'customer_id'] },
    { table: 'members', dropColumnUnique: ['username', 'phone'], composite: ['username', 'phone'] },
    { table: 'agents', dropColumnUnique: ['username', 'phone'], composite: ['username', 'phone'] },
    { table: 'technicians', dropColumnUnique: ['phone'], composite: ['phone'] },
    { table: 'collectors', dropColumnUnique: ['phone'], composite: ['phone'] },
    { table: 'employees', dropColumnUnique: ['nik'], dropIndexes: ['idx_employees_public_code'], composite: ['nik'] },
    { table: 'voucher_revenue', dropColumnUnique: ['username'], composite: ['username'] },
    { table: 'odps', dropColumnUnique: ['name', 'code'], composite: ['name', 'code'] },
    { table: 'invoices', dropColumnUnique: ['invoice_number'], composite: ['invoice_number'] },
    { table: 'installation_jobs', dropColumnUnique: ['job_number'], composite: ['job_number'] },
    { table: 'areas', dropTableUnique: ['nama_area'], composite: ['nama_area'] },
];

async function rebuildTableForPerTenantUnique(spec) {
    const { table, dropColumnUnique = [], dropTableUnique = [], dropIndexes = [], composite = [] } = spec;

    const row = await dbGet(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`, [table]);
    if (row && row.sql) {
        let ddl = String(row.sql);
        let changed = false;

        for (const col of dropColumnUnique) {
            const re = new RegExp(`(\\b${col}\\b[^,]*?)\\s+UNIQUE\\b`, 'i');
            if (re.test(ddl)) {
                ddl = ddl.replace(re, '$1');
                changed = true;
            }
        }
        for (const col of dropTableUnique) {
            const re = new RegExp(`,\\s*UNIQUE\\s*\\(\\s*${col}\\s*\\)`, 'i');
            if (re.test(ddl)) {
                ddl = ddl.replace(re, '');
                changed = true;
            }
        }

        if (changed) {
            const extras = await dbAll(
                `SELECT name, type, sql FROM sqlite_master
                 WHERE tbl_name = ? AND type IN ('index', 'trigger') AND sql IS NOT NULL`,
                [table]
            );
            const cols = await dbAll(`PRAGMA table_info(${table})`);
            const colList = cols.map((c) => `"${c.name}"`).join(', ');
            const backup = `${table}_mt_unique_mig`;

            // legacy_alter_table: RENAME tidak boleh ikut mengubah REFERENCES
            // di tabel lain (tabel asli dibuat ulang dengan nama yang sama).
            await dbRun('PRAGMA foreign_keys = OFF');
            await dbRun('PRAGMA legacy_alter_table = ON');
            await dbRun('BEGIN IMMEDIATE');
            try {
                await dbRun(`DROP TABLE IF EXISTS ${backup}`);
                await dbRun(`ALTER TABLE ${table} RENAME TO ${backup}`);
                await dbRun(ddl);
                await dbRun(`INSERT INTO ${table} (${colList}) SELECT ${colList} FROM ${backup}`);
                await dbRun(`DROP TABLE ${backup}`);
                for (const extra of extras) {
                    if (dropIndexes.includes(extra.name)) continue;
                    try {
                        await dbRun(extra.sql);
                    } catch (err) {
                        console.warn(`[tenantStore] recreate ${extra.type} ${extra.name} warn:`, err.message);
                    }
                }
                await dbRun('COMMIT');
                console.log(`[tenantStore] UNIQUE global dihapus → ${table} (${[...dropColumnUnique, ...dropTableUnique].join(', ')})`);
            } catch (err) {
                try { await dbRun('ROLLBACK'); } catch (_) { /* noop */ }
                console.warn(`[tenantStore] rebuild ${table} gagal (dibiarkan apa adanya):`, err.message);
            } finally {
                await dbRun('PRAGMA legacy_alter_table = OFF');
                await dbRun('PRAGMA foreign_keys = ON');
            }
        }
    }

    for (const name of dropIndexes) {
        try { await dbRun(`DROP INDEX IF EXISTS ${name}`); } catch (_) { /* noop */ }
    }
    for (const col of composite) {
        try {
            await dbRun(
                `CREATE UNIQUE INDEX IF NOT EXISTS uniq_${table}_tenant_${col} ON ${table}(tenant_id, ${col})`
            );
        } catch (err) {
            console.warn(`[tenantStore] composite unique (${table}.tenant_id+${col}) warn:`, err.message);
        }
    }
}

async function ensurePerTenantUniqueConstraints() {
    for (const spec of PER_TENANT_UNIQUE_SPECS) {
        try {
            if (!(await tableExists(spec.table))) continue;
            if (!(await tableHasColumn(spec.table, 'tenant_id'))) continue;
            await rebuildTableForPerTenantUnique(spec);
        } catch (err) {
            console.warn(`[tenantStore] per-tenant unique (${spec.table}) warn:`, err.message);
        }
    }
}

/**
 * Backfill tenant_id pada tabel relasi/turunan dari tabel induknya,
 * untuk baris lama yang sempat dibuat sebelum kolom tenant_id ada
 * (ALTER TABLE memberi DEFAULT 1 ke semua baris lama).
 */
const TENANT_BACKFILL_FROM_PARENT = [
    { table: 'customer_router_map', parent: 'customers', fk: 'customer_id' },
    { table: 'invoices', parent: 'customers', fk: 'customer_id' },
    { table: 'payments', parent: 'invoices', fk: 'invoice_id' },
    { table: 'collector_assignments', parent: 'customers', fk: 'customer_id' },
    { table: 'collector_areas', parent: 'collectors', fk: 'collector_id' },
    { table: 'collector_payments', parent: 'collectors', fk: 'collector_id' },
    { table: 'collector_transactions', parent: 'collectors', fk: 'collector_id' },
    { table: 'member_packages', parent: 'members', fk: 'member_id' },
    { table: 'goods_invoice_items', parent: 'goods_invoices', fk: 'goods_invoice_id' },
    { table: 'odp_connections', parent: 'odps', fk: 'odp_id' },
    { table: 'installation_job_status_history', parent: 'installation_jobs', fk: 'job_id' },
];

async function backfillTenantIdFromParents() {
    for (const { table, parent, fk } of TENANT_BACKFILL_FROM_PARENT) {
        try {
            if (!(await tableExists(table)) || !(await tableExists(parent))) continue;
            if (!(await tableHasColumn(table, 'tenant_id')) || !(await tableHasColumn(table, fk))) continue;
            if (!(await tableHasColumn(parent, 'tenant_id'))) continue;
            const res = await dbRun(
                `UPDATE ${table}
                 SET tenant_id = (SELECT p.tenant_id FROM ${parent} p WHERE p.id = ${table}.${fk})
                 WHERE EXISTS (SELECT 1 FROM ${parent} p WHERE p.id = ${table}.${fk} AND p.tenant_id != ${table}.tenant_id)`
            );
            if (res.changes > 0) {
                console.log(`[tenantStore] backfill tenant_id: ${table} ← ${parent} (${res.changes} baris)`);
            }
        } catch (err) {
            console.warn(`[tenantStore] backfill tenant_id (${table}) warn:`, err.message);
        }
    }
}

async function ensureDefaultTenant() {
    const existing = await dbGet('SELECT id FROM tenants WHERE id = 1');
    if (existing) return;

    await dbRun(
        `INSERT INTO tenants (
            id, uuid, name, subdomain, slug, owner_name, owner_email, owner_phone,
            subscription_plan_id, subscription_starts_at, subscription_ends_at,
            status, settings, provisioned_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','+10 years','localtime'), ?, ?, datetime('now','localtime'))`,
        [
            1,
            newUuid(),
            'Default Tenant',
            'default',
            'default',
            'Administrator',
            'admin@local',
            '08000000000',
            3,
            'active',
            JSON.stringify({
                admin_username: 'admin',
                admin_password: 'admin',
                company_header: 'Kalimasada Billing',
                company_name: 'Kalimasada Billing',
            }),
        ]
    );
}

async function ensureSuperAdmin(email, password, name = 'Kalimasada Management') {
    const hash = await bcrypt.hash(password, 10);
    const existing = await dbGet('SELECT id FROM super_admins WHERE email = ?', [email]);
    if (existing) {
        await dbRun(
            `UPDATE super_admins SET password_hash = ?, name = ?, is_active = 1, updated_at = datetime('now','localtime') WHERE email = ?`,
            [hash, name, email]
        );
        return existing.id;
    }
    const result = await dbRun(
        `INSERT INTO super_admins (name, email, password_hash) VALUES (?, ?, ?)`,
        [name, email, hash]
    );
    return result.id;
}

async function verifySuperAdmin(email, password) {
    const row = await dbGet('SELECT * FROM super_admins WHERE email = ? AND is_active = 1', [email]);
    if (!row) return null;
    const ok = await bcrypt.compare(password, row.password_hash);
    return ok ? row : null;
}

async function listSubscriptionPlans() {
    return dbAll('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY id');
}

async function listTenants({ includeDeleted = false } = {}) {
    const where = includeDeleted ? '' : 'WHERE t.deleted_at IS NULL';
    const rows = await dbAll(
        `SELECT t.*, sp.name as plan_name, sp.code as plan_code,
                sp.max_customers, sp.max_routers, sp.max_admins
         FROM tenants t
         LEFT JOIN subscription_plans sp ON sp.id = t.subscription_plan_id
         ${where}
         ORDER BY t.id DESC`
    );
    return rows.map(parseTenant);
}

async function getTenantById(id) {
    const row = await dbGet(
        `SELECT t.*, sp.name as plan_name, sp.code as plan_code,
                sp.max_customers, sp.max_routers, sp.max_admins
         FROM tenants t
         LEFT JOIN subscription_plans sp ON sp.id = t.subscription_plan_id
         WHERE t.id = ? AND t.deleted_at IS NULL`,
        [id]
    );
    return parseTenant(row);
}

async function getTenantBySubdomain(subdomain) {
    const row = await dbGet(
        `SELECT t.*, sp.name as plan_name, sp.code as plan_code,
                sp.max_customers, sp.max_routers, sp.max_admins
         FROM tenants t
         LEFT JOIN subscription_plans sp ON sp.id = t.subscription_plan_id
         WHERE t.subdomain = ? AND t.deleted_at IS NULL`,
        [String(subdomain).toLowerCase()]
    );
    return parseTenant(row);
}

async function getTenantStats(tenantId) {
    const safeCount = async (table) => {
        if (!(await tableExists(table))) return 0;
        if (!(await tableHasColumn(table, 'tenant_id'))) return 0;
        const row = await dbGet(`SELECT COUNT(*) as c FROM ${table} WHERE tenant_id = ?`, [tenantId]);
        return row?.c || 0;
    };
    return {
        customers: await safeCount('customers'),
        routers: await safeCount('routers'),
        invoices: await safeCount('invoices'),
    };
}

async function getGlobalStats() {
    const tenants = await dbGet(`SELECT COUNT(*) as total FROM tenants WHERE deleted_at IS NULL`);
    const active = await dbGet(`SELECT COUNT(*) as total FROM tenants WHERE status = 'active' AND deleted_at IS NULL`);
    const suspended = await dbGet(`SELECT COUNT(*) as total FROM tenants WHERE status = 'suspended' AND deleted_at IS NULL`);
    const customers = await dbGet('SELECT COUNT(*) as total FROM customers');
    return {
        totalTenants: tenants?.total || 0,
        activeTenants: active?.total || 0,
        suspendedTenants: suspended?.total || 0,
        totalCustomers: customers?.total || 0,
    };
}

async function logProvisionStep(tenantId, step, status, errorMessage = null) {
    await dbRun(
        `INSERT INTO tenant_provisioning_logs (tenant_id, step, status, error_message, started_at, completed_at)
         VALUES (?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
        [tenantId, step, status, errorMessage]
    );
}

async function seedDefaultPackages(tenantId) {
    if (!(await tableHasColumn('packages', 'tenant_id'))) {
        await ensureTenantIdColumns();
    }
    const packages = [
        { name: 'Paket 10 Mbps', price: 150000, speed: '10M/10M' },
        { name: 'Paket 20 Mbps', price: 200000, speed: '20M/20M' },
        { name: 'Paket 50 Mbps', price: 350000, speed: '50M/50M' },
    ];
    for (const pkg of packages) {
        await dbRun(
            `INSERT INTO packages (name, speed, price, description, tenant_id, is_active)
             SELECT ?, ?, ?, ?, ?, 1
             WHERE NOT EXISTS (SELECT 1 FROM packages WHERE tenant_id = ? AND name = ?)`,
            [pkg.name, pkg.speed, pkg.price, `Kecepatan ${pkg.speed}`, tenantId, tenantId, pkg.name]
        );
    }
}

function releasedIdentifier(base, id) {
    const suffix = `__del_${id}`;
    const maxBase = 63 - suffix.length;
    return `${String(base).slice(0, maxBase)}${suffix}`;
}

async function releaseTenantIdentifiers(id) {
    const row = await dbGet('SELECT subdomain, slug FROM tenants WHERE id = ?', [id]);
    if (!row) return;
    const subdomain = releasedIdentifier(row.subdomain.replace(/__del_\d+$/, ''), id);
    const slug = releasedIdentifier(row.slug.replace(/__del_\d+$/, ''), id);
    await dbRun(
        `UPDATE tenants SET subdomain = ?, slug = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
        [subdomain, slug, id]
    );
}

/** Bebaskan subdomain/slug dari tenant deleted/failed agar bisa dipakai lagi. */
async function reclaimSubdomainIfStale(subdomain) {
    const stale = await dbAll(
        `SELECT id FROM tenants
         WHERE (subdomain = ? OR slug = ? OR subdomain LIKE ? OR slug LIKE ?)
           AND (deleted_at IS NOT NULL OR status IN ('failed', 'deleted'))`,
        [subdomain, subdomain, `${subdomain}__del_%`, `${subdomain}__del_%`]
    );
    for (const row of stale) {
        await releaseTenantIdentifiers(row.id);
    }
}

async function releaseDeletedTenantSlugs() {
    const rows = await dbAll(
        `SELECT id, subdomain, slug FROM tenants
         WHERE deleted_at IS NOT NULL AND subdomain NOT LIKE '%__del_%'`
    );
    for (const row of rows) {
        await releaseTenantIdentifiers(row.id);
    }
}

async function createTenant(data) {
    const subdomain = String(data.subdomain).toLowerCase().trim();
    if (isReservedSubdomain(subdomain)) {
        throw new Error(`Subdomain "${subdomain}" tidak boleh digunakan.`);
    }
    await reclaimSubdomainIfStale(subdomain);
    const dup = await dbGet(
        `SELECT id FROM tenants WHERE (subdomain = ? OR slug = ?) AND deleted_at IS NULL AND status NOT IN ('failed', 'deleted')`,
        [subdomain, subdomain]
    );
    if (dup) throw new Error('Subdomain sudah digunakan.');

    const plan = await dbGet('SELECT * FROM subscription_plans WHERE id = ?', [data.subscription_plan_id]);
    if (!plan) throw new Error('Paket subscription tidak valid.');

    const months = Number(data.subscription_months) || 1;
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + months);
    const endsAtSql = endsAt.toISOString().slice(0, 19).replace('T', ' ');
    const settings = defaultTenantSettings({
        name: data.name,
        owner_email: data.owner_email,
        owner_phone: data.owner_phone,
        admin_username: data.admin_username,
        admin_password: data.admin_password,
    });

    const insert = await dbRun(
        `INSERT INTO tenants (
            uuid, name, subdomain, slug, owner_name, owner_email, owner_phone,
            subscription_plan_id, subscription_starts_at, subscription_ends_at,
            status, settings
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), ?, 'provisioning', ?)`,
        [
            newUuid(),
            data.name,
            subdomain,
            subdomain,
            data.owner_name,
            data.owner_email,
            data.owner_phone,
            data.subscription_plan_id,
            endsAtSql,
            JSON.stringify(settings),
        ]
    );

    const tenantId = insert.id;

    try {
        await logProvisionStep(tenantId, 'create_record', 'completed');
        await seedDefaultPackages(tenantId);
        await logProvisionStep(tenantId, 'default_packages', 'completed');
        await logProvisionStep(tenantId, 'default_settings', 'completed');

        await dbRun(
            `UPDATE tenants SET status = 'active', provisioned_at = datetime('now','localtime'), updated_at = datetime('now','localtime') WHERE id = ?`,
            [tenantId]
        );
        await logProvisionStep(tenantId, 'activate', 'completed');
    } catch (err) {
        await logProvisionStep(tenantId, 'provision_failed', 'failed', err.message);
        await dbRun(`UPDATE tenants SET status = 'failed', updated_at = datetime('now','localtime') WHERE id = ?`, [tenantId]);
        throw err;
    }

    return getTenantById(tenantId);
}

async function updateTenant(id, data) {
    const tenant = await getTenantById(id);
    if (!tenant) throw new Error('Tenant tidak ditemukan.');

    let subdomain = data.subdomain ? String(data.subdomain).toLowerCase().trim() : tenant.subdomain;
    if (isReservedSubdomain(subdomain)) {
        throw new Error(`Subdomain "${subdomain}" tidak boleh digunakan.`);
    }
    if (subdomain !== tenant.subdomain) {
        const dup = await dbGet('SELECT id FROM tenants WHERE subdomain = ? AND id != ? AND deleted_at IS NULL', [subdomain, id]);
        if (dup) throw new Error('Subdomain sudah digunakan.');
    }

    const months = data.subscription_months ? Number(data.subscription_months) : null;
    let endsAtSql = null;
    if (months) {
        const endsAt = new Date();
        endsAt.setMonth(endsAt.getMonth() + months);
        endsAtSql = endsAt.toISOString().slice(0, 19).replace('T', ' ');
    }

    const newName = data.name ?? tenant.name;
    await dbRun(
        `UPDATE tenants SET
            name = ?, subdomain = ?, slug = ?, owner_name = ?, owner_email = ?, owner_phone = ?,
            subscription_plan_id = ?,
            subscription_ends_at = COALESCE(?, subscription_ends_at),
            updated_at = datetime('now','localtime')
         WHERE id = ?`,
        [
            newName,
            subdomain,
            subdomain,
            data.owner_name ?? tenant.owner_name,
            data.owner_email ?? tenant.owner_email,
            data.owner_phone ?? tenant.owner_phone,
            data.subscription_plan_id ?? tenant.subscription_plan_id,
            endsAtSql,
            id,
        ]
    );

    const settings = { ...(tenant.settings || {}) };
    let settingsChanged = false;

    if (newName !== tenant.name || subdomain !== tenant.subdomain) {
        settings.company_header = newName;
        settings.company_name = newName;
        settings.app_name = newName;
        settingsChanged = true;
    }
    if (data.owner_phone) {
        settings.contact_phone = data.owner_phone;
        settings.contact_whatsapp = data.owner_phone;
        settingsChanged = true;
    }
    if (data.owner_email !== undefined) {
        settings.contact_email = String(data.owner_email).trim();
        settingsChanged = true;
    }

    if (data.admin_username !== undefined || (data.admin_password !== undefined && String(data.admin_password).trim())) {
        const creds = resolveAdminCredentials(data, {
            admin_username: settings.admin_username,
            admin_password: settings.admin_password,
        });
        settings.admin_username = creds.admin_username;
        settings.admin_password = creds.admin_password;
        settingsChanged = true;
    }

    if (settingsChanged) {
        await updateTenantSettings(id, settings);
    }

    return getTenantById(id);
}

async function suspendTenant(id, reason = 'Suspended by Super Admin') {
    await dbRun(
        `UPDATE tenants SET status = 'suspended', suspended_at = datetime('now','localtime'),
         suspension_reason = ?, updated_at = datetime('now','localtime') WHERE id = ? AND deleted_at IS NULL`,
        [reason, id]
    );
    return getTenantById(id);
}

async function activateTenant(id) {
    await dbRun(
        `UPDATE tenants SET status = 'active', suspended_at = NULL, suspension_reason = NULL,
         updated_at = datetime('now','localtime') WHERE id = ? AND deleted_at IS NULL`,
        [id]
    );
    return getTenantById(id);
}

async function deleteTenant(id) {
    if (Number(id) === 1) {
        throw new Error('Tenant default tidak bisa dihapus.');
    }
    await releaseTenantIdentifiers(id);
    await dbRun(
        `UPDATE tenants SET status = 'deleted', deleted_at = datetime('now','localtime'),
         updated_at = datetime('now','localtime') WHERE id = ?`,
        [id]
    );
}

async function auditLog({ tenantId, actorType, actorId, action, details, ip }) {
    await dbRun(
        `INSERT INTO platform_audit_logs (tenant_id, actor_type, actor_id, action, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tenantId || null, actorType, actorId || null, action, details ? JSON.stringify(details) : null, ip || null]
    );
}

async function initPlatform() {
    await ensurePlatformSchema();
    await ensureTenantIdColumns();
    await ensurePerTenantUniqueConstraints();
    await backfillTenantIdFromParents();
    await releaseDeletedTenantSlugs();
    await ensureDefaultTenant();
    await backfillTenantSettingsFromTemplate();
    await ensureTenantPaymentFormDefaults();
    await syncTenantContactEmailsFromOwner();
    await ensureSuperAdmin('management@kalimasada', 'kalimasada123', 'Kalimasada Management');
    console.log('[platform] SaaS platform initialized');
}

module.exports = {
    initPlatform,
    listSubscriptionPlans,
    listTenants,
    getTenantById,
    getTenantBySubdomain,
    getTenantStats,
    getGlobalStats,
    createTenant,
    updateTenant,
    suspendTenant,
    activateTenant,
    deleteTenant,
    verifySuperAdmin,
    auditLog,
    isReservedSubdomain,
    updateTenantSettings,
    getDb,
};
