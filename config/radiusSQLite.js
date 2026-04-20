const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

/**
 * Wrapper for sqlite3 to provide a mysql2-compatible promise API
 */
class RADIUSDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }

    async connect() {
        if (this.db) return;

        // Ensure directory exists
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
                    this.initSchema().then(resolve).catch(reject);
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
                framedipaddress TEXT NOT NULL DEFAULT ''
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

        // SQLite index doesn't support length like username(32), remove that
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

    /**
     * mysql2-compatible execute (promise based)
     */
    async execute(sql, params = []) {
        if (!this.db) await this.connect();

        // Convert SQL syntax from MySQL to SQLite
        let sqliteSQL = sql
            .replace(/ON DUPLICATE KEY UPDATE/gi, 'ON CONFLICT DO UPDATE SET') // Simple replacement, might need more refinement
            .replace(/NOW\(\)/gi, "datetime('now', 'localtime')")
            .replace(/TIMESTAMPDIFF\(SECOND, ([^,]+), ([^)]+)\)/gi, "(strftime('%s', $2) - strftime('%s', $1))");

        // Special handling for ON DUPLICATE KEY UPDATE which is very different in SQLite
        // If it's radcheck or radgroupreply, we often know the unique keys
        if (sqliteSQL.includes('radcheck') && sqliteSQL.includes('ON CONFLICT')) {
            sqliteSQL = sqliteSQL.replace(/INSERT INTO radcheck \((.*?)\) VALUES \((.*?)\) ON CONFLICT DO UPDATE SET (.*)/i, 
                (match, cols, vals, update) => {
                    // Check if we have a unique constraint or if we should use INSERT OR REPLACE
                    return `INSERT INTO radcheck (${cols}) VALUES (${vals}) ON CONFLICT(username, attribute) DO UPDATE SET ${update}`;
                }
            );
        }

        return new Promise((resolve, reject) => {
            if (sqliteSQL.trim().toUpperCase().startsWith('SELECT')) {
                this.db.all(sqliteSQL, params, (err, rows) => {
                    if (err) {
                        logger.error(`[RADIUS-SQLITE] Query Error: ${err.message}\nSQL: ${sqliteSQL}`);
                        reject(err);
                    } else {
                        resolve([rows, []]); // Return [rows, fields] to match mysql2
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

    async end() {
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

async function getRadiusConnection() {
    const { getRadiusConfig } = require('./radiusConfig');
    const config = await getRadiusConfig();
    
    // We use the database name as the SQLite file name
    const dbName = config.radius_database || 'radius';
    const dbPath = path.join(process.cwd(), 'data', dbName.endsWith('.db') ? dbName : `${dbName}.db`);
    
    const conn = new RADIUSDatabase(dbPath);
    await conn.connect();
    return conn;
}

module.exports = { getRadiusConnection };
