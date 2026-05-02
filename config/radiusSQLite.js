const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

/**
 * Singleton RADIUS SQLite connection.
 * Using a single persistent connection prevents SQLite SQLITE_BUSY / deadlock
 * issues caused by multiple concurrent connections opening the same database file.
 */
let _singletonConn = null;
let _singletonPath = null;

/**
 * Path file SQLite yang dipakai FreeRADIUS harus sama dengan yang dibaca aplikasi.
 * Prioritas: env RADIUS_SQLITE_PATH → path absolut di app_settings → data/<nama>.db
 */
async function resolveRadiusSqliteDbPath() {
    const { getRadiusConfig } = require('./radiusConfig');
    const config = await getRadiusConfig();
    const envPath = process.env.RADIUS_SQLITE_PATH && String(process.env.RADIUS_SQLITE_PATH).trim();
    if (envPath) {
        return {
            dbPath: path.resolve(envPath),
            source: 'environment:RADIUS_SQLITE_PATH'
        };
    }
    const raw = String(config.radius_database || 'radius').trim();
    if (!raw) {
        return {
            dbPath: path.join(__dirname, '..', 'data', 'radius.db'),
            source: 'default:data/radius.db'
        };
    }
    if (path.isAbsolute(raw)) {
        const p = raw.endsWith('.db') ? raw : `${raw}.db`;
        return { dbPath: p, source: 'app_settings:absolute_path' };
    }
    const baseFile = raw.endsWith('.db') ? raw : `${raw}.db`;
    return {
        dbPath: path.join(__dirname, '..', 'data', baseFile),
        source: `app_settings:data/${baseFile}`
    };
}

class RADIUSDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
        this._isSingleton = false;
    }

    async connect() {
        if (this.db) return;

        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    logger.error(`[RADIUS-SQLITE] Error opening database: ${err.message}`);
                    reject(err);
                } else {
                    logger.info(`[RADIUS-SQLITE] Connected to database: ${this.dbPath}`);
                    // Enable WAL mode for better concurrency
                    this.db.run('PRAGMA journal_mode=WAL', () => {
                        // 5 second busy timeout so writers wait instead of deadlocking
                        this.db.run('PRAGMA busy_timeout=5000', () => {
                            this.initSchema().then(resolve).catch(reject);
                        });
                    });
                }
            });
        });
    }

    async initSchema() {
        const schema = [
            `CREATE TABLE IF NOT EXISTS radcheck (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL DEFAULT '',
                attribute TEXT NOT NULL DEFAULT '',
                op TEXT NOT NULL DEFAULT '==',
                value TEXT NOT NULL DEFAULT '',
                UNIQUE(username, attribute)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_radcheck_username ON radcheck (username)`,
            `CREATE TABLE IF NOT EXISTS radreply (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL DEFAULT '',
                attribute TEXT NOT NULL DEFAULT '',
                op TEXT NOT NULL DEFAULT '=',
                value TEXT NOT NULL DEFAULT '',
                UNIQUE(username, attribute)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_radreply_username ON radreply (username)`,
            `CREATE TABLE IF NOT EXISTS radgroupcheck (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                groupname TEXT NOT NULL DEFAULT '',
                attribute TEXT NOT NULL DEFAULT '',
                op TEXT NOT NULL DEFAULT '==',
                value TEXT NOT NULL DEFAULT '',
                UNIQUE(groupname, attribute)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_radgroupcheck_groupname ON radgroupcheck (groupname)`,
            `CREATE TABLE IF NOT EXISTS radgroupreply (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                groupname TEXT NOT NULL DEFAULT '',
                attribute TEXT NOT NULL DEFAULT '',
                op TEXT NOT NULL DEFAULT '=',
                value TEXT NOT NULL DEFAULT '',
                UNIQUE(groupname, attribute)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_radgroupreply_groupname ON radgroupreply (groupname)`,
            `CREATE TABLE IF NOT EXISTS radusergroup (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL DEFAULT '',
                groupname TEXT NOT NULL DEFAULT '',
                priority INTEGER NOT NULL DEFAULT 1,
                UNIQUE(username, groupname)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_radusergroup_username ON radusergroup (username)`,
            `CREATE TABLE IF NOT EXISTS radacct (
                radacctid INTEGER PRIMARY KEY AUTOINCREMENT,
                acctsessionid TEXT NOT NULL DEFAULT '',
                acctuniqueid TEXT NOT NULL DEFAULT '',
                username TEXT NOT NULL DEFAULT '',
                groupname TEXT NOT NULL DEFAULT '',
                realm TEXT DEFAULT '',
                nasipaddress TEXT NOT NULL DEFAULT '',
                nasportid TEXT DEFAULT NULL,
                nasporttype TEXT DEFAULT NULL,
                acctstarttime DATETIME DEFAULT NULL,
                acctupdatetime DATETIME DEFAULT NULL,
                acctstoptime DATETIME DEFAULT NULL,
                acctinterval INTEGER DEFAULT NULL,
                acctsessiontime INTEGER DEFAULT NULL,
                acctauthentic TEXT DEFAULT NULL,
                connectinfo_start TEXT DEFAULT NULL,
                connectinfo_stop TEXT DEFAULT NULL,
                acctinputoctets INTEGER DEFAULT NULL,
                acctoutputoctets INTEGER DEFAULT NULL,
                calledstationid TEXT NOT NULL DEFAULT '',
                callingstationid TEXT NOT NULL DEFAULT '',
                acctterminatecause TEXT NOT NULL DEFAULT '',
                servicetype TEXT DEFAULT NULL,
                framedprotocol TEXT DEFAULT NULL,
                framedipaddress TEXT NOT NULL DEFAULT '',
                framedipv6address TEXT NOT NULL DEFAULT '',
                framedipv6prefix TEXT NOT NULL DEFAULT '',
                framedinterfaceid TEXT NOT NULL DEFAULT '',
                delegatedipv6prefix TEXT NOT NULL DEFAULT ''
            )`,
            `CREATE INDEX IF NOT EXISTS idx_radacct_active ON radacct (acctstoptime, username, acctstarttime)`,
            `CREATE TABLE IF NOT EXISTS radpostauth (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL DEFAULT '',
                pass TEXT NOT NULL DEFAULT '',
                reply TEXT NOT NULL DEFAULT '',
                authdate DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS nas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nasname TEXT NOT NULL,
                shortname TEXT,
                type TEXT DEFAULT 'other',
                ports INTEGER,
                secret TEXT NOT NULL,
                server TEXT,
                community TEXT,
                description TEXT DEFAULT 'RADIUS Client',
                UNIQUE(nasname)
            )`
        ];

        const cleanSchema = schema.map(s => s.replace(/\(\d+\)/g, ''));

        for (const statement of cleanSchema) {
            await new Promise((resolve, reject) => {
                this.db.run(statement, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
        logger.info('[RADIUS-SQLITE] Schema initialized');
    }

    async execute(sql, params = []) {
        if (!this.db) await this.connect();

        let sqliteSQL = sql
            .replace(/ON DUPLICATE KEY UPDATE/gi, 'ON CONFLICT DO UPDATE SET')
            .replace(/NOW\(\)/gi, "datetime('now', 'localtime')")
            .replace(/TIMESTAMPDIFF\(SECOND, ([^,]+), ([^)]+)\)/gi, "(strftime('%s', $2) - strftime('%s', $1))");

        if (sqliteSQL.includes('radcheck') && sqliteSQL.includes('ON CONFLICT')) {
            sqliteSQL = sqliteSQL.replace(/INSERT INTO radcheck \((.*?)\) VALUES \((.*?)\) ON CONFLICT DO UPDATE SET (.*)/i,
                (match, cols, vals, update) => {
                    return `INSERT INTO radcheck (${cols}) VALUES (${vals}) ON CONFLICT(username, attribute) DO UPDATE SET ${update}`;
                }
            );
        }

        return new Promise((resolve, reject) => {
            const sqlUpper = sqliteSQL.trim().toUpperCase();
            if (sqlUpper.startsWith('SELECT') || sqlUpper.startsWith('PRAGMA') || sqlUpper.startsWith('EXPLAIN')) {
                this.db.all(sqliteSQL, params, (err, rows) => {
                    if (err) {
                        logger.error(`[RADIUS-SQLITE] Query Error: ${err.message}\nSQL: ${sqliteSQL}`);
                        reject(err);
                    } else {
                        resolve([rows, []]);
                    }
                });
            } else {
                this.db.run(sqliteSQL, params, function(err) {
                    if (err) {
                        logger.error(`[RADIUS-SQLITE] Exec Error: ${err.message}\nSQL: ${sqliteSQL}`);
                        reject(err);
                    } else {
                        resolve([{
                            affectedRows: this.changes,
                            insertId: this.lastID
                        }, []]);
                    }
                });
            }
        });
    }

    async query(sql, params = []) {
        return this.execute(sql, params);
    }

    /**
     * end() is a NO-OP for singleton connections.
     * The connection stays open permanently to avoid repeated open/close
     * that caused SQLite SQLITE_BUSY errors and log spam.
     */
    async end() {
        if (this._isSingleton) {
            return; // Do NOT close - singleton is reused across all requests
        }
        if (this.db) {
            return new Promise((resolve, reject) => {
                this.db.close((err) => {
                    this.db = null;
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    }
}

/**
 * Returns the singleton RADIUS connection.
 * Creates once, reuses forever to prevent SQLite locking deadlocks.
 */
async function getRadiusConnection() {
    const { dbPath, source } = await resolveRadiusSqliteDbPath();

    // Reuse singleton if path matches and connection is still alive
    if (_singletonConn && _singletonPath === dbPath && _singletonConn.db) {
        return _singletonConn;
    }

    // Path changed - close old connection before creating new one
    if (_singletonConn && _singletonConn.db && _singletonPath !== dbPath) {
        try {
            _singletonConn._isSingleton = false;
            await _singletonConn.end();
        } catch (_) {}
        _singletonConn = null;
    }

    const conn = new RADIUSDatabase(dbPath);
    conn._isSingleton = true;
    await conn.connect();

    // Verifikasi skema: cukup wajibkan radcheck (file SQLite produksi FreeRADIUS sering
    // tidak punya tabel `nas` atau subset radgroup* — kalau disyaratkan semua, koneksi gagal
    // dan seluruh UI RADIUS/PPPoE kosong padahal autentikasi di router jalan).
    const [tables] = await conn.execute("SELECT name FROM sqlite_master WHERE type='table'");
    const existingTables = Array.isArray(tables) ? tables.map((t) => t.name) : [];
    const requiredTables = ['radcheck'];
    const missingRequired = requiredTables.filter((t) => !existingTables.includes(t));
    if (missingRequired.length > 0) {
        logger.error(`[RADIUS-SQLITE] Missing required tables: ${missingRequired.join(', ')}`);
        throw new Error(`RADIUS database unusable. Missing: ${missingRequired.join(', ')}`);
    }
    const optionalTables = ['radreply', 'radgroupcheck', 'radgroupreply', 'radusergroup', 'radacct', 'nas'];
    const missingOptional = optionalTables.filter((t) => !existingTables.includes(t));
    if (missingOptional.length > 0) {
        logger.warn(`[RADIUS-SQLITE] ${dbPath} — tabel opsional tidak ada (fitur terbatas): ${missingOptional.join(', ')}`);
    }
    logger.info(
        `[RADIUS-SQLITE] Using ${dbPath} [${source}] (${existingTables.length} tables, radcheck OK)`
    );

    _singletonConn = conn;
    _singletonPath = dbPath;
    return conn;
}

/** Untuk halaman tes / diagnosa: path ter-resolve + ringkasan isi radcheck (tanpa membuka billing). */
async function getRadiusSqliteFileDiagnostics() {
    const resolved = await resolveRadiusSqliteDbPath();
    const out = {
        ...resolved,
        fileExists: fs.existsSync(resolved.dbPath),
        fileSizeBytes: null,
        radcheckRowCount: null,
        radcheckPasswordUserCount: null,
        error: null
    };
    try {
        if (out.fileExists) {
            out.fileSizeBytes = fs.statSync(resolved.dbPath).size;
        }
        const conn = await getRadiusConnection();
        const [r1] = await conn.execute('SELECT COUNT(*) as n FROM radcheck');
        out.radcheckRowCount = Array.isArray(r1) && r1[0] != null ? r1[0].n : null;
        const [r2] = await conn.execute(`
            SELECT COUNT(DISTINCT username) as n FROM radcheck
            WHERE LOWER(TRIM(attribute)) IN (
                'cleartext-password','user-password','crypt-password','md5-password',
                'sha-password','smd5-password','mikrotik-password'
            )
        `);
        out.radcheckPasswordUserCount = Array.isArray(r2) && r2[0] != null ? r2[0].n : null;
        await conn.end();
    } catch (e) {
        out.error = e.message;
    }
    return out;
}

module.exports = {
    getRadiusConnection,
    resolveRadiusSqliteDbPath,
    getRadiusSqliteFileDiagnostics
};
