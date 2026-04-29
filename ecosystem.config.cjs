module.exports = {
  apps: [
    {
      name: 'billing-kalimasada',
      script: 'app.js',
      cwd: '/home/ajizs/internet-express',
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
