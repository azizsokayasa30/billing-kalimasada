#!/usr/bin/env bash
#set -euo pipefail
#
# Script ini menyiapkan fitur limit-uptime & validity hotspot pada server RADIUS lain.
# Jalankan setelah melakukan `git pull` pada repo aplikasi.
#
# Langkah yang dilakukan:
# 1. Menjalankan skrip SQL untuk memastikan tabel metadata hotspot sudah sesuai.
# 2. Menambahkan atribut `Expire-After` ke dictionary FreeRADIUS bila belum ada.
# 3. Memastikan blok `post-auth` pada `sites-enabled/default` dan `sites-enabled/inner-tunnel`
#    memuat `noresetcounter`, `expire_on_login`, dan `sqlcounter Max-All-Session`.
# 4. Merestart service FreeRADIUS.
#
# Catatan:
# - Script ini perlu dijalankan sebagai root (atau dengan sudo) karena memodifikasi file di /etc/freeradius.
# - Isi variabel MYSQL_USER/MYSQL_HOST/MYSQL_DB sebelum menjalankan jika tidak memakai nilai default.
# - Password MySQL akan diminta interaktif apabila MYSQL_PASSWORD tidak diset sebagai environment variable.

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "[ERROR] Jalankan script ini sebagai root (sudo)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FREERADIUS_DIR="/etc/freeradius/3.0"

if [[ ! -d "$FREERADIUS_DIR" ]]; then
  echo "[ERROR] Direktori FreeRADIUS tidak ditemukan di $FREERADIUS_DIR" >&2
  exit 1
fi

MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_DB="${MYSQL_DB:-radius}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-}"  # Atur via environment variable jika ingin non-interaktif

SQL_FILES=(
  "${PROJECT_ROOT}/setup_hotspot_profiles_table.sql"
  "${PROJECT_ROOT}/setup_hotspot_server_profiles_table.sql"
  "${PROJECT_ROOT}/grant_hotspot_server_profiles_permission.sql"
)

read -r -p "Jalankan skrip SQL untuk DB ${MYSQL_DB} dengan user ${MYSQL_USER}@${MYSQL_HOST}? [y/N]: " RUN_SQL
RUN_SQL=${RUN_SQL:-n}

if [[ "${RUN_SQL,,}" == "y" ]]; then
  if ! command -v mysql >/dev/null 2>&1; then
    echo "[ERROR] Perintah 'mysql' tidak ditemukan. Instal client MariaDB/MySQL terlebih dahulu." >&2
    exit 1
  fi

  if [[ -z "$MYSQL_PASSWORD" ]]; then
    read -rs -p "Masukkan password MySQL untuk ${MYSQL_USER}: " MYSQL_PASSWORD
    echo
  fi

  run_sql_file() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
      echo "[WARN] File SQL tidak ditemukan: $file" >&2
      return 0
    fi

    echo "[INFO] Menjalankan $(basename "$file")"
    mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DB" < "$file"
  }

  for sql_file in "${SQL_FILES[@]}"; do
    run_sql_file "$sql_file"
  done
else
  echo "[INFO] Lewati eksekusi SQL." 
fi

ensure_file_exists() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "[ERROR] File tidak ditemukan: $file" >&2
    exit 1
  fi
}

# Helper untuk backup satu kali per file
declare -A CREATED_BACKUP
backup_once() {
  local file="$1"
  ensure_file_exists "$file"
  if [[ -z "${CREATED_BACKUP[$file]:-}" ]]; then
    local backup="${file}.bak.$(date +%Y%m%d-%H%M%S)"
    cp "$file" "$backup"
    CREATED_BACKUP[$file]="1"
    echo "[INFO] Backup dibuat: $backup"
  fi
}

# Tambahkan atribut Expire-After ke dictionary
DICTIONARY_FILE="${FREERADIUS_DIR}/dictionary"
ensure_file_exists "$DICTIONARY_FILE"
if ! grep -q "ATTRIBUTE[[:space:]]\+Expire-After" "$DICTIONARY_FILE"; then
  backup_once "$DICTIONARY_FILE"
  echo "ATTRIBUTE    Expire-After           3001    string" >> "$DICTIONARY_FILE"
  echo "[INFO] Menambahkan atribut Expire-After ke dictionary."
else
  echo "[INFO] Atribut Expire-After sudah ada di dictionary."
fi

# Tambah helper untuk menyisipkan baris di dalam blok post-auth
add_post_auth_line() {
  local file="$1"
  local line="$2"
  ensure_file_exists "$file"
  if ! grep -q "^[[:space:]]*${line}$" "$file"; then
    backup_once "$file"
    sed -i "/post-auth {/a\\        ${line}" "$file"
    echo "[INFO] Menambahkan '${line}' ke $(basename "$file")"
  else
    echo "[INFO] '${line}' sudah ada di $(basename "$file")"
  fi
}

DEFAULT_FILE="${FREERADIUS_DIR}/sites-enabled/default"
INNER_TUNNEL_FILE="${FREERADIUS_DIR}/sites-enabled/inner-tunnel"

for target in "$DEFAULT_FILE" "$INNER_TUNNEL_FILE"; do
  add_post_auth_line "$target" "noresetcounter"
  add_post_auth_line "$target" "expire_on_login"
  add_post_auth_line "$target" "sqlcounter Max-All-Session"
done

# Validasi konfigurasi Freeradius
if command -v freeradius >/dev/null 2>&1; then
  echo "[INFO] Menjalankan freeradius -XC untuk validasi konfigurasi"
  freeradius -XC >/dev/null
else
  echo "[WARN] Perintah 'freeradius' tidak ditemukan, lewati validasi -XC."
fi

# Restart service FreeRADIUS
echo "[INFO] Merestart service FreeRADIUS"
if systemctl list-unit-files | grep -q "freeradius.service"; then
  systemctl restart freeradius
elif systemctl list-unit-files | grep -q "freeradiusd.service"; then
  systemctl restart freeradiusd
else
  echo "[WARN] Service FreeRADIUS tidak ditemukan di systemd. Restart manual diperlukan." >&2
fi

echo "[DONE] Setup limit-uptime & validity hotspot selesai."
