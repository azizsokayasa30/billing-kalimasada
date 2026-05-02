/**
 * RESET CUSTOMER DATA SCRIPT
 * Membersihkan semua data pelanggan, invoice, pembayaran, tiket, dll
 * Tabel sistem (packages, routers, settings, technicians) TIDAK dihapus
 * 
 * Jalankan: node scripts/reset-customer-data.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, '../data/billing.db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function resetCustomerData() {
  console.log('\n' + '='.repeat(60));
  console.log('  ⚠️  RESET DATA PELANGGAN - CVL MEDIA BILLING SYSTEM');
  console.log('='.repeat(60));
  console.log('\nScript ini akan MENGHAPUS PERMANEN:');
  console.log('  ✗ Semua data pelanggan (customers)');
  console.log('  ✗ Semua invoice/tagihan');
  console.log('  ✗ Semua data pembayaran (payments)');
  console.log('  ✗ Semua tiket gangguan (trouble_reports)');
  console.log('  ✗ Semua cable routes pelanggan');
  console.log('  ✗ Semua collector payments & assignments');
  console.log('  ✗ Semua voucher revenue');
  console.log('  ✗ Semua installation jobs');
  console.log('\nData berikut TIDAK AKAN dihapus (aman):');
  console.log('  ✓ Paket internet (packages)');
  console.log('  ✓ Router/Mikrotik');
  console.log('  ✓ ODP/Kabel jaringan');
  console.log('  ✓ Teknisi & Kolektor');
  console.log('  ✓ Settings & Konfigurasi');
  console.log('\n' + '='.repeat(60));

  const answer = await question('\n❓ Ketik "HAPUS SEMUA" untuk konfirmasi (atau tekan Enter untuk batalkan): ');
  
  if (answer.trim() !== 'HAPUS SEMUA') {
    console.log('\n✅ Dibatalkan. Tidak ada data yang dihapus.');
    rl.close();
    return;
  }

  console.log('\n🔄 Memulai proses pembersihan database...\n');

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Gagal membuka database:', err.message);
      rl.close();
      return;
    }
    console.log('✅ Database terhubung:', dbPath);
  });

  // Daftar tabel yang akan dibersihkan (urutan penting karena foreign key)
  const tablesToClear = [
    // Dependensi terdalam dulu
    { table: 'collector_payments', label: 'Collector Payments' },
    { table: 'collector_assignments', label: 'Collector Assignments' },
    { table: 'voucher_revenue', label: 'Voucher Revenue' },
    { table: 'cable_routes', label: 'Cable Routes' },
    { table: 'trouble_reports', label: 'Tiket Gangguan' },
    { table: 'installation_jobs', label: 'Installation Jobs' },
    { table: 'invoices', label: 'Invoice/Tagihan' },
    { table: 'customers', label: 'Data Pelanggan' },
    { table: 'members', label: 'Anggota Hotspot' },
  ];

  db.serialize(() => {
    // Disable foreign keys sementara untuk kemudahan delete
    db.run('PRAGMA foreign_keys = OFF', (err) => {
      if (err) console.warn('⚠️ Warning PRAGMA:', err.message);
    });

    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('❌ Gagal memulai transaksi:', err.message);
        db.close();
        rl.close();
        return;
      }

      let completed = 0;
      let errors = 0;
      const total = tablesToClear.length;

      tablesToClear.forEach(({ table, label }) => {
        // Cek apakah tabel ada dulu
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table], (checkErr, row) => {
          if (checkErr || !row) {
            console.log(`  ⏭️  Tabel ${label} (${table}) tidak ada, dilewati`);
            completed++;
            if (completed === total) finalize();
            return;
          }

          db.run(`DELETE FROM ${table}`, function(err) {
            if (err) {
              console.error(`  ❌ Gagal hapus ${label}: ${err.message}`);
              errors++;
            } else {
              console.log(`  ✅ Berhasil hapus ${label}: ${this.changes} baris dihapus`);
            }
            completed++;
            if (completed === total) finalize();
          });
        });
      });

      function finalize() {
        if (errors > 0) {
          db.run('ROLLBACK', () => {
            console.log('\n❌ Ada error, semua perubahan dibatalkan (ROLLBACK)');
            cleanup();
          });
        } else {
          // Reset auto-increment sequences
          const resetSeqs = [
            'DELETE FROM sqlite_sequence WHERE name IN ("customers","invoices","trouble_reports","cable_routes","installation_jobs","collector_payments","collector_assignments","voucher_revenue","members")'
          ];

          db.run(resetSeqs[0], (seqErr) => {
            if (seqErr) {
              console.warn('\n⚠️ Warning reset sequence:', seqErr.message);
            } else {
              console.log('\n  ✅ Auto-increment counter direset');
            }

            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                console.error('\n❌ Gagal COMMIT:', commitErr.message);
                db.run('ROLLBACK', () => cleanup());
              } else {
                db.run('PRAGMA foreign_keys = ON');
                
                // VACUUM untuk bersihkan ruang kosong di file DB
                console.log('\n🔄 Menjalankan VACUUM untuk kompres database...');
                db.run('VACUUM', (vacuumErr) => {
                  if (vacuumErr) {
                    console.warn('⚠️ Warning VACUUM:', vacuumErr.message);
                  } else {
                    console.log('  ✅ VACUUM selesai - ukuran database dikompres');
                  }
                  
                  console.log('\n' + '='.repeat(60));
                  console.log('  🎉 PEMBERSIHAN DATABASE SELESAI!');
                  console.log('='.repeat(60));
                  console.log('\nSemua data pelanggan, invoice, dan transaksi telah dihapus.');
                  console.log('Sistem siap untuk pengisian data baru.\n');
                  cleanup();
                });
              }
            });
          });
        }
      }
    });
  });

  function cleanup() {
    db.close((err) => {
      if (err) console.error('Error closing DB:', err.message);
    });
    rl.close();
  }
}

resetCustomerData().catch(err => {
  console.error('Fatal error:', err);
  rl.close();
  process.exit(1);
});
