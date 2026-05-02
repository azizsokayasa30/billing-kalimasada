#!/usr/bin/env node
/**
 * Hapus satu username dari semua tabel RADIUS SQLite yang relevan di:
 *   - file DB yang sama dengan aplikasi/FreeRADIUS (resolveRadiusSqliteDbPath)
 *   - data/billing.db (jika ada tabel rad* — salinan lama / salah konfigurasi FR)
 *
 * Opsional: kosongkan pppoe_username di customers (billing) agar sync tidak menulis ulang user ke radius.
 *
 * Usage:
 *   node scripts/purge-radius-user.js falisa --yes
 *   node scripts/purge-radius-user.js falisa --yes --clear-customer-pppoe
 */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const ROOT = path.join(__dirname, '..');
const BILLING_DB = path.join(ROOT, 'data', 'billing.db');

const RAD_TABLES_USER = [
    ['radacct', 'username'],
    ['radpostauth', 'username'],
    ['radusergroup', 'username'],
    ['radcheck', 'username'],
    ['radreply', 'username']
];

function openDb(p) {
    return new sqlite3.Database(p);
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
}

async function tableExists(db, name) {
    const row = await get(
        db,
        `SELECT 1 AS o FROM sqlite_master WHERE type='table' AND name=?`,
        [name]
    );
    return !!row;
}

async function purgeUserFromDb(dbPath, username) {
    const db = openDb(dbPath);
    db.configure('busyTimeout', 8000);
    const out = { path: dbPath, tables: {} };
    try {
        await run(db, 'BEGIN IMMEDIATE');
        for (const [tbl, col] of RAD_TABLES_USER) {
            if (await tableExists(db, tbl)) {
                const n = await run(db, `DELETE FROM "${tbl}" WHERE "${col}" = ?`, [username]);
                if (n > 0) out.tables[tbl] = n;
            }
        }
        await run(db, 'COMMIT');
    } catch (e) {
        await run(db, 'ROLLBACK').catch(() => {});
        throw e;
    } finally {
        db.close();
    }
    return out;
}

async function clearCustomerPppoe(username) {
    const fs = require('fs');
    if (!fs.existsSync(BILLING_DB)) return { skipped: true };
    const db = openDb(BILLING_DB);
    db.configure('busyTimeout', 8000);
    try {
        const n = await run(
            db,
            `UPDATE customers SET pppoe_username = NULL, pppoe_profile = NULL
             WHERE LOWER(TRIM(pppoe_username)) = LOWER(TRIM(?))`,
            [username]
        );
        return { customersUpdated: n };
    } finally {
        db.close();
    }
}

async function main() {
    const argv = process.argv.slice(2).filter((a) => a !== '--yes' && a !== '--clear-customer-pppoe');
    const yes = process.argv.includes('--yes');
    const clearPppoe = process.argv.includes('--clear-customer-pppoe');
    const username = (argv[0] || '').trim();

    if (!yes || !username) {
        console.log(`
Hapus user dari tabel RADIUS (radcheck, radusergroup, radreply, radacct, radpostauth)
pada DB yang dipakai aplikasi + membersihkan salinan di billing.db bila ada.

Wajib: username dan flag --yes

Opsi:
  --clear-customer-pppoe   Kosongkan customers.pppoe_username / pppoe_profile agar tidak ter-sync ulang.

Contoh:
  node scripts/purge-radius-user.js falisa --yes
  node scripts/purge-radius-user.js falisa --yes --clear-customer-pppoe
`);
        process.exit(1);
    }

    process.chdir(ROOT);
    const { resolveRadiusSqliteDbPath } = require('../config/radiusSQLite');
    const resolved = await resolveRadiusSqliteDbPath();
    const radiusPath = resolved.dbPath;

    console.log('Username:', username);
    console.log('RADIUS DB (resolved):', radiusPath, `[${resolved.source}]`);

    const r1 = await purgeUserFromDb(radiusPath, username);
    console.log(
        '\nRadius DB:',
        Object.keys(r1.tables).length ? JSON.stringify(r1.tables, null, 2) : '(tidak ada baris terhapus)'
    );

    const fs = require('fs');
    if (fs.existsSync(BILLING_DB) && path.resolve(radiusPath) !== path.resolve(BILLING_DB)) {
        const r2 = await purgeUserFromDb(BILLING_DB, username);
        if (Object.keys(r2.tables).length) {
            console.log('\nbilling.db (tabel rad*):', JSON.stringify(r2.tables, null, 0));
        } else {
            console.log('\nbilling.db: tidak ada baris rad* untuk user ini (atau tabel tidak ada).');
        }
    }

    if (clearPppoe) {
        const c = await clearCustomerPppoe(username);
        console.log('\nClear customer PPPoE:', c);
    }

    console.log('\nSelesai. Di server produksi: pastikan modul sql FreeRADIUS memakai file yang sama;');
    console.log('cek: grep -i filename /etc/freeradius/3.0/mods-enabled/sql');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
