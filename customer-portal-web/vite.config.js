import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Target billing untuk proxy /api saat `npm run dev` — otomatis dari .env akar repo jika memungkinkan */
function resolveProxyTarget(env) {
  const explicit = (env.VITE_PROXY_TARGET || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const base = (env.PUBLIC_APP_BASE_URL || env.PUBLIC_API_BASE_URL || '').trim();
  if (base) return base.replace(/\/$/, '');

  const scheme = (env.PUBLIC_APP_SCHEME || 'http').trim();
  const host = (env.PUBLIC_APP_HOST || '').trim();
  const port = (env.PUBLIC_APP_PORT || env.PORT || '').trim();
  if (host && port) return `${scheme}://${host}:${port}`.replace(/\/$/, '');
  if (host) return `${scheme}://${host}`.replace(/\/$/, '');

  const localPort = (env.PORT || '4555').trim();
  return `http://127.0.0.1:${localPort}`;
}

function devProxyLogPlugin(proxyTarget) {
  return {
    name: 'customer-portal-dev-proxy-log',
    configureServer() {
      // eslint-disable-next-line no-console
      console.log(
        '\n[customer-portal] Dua port saat dev (ini normal):\n' +
          '  • Portal React (Vite)     → Anda buka di browser: http://localhost:5173/customer-app/\n' +
          '  • Backend billing (Express) → API diproxy ke: ' +
          proxyTarget +
          '\n' +
          '  (Kalau backend Anda :3003, pastikan baris log di atas berakhir :3003 — set PORT=3003 atau VITE_PROXY_TARGET di .env akar repo.)\n' +
          '\n[customer-portal] Ubah target proxy: VITE_PROXY_TARGET atau PUBLIC_APP_BASE_URL / PORT di internet-express/.env\n'
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const envDirPortal = __dirname;
  const envDirRepo = path.resolve(__dirname, '..');
  /** Portal dulu, lalu akar repo — nilai di .env repo menimpa (PORT, PUBLIC_APP_*, VITE_PROXY_TARGET). */
  const env = {
    ...loadEnv(mode, envDirPortal, ''),
    ...loadEnv(mode, envDirRepo, ''),
  };
  const proxyTarget = resolveProxyTarget(env);

  return {
    plugins: [react(), devProxyLogPlugin(proxyTarget)],
    base: '/customer-app/',
    build: {
      outDir: '../public/customer-app',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      strictPort: false,
      host: true,
      /** Buka langsung ke SPA (basename Router = /customer-app/). */
      open: '/customer-app/',
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port: 4173,
      host: true,
      open: '/customer-app/',
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
