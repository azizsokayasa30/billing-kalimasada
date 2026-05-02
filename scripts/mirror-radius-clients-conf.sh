#!/usr/bin/env bash
# Salin clients.conf ke data/clients.conf.mirror agar proses Node/PM2 bisa membaca daftar NAS
# (tanpa akses root ke /etc/freeradius/). Jalankan di server setelah git pull atau mengubah FR.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="/etc/freeradius/3.0/clients.conf"
DEST="$ROOT/data/clients.conf.mirror"
mkdir -p "$ROOT/data"
sudo cp "$SRC" "$DEST"
sudo chown "$(whoami):$(whoami)" "$DEST"
chmod 640 "$DEST" 2>/dev/null || sudo chmod 640 "$DEST"
echo "OK: $DEST (restart PM2 billing bila perlu)"
