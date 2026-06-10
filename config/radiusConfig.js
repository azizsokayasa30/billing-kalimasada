const path = require('path');
const logger = require('./logger');
const tenantStore = require('./platform/tenantStore');

const RADIUS_KEYS = ['user_auth_mode', 'radius_host', 'radius_user', 'radius_password', 'radius_database'];

/** Schema migration runs once per process — avoid opening billing.db on every config read. */
let _schemaReadyPromise = null;

function dbRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
}

function dbGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
    });
}

function dbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });
}

function getTenantScopeId() {
    try {
        const { hasTenantContext, getTenantId } = require('./platform/tenantContext');
        if (hasTenantContext()) return getTenantId();
    } catch (_) {}
    return null;
}

// Ensure app_settings table exists (+ tenant_id for SaaS)
function migrateAppSettingsForMultiTenant(db) {
    return new Promise((resolve) => {
        db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='app_settings'`, (err, row) => {
            const ddl = row && row.sql ? String(row.sql) : '';
            if (!ddl || ddl.includes('UNIQUE(key, tenant_id)')) {
                resolve();
                return;
            }
            db.serialize(() => {
                db.run(`CREATE TABLE IF NOT EXISTS app_settings_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT NOT NULL,
                    value TEXT,
                    tenant_id INTEGER NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT (datetime('now','localtime')),
                    updated_at DATETIME DEFAULT (datetime('now','localtime')),
                    UNIQUE(key, tenant_id)
                )`);
                db.run(`INSERT OR IGNORE INTO app_settings_new (id, key, value, tenant_id, created_at, updated_at)
                        SELECT id, key, value, COALESCE(tenant_id, 1), created_at, updated_at FROM app_settings`);
                db.run('DROP TABLE app_settings', () => {
                    db.run('ALTER TABLE app_settings_new RENAME TO app_settings', () => {
                        db.run('CREATE INDEX IF NOT EXISTS idx_app_settings_tenant_id ON app_settings(tenant_id)', () => resolve());
                    });
                });
            });
        });
    });
}

function ensureAppSettingsTable() {
    if (_schemaReadyPromise) return _schemaReadyPromise;

    _schemaReadyPromise = (async () => {
        const db = tenantStore.getDb();
        await dbRun(db, `
            CREATE TABLE IF NOT EXISTS app_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT NOT NULL,
                value TEXT,
                tenant_id INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT (datetime('now','localtime')),
                updated_at DATETIME DEFAULT (datetime('now','localtime')),
                UNIQUE(key, tenant_id)
            )
        `);
        try {
            await dbRun(db, `ALTER TABLE app_settings ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1`);
        } catch (err) {
            const msg = String(err.message || '').toLowerCase();
            if (!msg.includes('duplicate column')) throw err;
        }
        await migrateAppSettingsForMultiTenant(db);
        await dbRun(db, `CREATE INDEX IF NOT EXISTS idx_app_settings_tenant_id ON app_settings(tenant_id)`);
    })().catch((err) => {
        _schemaReadyPromise = null;
        throw err;
    });

    return _schemaReadyPromise;
}

function settingsWhereClause() {
    const tenantId = getTenantScopeId();
    if (tenantId != null) {
        return { sql: 'tenant_id = ?', params: [tenantId], tenantId };
    }
    return { sql: 'tenant_id = 1', params: [], tenantId: 1 };
}

// Get radius configuration from database (per tenant when in tenant context)
async function getRadiusConfig() {
    await ensureAppSettingsTable();
    const scope = settingsWhereClause();
    const db = tenantStore.getDb();
    const placeholders = RADIUS_KEYS.map(() => '?').join(', ');

    try {
        const rows = await dbAll(
            db,
            `SELECT key, value FROM app_settings WHERE key IN (${placeholders}) AND ${scope.sql}`,
            [...RADIUS_KEYS, ...scope.params]
        );
        const config = {};
        rows.forEach((row) => {
            config[row.key] = row.value;
        });
        return {
            user_auth_mode: config.user_auth_mode || 'mikrotik',
            radius_host: config.radius_host || 'localhost',
            radius_user: config.radius_user || 'radius',
            radius_password: config.radius_password || 'radius',
            radius_database: config.radius_database || 'radius',
        };
    } catch (err) {
        logger.error(`Error getting radius config from database: ${err.message}`);
        return {
            user_auth_mode: 'mikrotik',
            radius_host: 'localhost',
            radius_user: 'radius',
            radius_password: 'radius',
            radius_database: 'radius',
        };
    }
}

// Save radius configuration to database (per tenant)
async function saveRadiusConfig(config) {
    await ensureAppSettingsTable();
    const scope = settingsWhereClause();
    const tenantId = scope.tenantId;
    const db = tenantStore.getDb();

    const entries = [
        ['user_auth_mode', config.user_auth_mode || 'radius'],
        ['radius_host', config.radius_host || 'localhost'],
        ['radius_user', config.radius_user || 'radius'],
        ['radius_password', config.radius_password || 'radius'],
        ['radius_database', config.radius_database || 'radius'],
    ];

    await dbRun(db, 'BEGIN IMMEDIATE');
    try {
        for (const [key, value] of entries) {
            await dbRun(
                db,
                `INSERT INTO app_settings (key, value, tenant_id, updated_at)
                 VALUES (?, ?, ?, datetime('now','localtime'))
                 ON CONFLICT(key, tenant_id) DO UPDATE SET
                   value = excluded.value,
                   updated_at = datetime('now','localtime')`,
                [key, value, tenantId]
            );
        }
        await dbRun(db, 'COMMIT');
        logger.info(`Radius configuration saved (tenant_id=${tenantId})`);
        return true;
    } catch (err) {
        try { await dbRun(db, 'ROLLBACK'); } catch (_) {}
        logger.error(`Error committing radius config: ${err.message}`);
        throw err;
    }
}

// Get single radius config value (per tenant)
async function getRadiusConfigValue(key, defaultValue = null) {
    await ensureAppSettingsTable();
    const scope = settingsWhereClause();
    const db = tenantStore.getDb();

    try {
        const row = await dbGet(
            db,
            `SELECT value FROM app_settings WHERE key = ? AND ${scope.sql}`,
            [key, ...scope.params]
        );
        if (!row) return defaultValue;
        return row.value || defaultValue;
    } catch (_) {
        return defaultValue;
    }
}

module.exports = {
    getRadiusConfig,
    saveRadiusConfig,
    getRadiusConfigValue,
    ensureAppSettingsTable,
};
