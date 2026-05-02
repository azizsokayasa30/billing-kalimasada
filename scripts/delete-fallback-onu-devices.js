/**
 * Hapus baris ONU "simulasi" / fallback dari billing.db (bukan data GenieACS nyata).
 * Contoh: id fallback_1137, serial SIM1137, model Simulated ONU.
 *
 * Usage: node scripts/delete-fallback-onu-devices.js
 *         node scripts/delete-fallback-onu-devices.js --dry-run
 */
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const argvDb = (process.argv.find((a) => a.startsWith('--db=')) || '').slice(5);
const defaultDb = path.join(__dirname, '..', 'data', 'billing.db');
const dbPath = argvDb || process.env.BILLING_DB || defaultDb;
const dryRun = process.argv.includes('--dry-run');

if (!fs.existsSync(dbPath)) {
  console.error('File database tidak ditemukan:', dbPath);
  console.error('Contoh: node scripts/delete-fallback-onu-devices.js --db=billing.db');
  process.exit(1);
}

console.log('Database:', dbPath);

const db = new sqlite3.Database(dbPath, (openErr) => {
  if (openErr) {
    console.error('Gagal buka database:', openErr.message);
    process.exit(1);
  }
});

function run() {
  db.all(
    `SELECT id, name, serial_number, ip_address, mac_address
     FROM onu_devices
     WHERE id LIKE 'fallback_%'
        OR serial_number LIKE 'SIM%'
        OR name LIKE 'Simulated ONU%'`,
    [],
    (err, rows) => {
      if (err) {
        if (String(err.message).includes('no such table')) {
          console.log('Tabel onu_devices tidak ada — tidak ada yang dihapus.');
          db.close();
          return;
        }
        console.error(err);
        db.close();
        process.exit(1);
      }
      if (!rows || rows.length === 0) {
        console.log('Tidak ada baris ONU fallback/simulated yang cocok.');
        db.close();
        return;
      }
      console.log(`Ditemukan ${rows.length} baris:`);
      console.table(rows);
      if (dryRun) {
        console.log('[dry-run] Tidak menghapus. Jalankan tanpa --dry-run untuk DELETE.');
        db.close();
        return;
      }
      db.run(
        `DELETE FROM onu_devices
         WHERE id LIKE 'fallback_%'
            OR serial_number LIKE 'SIM%'
            OR name LIKE 'Simulated ONU%'`,
        function (delErr) {
          if (delErr) {
            console.error(delErr);
            db.close();
            process.exit(1);
          }
          console.log(`OK — terhapus ${this.changes} baris.`);
          db.close();
        }
      );
    }
  );
}

run();
