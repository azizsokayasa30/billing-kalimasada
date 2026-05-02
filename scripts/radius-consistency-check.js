#!/usr/bin/env node
/**
 * Cek konsistensi RADIUS vs billing setelah git pull / deploy.
 *
 *   npm run radius:check
 *   node scripts/radius-consistency-check.js
 *   node scripts/radius-consistency-check.js --strict   # exit 1 jika ada warning
 */
const path = require('path');

const ROOT = path.join(__dirname, '..');
process.chdir(ROOT);

try {
    require('dotenv').config({ path: path.join(ROOT, '.env') });
} catch (_) {
    /* optional */
}

const { getRadiusConsistencyReport } = require('../config/radiusConsistency');

async function main() {
    const strict = process.argv.includes('--strict');
    const r = await getRadiusConsistencyReport();

    console.log('=== RADIUS consistency (billing vs FreeRADIUS) ===\n');
    console.log('Path aplikasi (resolved):', r.appResolvedPath);
    console.log('Sumber path             :', r.appPathSource);
    console.log('Path SQLite di FR sql   :', r.freeRadiusSqlitePath || '(tidak terbaca / tidak ada)');
    console.log('Cocok dengan aplikasi   :', r.sqlPathMatchesApp == null ? 'n/a' : r.sqlPathMatchesApp);
    console.log('User di files/authorize :', r.filesAuthorizePasswordUserCount);
    if (r.filesAuthorizeUsernamesSample && r.filesAuthorizeUsernamesSample.length) {
        console.log('  sampel username       :', r.filesAuthorizeUsernamesSample.join(', '));
    }
    console.log('radcheck di billing.db  :', r.billingDbRadcheckRowCount ?? 'n/a');

    if (r.notes && r.notes.length) {
        console.log('\nCatatan:');
        r.notes.forEach((n) => console.log(' -', n));
    }
    if (r.warnings.length) {
        console.log('\n⚠ PERINGATAN:');
        r.warnings.forEach((w) => console.log(' -', w));
    } else {
        console.log('\n✓ Tidak ada peringatan konsistensi (path + files/authorize + billing radcheck).');
    }

    if (strict && r.warnings.length) process.exit(1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
