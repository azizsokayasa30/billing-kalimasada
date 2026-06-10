#!/usr/bin/env bash
# Install & configure FreeRADIUS + MariaDB for Kalimasada SaaS multi-tenant billing.
# Jalankan sebagai root:
#   sudo bash scripts/install-freeradius-multi-tenant.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRED_FILE="/root/.freeradius_credentials"
RADIUS_PW="${RADIUS_MYSQL_PASSWORD:-oynFhZz8yD9zZ9jQF3CIdwi1d}"
BILLING_PW="${BILLING_MYSQL_PASSWORD:-oynFhZz8yD9zZ9jQF3CIdwi1d}"
FR_SQL="/etc/freeradius/3.0/mods-enabled/sql"
FR_QUERIES="/etc/freeradius/3.0/mods-config/sql/main/mysql/queries.conf"
SQLITE_DB="$ROOT/data/radius.db"

[[ ${EUID} -eq 0 ]] || { echo "sudo bash $0"; exit 1; }

echo "=== [1/8] Install packages ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq mariadb-server freeradius freeradius-mysql freeradius-utils sqlite3

echo "=== [2/8] Start MariaDB ==="
systemctl enable mariadb
systemctl start mariadb

echo "=== [3/8] Create radius database & users ==="
mysql -e "CREATE DATABASE IF NOT EXISTS radius CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'radius'@'localhost' IDENTIFIED BY '${RADIUS_PW}';"
mysql -e "CREATE USER IF NOT EXISTS 'billing'@'localhost' IDENTIFIED BY '${BILLING_PW}';"
mysql -e "GRANT ALL PRIVILEGES ON radius.* TO 'radius'@'localhost';"
mysql -e "GRANT ALL PRIVILEGES ON radius.* TO 'billing'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

if [[ -f /etc/freeradius/3.0/mods-config/sql/main/mysql/schema.sql ]]; then
  mysql radius < /etc/freeradius/3.0/mods-config/sql/main/mysql/schema.sql 2>/dev/null || true
fi

echo "=== [4/8] Add tenant_id columns (multi-tenant) ==="
mysql radius < "$ROOT/migrations/add_tenant_id_radius_mysql.sql"

echo "=== [5/8] Deploy FreeRADIUS SQL module + multi-tenant queries ==="
mkdir -p /etc/freeradius/3.0/backup-install-$(date +%Y%m%d%H%M%S)
cp -a "$FR_SQL" "/etc/freeradius/3.0/backup-install-$(date +%Y%m%d%H%M%S)/sql.bak" 2>/dev/null || true
cp -a "$FR_QUERIES" "/etc/freeradius/3.0/backup-install-$(date +%Y%m%d%H%M%S)/queries.bak" 2>/dev/null || true

cp "$ROOT/deploy/freeradius-mods-sql-mysql.conf" "$FR_SQL"
bash "$ROOT/scripts/patch-freeradius-queries-multi-tenant.sh"
chown freerad:freerad "$FR_SQL"
chmod 640 "$FR_SQL"

echo "=== [6/8] Patch sites (post-auth/accounting) + optimize ==="
bash "$ROOT/scripts/patch-freeradius-sites-auth-only.sh"
bash "$ROOT/scripts/optimize-freeradius-mass-auth.sh"

echo "=== [7/8] Import data dari SQLite (tenant_id=1 untuk data legacy) ==="
if [[ -f $SQLITE_DB ]]; then
  export SQLITE_DB RADIUS_PW
  python3 <<'PY'
import os, sqlite3, subprocess

sqlite_path = os.environ["SQLITE_DB"]
radius_pw = os.environ["RADIUS_PW"]

def sqlite_rows(table, cols):
    try:
        conn = sqlite3.connect(sqlite_path)
        cur = conn.execute(f"SELECT {','.join(cols)} FROM {table}")
        rows = cur.fetchall()
        conn.close()
        return rows
    except Exception:
        return []

def mysql_run(sql):
    subprocess.run(
        ["mysql", "-u", "radius", f"-p{radius_pw}", "radius", "-e", sql],
        check=True,
        capture_output=True,
    )

tables = [
    ("radcheck", ["username", "attribute", "op", "value"], "tenant_id"),
    ("radreply", ["username", "attribute", "op", "value"], "tenant_id"),
    ("radusergroup", ["username", "groupname", "priority"], "tenant_id"),
    ("radgroupcheck", ["groupname", "attribute", "op", "value"], "tenant_id"),
    ("radgroupreply", ["groupname", "attribute", "op", "value"], "tenant_id"),
    ("nas", ["nasname", "shortname", "type", "ports", "secret", "server", "community", "description"], "tenant_id"),
]

for table, cols, tid_col in tables:
    rows = sqlite_rows(table, cols)
    mysql_run(f"DELETE FROM {table};")
    if not rows:
        print(f"  {table}: 0 rows")
        continue
    insert_cols = cols + [tid_col]
    batch = []
    for row in rows:
        vals = []
        for v in row:
            if v is None:
                vals.append("NULL")
            else:
                vals.append("'" + str(v).replace("\\", "\\\\").replace("'", "''") + "'")
        vals.append("1")  # legacy tenant_id
        batch.append(f"({','.join(vals)})")
    for i in range(0, len(batch), 150):
        chunk = batch[i : i + 150]
        q = f"INSERT INTO {table} ({','.join(insert_cols)}) VALUES {','.join(chunk)};"
        mysql_run(q)
    print(f"  {table}: {len(rows)} rows (tenant_id=1)")
PY
else
  echo "  Skip: $SQLITE_DB tidak ada"
fi

cat > "$CRED_FILE" <<EOF
# Kalimasada FreeRADIUS credentials — $(date -Iseconds)
RADIUS_MYSQL_USER="radius"
RADIUS_MYSQL_PASSWORD="${RADIUS_PW}"
BILLING_MYSQL_USER="billing"
BILLING_MYSQL_PASSWORD="${BILLING_PW}"
RADIUS_MYSQL_DATABASE="radius"
EOF
chmod 600 "$CRED_FILE"

echo "=== [8/8] Validate & start FreeRADIUS ==="
freeradius -Cx -lstdout
systemctl enable freeradius
systemctl restart freeradius
sleep 2
systemctl is-active freeradius

mysql -u radius -p"${RADIUS_PW}" -e \
  "SELECT COUNT(*) AS radcheck FROM radcheck; SELECT COUNT(*) AS nas FROM nas;" radius

echo ""
echo "Selesai. FreeRADIUS multi-tenant aktif."
echo "  Credentials: $CRED_FILE"
echo "  Test: radtest USER PASS 127.0.0.1 0 NAS_SECRET"
echo "  Health: cd $ROOT && npm run radius:health"
