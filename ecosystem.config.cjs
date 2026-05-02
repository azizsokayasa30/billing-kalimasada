const path = require('path');

// cwd = folder repo (sama dengan lokasi ecosystem.config.cjs). app.js memuat .env dari sini.
// Path SQLite RADIUS: isi RADIUS_SQLITE_PATH di .env (path penuh sama file modul sql FreeRADIUS),
// atau path absolut / data/... di Pengaturan RADIUS — lihat .env.example.
module.exports = {
  apps: [
    {
      name: 'billing-kalimasada',
      script: path.join(__dirname, 'app.js'),
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PM2_APP_NAME: 'billing-kalimasada'
      }
    }
  ]
};
