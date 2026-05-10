#!/usr/bin/env node
/**
 * Perbaiki baris radusergroup yang memakai slug paket (mis. paket_10mbps) agar memakai
 * grup profil PPPoE di RADIUS (mis. profile-10mbps), berdasarkan billing + resolve RADIUS.
 *
 *   node scripts/fix-radusergroup-paket-slugs.js --dry-run
 *   node scripts/fix-radusergroup-paket-slugs.js
 *   node scripts/fix-radusergroup-paket-slugs.js --fix-billing
 *
 * Opsi --fix-billing: jika customers.pppoe_profile masih berbentuk paket_*, update ke grup yang di-resolve.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { getRadiusConnection, resolvePppoeProfileHintToRadiusGroup } = require('../config/mikrotik');

const DRY_RUN = process.argv.includes('--dry-run');
const FIX_BILLING = process.argv.includes('--fix-billing');
const billingDbPath = path.join(__dirname, '../data/billing.db');

const PAKET_RE = /^paket[_-](\d+)mbps$/i;

function looksLikePaketSlug(g) {
    if (!g || typeof g !== 'string') return false;
    return PAKET_RE.test(g.trim().toLowerCase().replace(/\s+/g, '_'));
}

async function getMisassignedRows(conn) {
    const [rows] = await conn.execute(
        `SELECT username, groupname FROM radusergroup WHERE LOWER(TRIM(groupname)) LIKE 'paket%'`
    );
    return Array.isArray(rows) ? rows : [];
}

function lookupBillingProfile(db, pppoeUsername) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT c.pppoe_username, c.username, c.pppoe_profile AS c_prof, p.pppoe_profile AS p_prof
             FROM customers c
             LEFT JOIN packages p ON c.package_id = p.id
             WHERE TRIM(c.pppoe_username) = TRIM(?) OR TRIM(c.username) = TRIM(?)
             LIMIT 1`,
            [pppoeUsername, pppoeUsername],
            (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            }
        );
    });
}

async function main() {
    const billingDb = new sqlite3.Database(billingDbPath);
    let radiusConn;
    try {
        radiusConn = await getRadiusConnection();
        const badRows = await getMisassignedRows(radiusConn);
        console.log(`Found ${badRows.length} radusergroup row(s) with groupname starting with "paket".`);
        let updated = 0;
        let skipped = 0;

        for (const row of badRows) {
            const un = String(row.username || '').trim();
            const gn = String(row.groupname || '').trim();
            if (!un) {
                skipped++;
                continue;
            }

            const bill = await lookupBillingProfile(billingDb, un);
            const hint =
                (bill && bill.c_prof && String(bill.c_prof).trim()) ||
                (bill && bill.p_prof && String(bill.p_prof).trim()) ||
                gn;

            const resolved = await resolvePppoeProfileHintToRadiusGroup(radiusConn, hint);
            if (!resolved) {
                console.log(`[SKIP] ${un}: tidak bisa resolve (hint=${hint})`);
                skipped++;
                continue;
            }
            if (resolved === gn && looksLikePaketSlug(gn)) {
                console.log(`[SKIP] ${un}: resolve sama dengan slug paket (${gn}) — pastikan profile-*mbps ada di radgroupreply`);
                skipped++;
                continue;
            }

            if (DRY_RUN) {
                console.log(`[DRY-RUN] ${un}: "${gn}" -> "${resolved}"`);
                updated++;
                continue;
            }

            await radiusConn.execute(
                'UPDATE radusergroup SET groupname = ? WHERE username = ? AND groupname = ?',
                [resolved, un, gn]
            );
            console.log(`[OK] ${un}: "${gn}" -> "${resolved}"`);
            updated++;

            if (FIX_BILLING && bill && bill.c_prof && looksLikePaketSlug(String(bill.c_prof))) {
                await new Promise((res, rej) => {
                    billingDb.run(
                        'UPDATE customers SET pppoe_profile = ? WHERE TRIM(pppoe_username) = TRIM(?)',
                        [resolved, un],
                        (err) => {
                            if (err) rej(err);
                            else res();
                        }
                    );
                });
                console.log(`       billing: customers.pppoe_profile diperbarui untuk ${un}`);
            }
        }

        console.log(`\nRingkasan: diperbarui=${updated}, dilewati=${skipped}, dry-run=${DRY_RUN}`);
    } finally {
        try {
            billingDb.close();
        } catch (_) {}
        if (radiusConn && typeof radiusConn.end === 'function') {
            try {
                await radiusConn.end();
            } catch (_) {}
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
