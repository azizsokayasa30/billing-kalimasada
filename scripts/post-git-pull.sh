#!/usr/bin/env bash
# Jalankan setelah git pull (merge) di server billing + FreeRADIUS.
# Otomatis: hook .githooks/post-merge, atau manual: npm run postpull
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 0

echo "[post-git-pull] direktori: $ROOT"

if ! command -v npm >/dev/null 2>&1; then
  echo "[post-git-pull] npm tidak ditemukan, selesai."
  exit 0
fi

echo "[post-git-pull] npm install..."
npm install --no-audit --no-fund || echo "[post-git-pull] peringatan: npm install exit non-zero"

echo "[post-git-pull] npm run radius:check..."
npm run radius:check || true

if [ -n "${SKIP_RADIUS_MIRROR:-}" ]; then
  echo "[post-git-pull] SKIP_RADIUS_MIRROR diset — lewati salinan clients.conf."
elif [ -f /etc/freeradius/3.0/clients.conf ]; then
  echo "[post-git-pull] npm run radius:mirror-clients..."
  npm run radius:mirror-clients || echo "[post-git-pull] mirror gagal (perlu sudo?). Jalankan: npm run radius:mirror-clients"
else
  echo "[post-git-pull] FreeRADIUS clients.conf tidak ada di /etc (lingkungan dev?) — lewati mirror."
fi

echo "[post-git-pull] selesai. Restart PM2 bila ada perubahan kode: npm run pm2:restart"
