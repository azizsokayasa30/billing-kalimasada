const path = require('path');

// cwd = folder repo (sama dengan lokasi ecosystem.config.cjs). app.js memuat .env dari sini.
//
// Dua proses PM2:
//   kalimasada-tenant          → billing tenant (WhatsApp, scheduler, isolir) — PORT default 4555
//   kalimasada-saas-management → portal /management saja (tanpa background jobs) — MANAGEMENT_PORT default 4556
//
// Restart terpisah:
//   pm2 restart kalimasada-tenant
//   pm2 restart kalimasada-saas-management
//   npm run pm2:restart:all
const tenantPort = Number(process.env.PORT) || 4555;
const managementPort = Number(process.env.MANAGEMENT_PORT) || 4556;

module.exports = {
  apps: [
    {
      name: 'kalimasada-tenant',
      script: path.join(__dirname, 'app.js'),
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      node_args: '--max-old-space-size=400',
      max_memory_restart: '512M',
      kill_timeout: 8000,
      env: {
        NODE_ENV: 'production',
        KALIMASADA_PM2_ROLE: 'tenant',
        PM2_APP_NAME: 'kalimasada-tenant',
        PORT: tenantPort,
      },
    },
    {
      name: 'kalimasada-saas-management',
      script: path.join(__dirname, 'app.js'),
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      node_args: '--max-old-space-size=256',
      max_memory_restart: '384M',
      kill_timeout: 8000,
      env: {
        NODE_ENV: 'production',
        KALIMASADA_PM2_ROLE: 'management',
        KALIMASADA_DISABLE_BACKGROUND_JOBS: '1',
        PM2_APP_NAME: 'kalimasada-saas-management',
        PORT: managementPort,
      },
    },
  ],
};
