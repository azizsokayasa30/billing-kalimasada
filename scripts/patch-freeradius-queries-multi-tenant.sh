#!/usr/bin/env bash
# Patch FreeRADIUS MySQL queries.conf untuk isolasi multi-tenant via NAS → tenant_id.
set -euo pipefail

FR_QUERIES="/etc/freeradius/3.0/mods-config/sql/main/mysql/queries.conf"
MARKER='# kalimasada: multi-tenant'

[[ ${EUID} -eq 0 ]] || { echo "sudo bash $0"; exit 1; }
[[ -f $FR_QUERIES ]] || { echo "File tidak ada: $FR_QUERIES"; exit 1; }

if grep -q "$MARKER" "$FR_QUERIES" 2>/dev/null; then
  echo "Already patched"
  exit 0
fi

cp -a "$FR_QUERIES" "${FR_QUERIES}.bak-multi-tenant-$(date +%Y%m%d%H%M%S)"

python3 - "$FR_QUERIES" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()

TENANT = (
    "\tAND tenant_id = ( "
    "\t\tSELECT tenant_id FROM ${client_table} "
    "\t\tWHERE nasname = '%{NAS-IP-Address}' LIMIT 1 "
    "\t) \\\n"
)

replacements = [
    (
        r"(authorize_check_query = \"\\\n\tSELECT id, username, attribute, value, op \\\n\tFROM \$\{authcheck_table\} \\\n\tWHERE username = '%\{SQL-User-Name\}' \\\n)",
        r"\1" + TENANT,
    ),
    (
        r"(authorize_reply_query = \"\\\n\tSELECT id, username, attribute, value, op \\\n\tFROM \$\{authreply_table\} \\\n\tWHERE username = '%\{SQL-User-Name\}' \\\n)",
        r"\1" + TENANT,
    ),
    (
        r"(group_membership_query = \"\\\n\tSELECT groupname \\\n\tFROM \$\{usergroup_table\} \\\n\tWHERE username = '%\{SQL-User-Name\}' \\\n)",
        r"\1" + TENANT,
    ),
    (
        r"(authorize_group_check_query = \"\\\n\tSELECT id, groupname, attribute, \\\n\tValue, op \\\n\tFROM \$\{groupcheck_table\} \\\n\tWHERE groupname = '%\{\$\{group_attribute\}\}' \\\n)",
        r"\1" + TENANT,
    ),
    (
        r"(authorize_group_reply_query = \"\\\n\tSELECT id, groupname, attribute, \\\n\tvalue, op \\\n\tFROM \$\{groupreply_table\} \\\n\tWHERE groupname = '%\{\$\{group_attribute\}\}' \\\n)",
        r"\1" + TENANT,
    ),
    (
        r"(simul_count_query = \"\\\n\tSELECT COUNT\(\*\) \\\n\tFROM \$\{acct_table1\} \\\n\tWHERE username = '%\{SQL-User-Name\}' \\\n)",
        r"\1" + TENANT,
    ),
    (
        r"(simul_verify_query = \"\\\n\tSELECT \\\n\t\tradacctid, acctsessionid, username, nasipaddress, nasportid, framedipaddress, \\\n\t\tcallingstationid, framedprotocol \\\n\tFROM \$\{acct_table1\} \\\n\tWHERE username = '%\{SQL-User-Name\}' \\\n)",
        r"\1" + TENANT,
    ),
]

for pattern, repl in replacements:
    new_text, n = re.subn(pattern, repl, text, count=1)
    if n:
        print(f"  patched: {pattern[:40]}...")
        text = new_text
    else:
        print(f"  WARN: pattern not matched")

text = '# kalimasada: multi-tenant queries — isolasi via NAS tenant_id\n' + text
path.write_text(text)
print(f'OK: {path}')
PY

chown freerad:freerad "$FR_QUERIES"
chmod 640 "$FR_QUERIES"
