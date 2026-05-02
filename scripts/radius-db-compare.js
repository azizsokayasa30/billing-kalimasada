#!/usr/bin/env node
/**
 * Bandingkan file SQLite RADIUS yang dipakai aplikasi vs file lain (mis. milik FreeRADIUS).
 *
 * Usage:
 *   node scripts/radius-db-compare.js
 *   node scripts/radius-db-compare.js /var/lib/freeradius/radius.db
 *
 * Env opsional: RADIUS_SQLITE_PATH (sama seperti aplikasi)
 */
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const ROOT = path.join(__dirname, '..');

async function summarize(dbPath, label) {
    const out = { label, dbPath, exists: false };
    if (!fs.existsSync(dbPath)) {
        out.error = 'file tidak ada';
        return out;
    }
    out.exists = true;
    out.sizeBytes = fs.statSync(dbPath).size;
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    const all = (sql, params = []) =>
        new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
        });
    try {
        const tables = await all(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        );
        out.tables = tables.map((t) => t.name);
        const counts = {};
        for (const t of ['radcheck', 'radusergroup', 'radacct', 'radgroupreply', 'radreply', 'nas']) {
            if (out.tables.includes(t)) {
                const [{ n }] = await all(`SELECT COUNT(*) AS n FROM "${t}"`);
                counts[t] = n;
            }
        }
        out.rowCounts = counts;
        const pwdUsers = await all(`
            SELECT COUNT(DISTINCT username) AS n FROM radcheck
            WHERE LOWER(TRIM(attribute)) IN (
                'cleartext-password','user-password','crypt-password','md5-password',
                'sha-password','smd5-password','mikrotik-password'
            )
        `).catch(() => [{ n: null }]);
        out.distinctPasswordPolicyUsers = pwdUsers[0]?.n;
        const attrs = await all(
            `SELECT LOWER(TRIM(attribute)) AS a, COUNT(*) AS n FROM radcheck GROUP BY LOWER(TRIM(attribute)) ORDER BY n DESC`
        ).catch(() => []);
        out.radcheckByAttribute = attrs;
        const ntPrev = await all(
            `SELECT COUNT(*) AS n FROM radcheck WHERE LOWER(TRIM(attribute))='nt-password' AND IFNULL(value,'') LIKE 'PREVGROUP:%'`
        ).catch(() => [{ n: 0 }]);
        out.ntPasswordPrevgroupRows = ntPrev[0]?.n;
        const sample = await all(
            `SELECT username, attribute, substr(value,1,40) AS vpreview FROM radcheck ORDER BY username LIMIT 15`
        ).catch(() => []);
        out.radcheckSample = sample;
    } catch (e) {
        out.error = e.message;
    } finally {
        db.close();
    }
    return out;
}

function printBlock(o) {
    console.log('\n' + '='.repeat(72));
    console.log(o.label);
    console.log('='.repeat(72));
    console.log('Path   :', o.dbPath);
    if (!o.exists) {
        console.log('Status :', o.error || 'tidak ada');
        return;
    }
    console.log('Ukuran :', o.sizeBytes, 'bytes');
    if (o.error) {
        console.log('Error  :', o.error);
        return;
    }
    console.log('Baris (ringkas):', JSON.stringify(o.rowCounts, null, 0));
    console.log(
        'User berbeda di radcheck (atribut sandi standar FR / billing):',
        o.distinctPasswordPolicyUsers
    );
    console.log('Baris NT-Password berisi PREVGROUP: (metadata isolir):', o.ntPasswordPrevgroupRows);
    console.log('radcheck per atribut:', JSON.stringify(o.radcheckByAttribute, null, 0));
    console.log('Sampel radcheck (username, attribute, value awal):');
    for (const r of o.radcheckSample || []) {
        console.log('  ', r.username, '|', r.attribute, '|', r.vpreview);
    }
}

async function main() {
    process.chdir(ROOT);
    const { resolveRadiusSqliteDbPath } = require('../config/radiusSQLite');
    const appResolved = await resolveRadiusSqliteDbPath();
    const secondPath = process.argv[2] && String(process.argv[2]).trim();

    console.log('Aplikasi memakai:', JSON.stringify(appResolved, null, 2));

    const a = await summarize(appResolved.dbPath, 'A — Database yang dipilih aplikasi (resolved)');
    printBlock(a);

    if (secondPath) {
        const abs = path.resolve(secondPath);
        const b = await summarize(abs, 'B — File pembanding (argumen CLI / server FreeRADIUS)');
        printBlock(b);

        console.log('\n' + '='.repeat(72));
        console.log('Kesimpulan singkat');
        console.log('='.repeat(72));
        if (a.exists && b.exists && a.sizeBytes === b.sizeBytes && appResolved.dbPath === abs) {
            console.log('Path A dan B sama — satu file.');
        } else if (a.exists && b.exists) {
            console.log(
                '- Jika ukuran / radcheck.COUNT beda jauh, kemungkinan besar itu dua file berbeda (billing vs FR).'
            );
            console.log(
                '- distinctPasswordPolicyUsers A vs B: daftar PPPoE UI mengikuti A; user harus punya Cleartext-Password (dll.) di A.'
            );
        }
    } else {
        console.log('\nUntuk bandingkan dengan file FreeRADIUS di server yang sama, jalankan:');
        console.log('  node scripts/radius-db-compare.js /path/ke/sqlite/freeradius.db');
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
