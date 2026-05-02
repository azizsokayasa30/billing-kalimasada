const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const FR_SQL_MODULE = '/etc/freeradius/3.0/mods-enabled/sql';
const FR_FILES_AUTHORIZE = '/etc/freeradius/3.0/mods-config/files/authorize';

/**
 * Laporkan risiko "PPPoE tidak cocok dengan aplikasi" setelah deploy:
 * - path SQLite FR vs path yang dipakai billing (resolveRadiusSqliteDbPath)
 * - user statis di mods-config/files/authorize (bypass radcheck)
 * - tabel radcheck di billing.db (legasi; beda dari radius.db)
 *
 * Tidak memuat nilai password; hanya nama user sampel dari file authorize.
 */
function safeReadFile(absPath) {
    try {
        return fs.readFileSync(absPath, 'utf8');
    } catch {
        return null;
    }
}

function parseFrSqliteFilename(sqlContent) {
    if (!sqlContent) return null;
    const m =
        sqlContent.match(/filename\s*=\s*"([^"]+)"/i) ||
        sqlContent.match(/filename\s*=\s*'([^']+)'/i);
    return m ? path.normalize(path.resolve(m[1].trim())) : null;
}

/** Username dari baris users file yang memuat atribut sandi (bukan komentar). */
function parseFilesAuthorizePasswordUsernames(content) {
    if (!content) return [];
    const users = new Set();
    const re =
        /^([^\s#]+)\s+(Cleartext-Password|User-Password|MD5-Password|Crypt-Password|SMD5-Password|SHA-Password|Mikrotik-Password)\s+/i;
    for (const line of content.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const m = t.match(re);
        if (m) users.add(m[1]);
    }
    return [...users].sort((a, b) => a.localeCompare(b));
}

function countRadcheckInBillingDb(billingDbPath) {
    return new Promise((resolve) => {
        if (!fs.existsSync(billingDbPath)) {
            resolve({ exists: false, rowCount: 0 });
            return;
        }
        const db = new sqlite3.Database(billingDbPath, sqlite3.OPEN_READONLY);
        db.get(
            `SELECT 1 AS o FROM sqlite_master WHERE type='table' AND name='radcheck'`,
            [],
            (err, row) => {
                if (err || !row) {
                    db.close();
                    return resolve({ exists: false, rowCount: 0 });
                }
                db.get('SELECT COUNT(*) AS n FROM radcheck', [], (e2, r2) => {
                    db.close();
                    if (e2) return resolve({ exists: true, rowCount: null, error: e2.message });
                    resolve({ exists: true, rowCount: r2.n });
                });
            }
        );
    });
}

async function getRadiusConsistencyReport() {
    const root = path.join(__dirname, '..');
    const billingDbPath = path.join(root, 'data', 'billing.db');
    const { resolveRadiusSqliteDbPath } = require('./radiusSQLite');

    const resolved = await resolveRadiusSqliteDbPath();
    const appPath = path.normalize(path.resolve(resolved.dbPath));

    const warnings = [];
    const notes = [];

    const sqlText = safeReadFile(FR_SQL_MODULE);
    let frSqlitePath = null;
    if (!sqlText) {
        notes.push(
            `Tidak bisa membaca ${FR_SQL_MODULE} (wajar di dev tanpa FreeRADIUS, atau tanpa izin baca).`
        );
    } else {
        const raw = parseFrSqliteFilename(sqlText);
        if (raw) frSqlitePath = path.normalize(raw);
        if (!frSqlitePath) {
            warnings.push(
                'FreeRADIUS mods-enabled/sql: tidak menemukan baris filename= untuk SQLite — pastikan driver sqlite dan path file.'
            );
        } else if (frSqlitePath !== appPath) {
            warnings.push(
                `PATH SQLITE BEDA: billing memakai "${appPath}" (${resolved.source}), FreeRADIUS sql memakai "${frSqlitePath}". Autentikasi tidak mengikuti file yang Anda lihat di aplikasi.`
            );
        }
    }

    const filesContent = safeReadFile(FR_FILES_AUTHORIZE);
    let filesAuthorizeUsernames = [];
    if (filesContent === null) {
        notes.push(`Tidak bisa membaca ${FR_FILES_AUTHORIZE} (izin file atau tidak ada).`);
    } else {
        filesAuthorizeUsernames = parseFilesAuthorizePasswordUsernames(filesContent);
        if (filesAuthorizeUsernames.length > 0) {
            const sample = filesAuthorizeUsernames.slice(0, 12).join(', ');
            const more = filesAuthorizeUsernames.length > 12 ? ' …' : '';
            warnings.push(
                `FreeRADIUS files/authorize memuat ${filesAuthorizeUsernames.length} user dengan atribut sandi (${sample}${more}). ` +
                    `Modul "files" berjalan bersama "sql" — user ini bisa login meski radcheck kosong. Kosongkan entri statis jika PPPoE hanya dari billing.`
            );
        }
    }

    const billingRad = await countRadcheckInBillingDb(billingDbPath);
    if (billingRad.exists && billingRad.rowCount > 0 && path.normalize(billingDbPath) !== appPath) {
        warnings.push(
            `data/billing.db memiliki ${billingRad.rowCount} baris di radcheck (duplikat/legasi). ` +
                `Sumber kebenaran autentikasi harus satu file yang sama dengan FR — biasanya data/radius.db.`
        );
    }

    return {
        appResolvedPath: appPath,
        appPathSource: resolved.source,
        freeRadiusSqlModule: FR_SQL_MODULE,
        freeRadiusSqlitePath: frSqlitePath,
        sqlPathMatchesApp: frSqlitePath == null ? null : frSqlitePath === appPath,
        filesAuthorizePath: FR_FILES_AUTHORIZE,
        filesAuthorizePasswordUserCount: filesAuthorizeUsernames.length,
        filesAuthorizeUsernamesSample: filesAuthorizeUsernames.slice(0, 25),
        billingDbRadcheckRowCount: billingRad.rowCount,
        warnings,
        notes,
        ok: warnings.length === 0
    };
}

module.exports = { getRadiusConsistencyReport, FR_SQL_MODULE, FR_FILES_AUTHORIZE };
