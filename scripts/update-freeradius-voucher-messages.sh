#!/usr/bin/env bash

set -euo pipefail

DEFAULT_CFG="/etc/freeradius/3.0/sites-enabled/default"
SQLCOUNTER_CFG="/etc/freeradius/3.0/mods-enabled/sqlcounter"
RADIUSD_CFG="/etc/freeradius/3.0/radiusd.conf"
BACKUP_DIR="/etc/freeradius/3.0/backup-voucher-expired"
POST_AUTH_BLOCK=$'\tPost-Auth-Type REJECT {\n\t\tforeach reply:Reply-Message {\n\t\t\tif ("%{Foreach-Variable-0}" =~ /maximum\\s+never\\s+usage\\s+time/i) {\n\t\t\t\tupdate reply {\n\t\t\t\t\tReply-Message !* ANY\n\t\t\t\t\tReply-Message := "Voucher expired: waktu pemakaian telah habis"\n\t\t\t\t}\n\t\t\t\tbreak\n\t\t\t}\n\n\t\t\tif ("%{Foreach-Variable-0}" =~ /password\\s+has\\s+expired|session\\s+has\\s+expired|account\\s+has\\s+expired/i) {\n\t\t\t\tupdate reply {\n\t\t\t\t\tReply-Message !* ANY\n\t\t\t\t\tReply-Message := "Voucher expired: masa berlaku telah habis"\n\t\t\t\t}\n\t\t\t\tbreak\n\t\t\t}\n\t\t}\n\t}\n'

NEW_NORESET_REPLY='"Voucher expired: waktu pemakaian telah habis"'
NEW_EXPIRE_REPLY='"Voucher expired: masa berlaku telah habis"'
REJECT_DELAY_LINE='    reject_delay = 0'

require_root() {
  if [[ ${EUID} -ne 0 ]]; then
    echo "This script must be run as root." >&2
    exit 1
  fi
}

backup_file() {
  local file=$1
  mkdir -p "$BACKUP_DIR"
  cp "$file" "$BACKUP_DIR/$(basename "$file").$(date +%Y%m%d%H%M%S)"
}

update_default_cfg() {
  local tmp
  tmp=$(mktemp)
  python3 - "$DEFAULT_CFG" "$POST_AUTH_BLOCK" <<'PY'
import sys
from pathlib import Path

default_path = Path(sys.argv[1])
post_auth_block = sys.argv[2]
text = default_path.read_text()
if 'Post-Auth-Type REJECT' in text:
    sys.exit(0)
marker = 'noresetcounter\n\texpire_on_login'
idx = text.find(marker)
if idx == -1:
    raise SystemExit('Marker for noresetcounter/expire_on_login not found in default config.')
insert_pos = idx + len(marker)
new_text = text[:insert_pos] + '\n\n' + post_auth_block + text[insert_pos:]
default_path.write_text(new_text)
PY
  rm -f "$tmp"
}

update_sqlcounter_cfg() {
  python3 - "$SQLCOUNTER_CFG" "$NEW_NORESET_REPLY" "$NEW_EXPIRE_REPLY" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
noreset_msg = sys.argv[2]
expire_msg = sys.argv[3]
text = path.read_text()

noreset_pattern = re.compile(r'(sqlcounter\s+noresetcounter\s*{[^}]*?reply-message\s*=\s*)(".*?")', re.S)
expire_pattern = re.compile(r'(sqlcounter\s+expire_on_login\s*{[^}]*?reply-message\s*=\s*)(".*?")', re.S)

new_text, count1 = noreset_pattern.subn(r'\1' + noreset_msg, text)
if count1 == 0:
    raise SystemExit('Failed to update reply-message for noresetcounter.')
new_text, count2 = expire_pattern.subn(r'\1' + expire_msg, new_text)
if count2 == 0:
    raise SystemExit('Failed to update reply-message for expire_on_login.')

path.write_text(new_text)
PY
}

update_radiusd_cfg() {
  python3 - "$RADIUSD_CFG" "$REJECT_DELAY_LINE" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
line = sys.argv[2]
text = path.read_text()
pattern = re.compile(r'^\s*reject_delay\s*=.*$', re.M)
if pattern.search(text):
    new_text = pattern.sub(line, text)
else:
    security_marker = 'security {'
    idx = text.find(security_marker)
    if idx == -1:
        raise SystemExit('security { block not found in radiusd.conf')
    insert_pos = idx + len(security_marker)
    new_text = text[:insert_pos] + '\n' + line + text[insert_pos:]
path.write_text(new_text)
PY
}

reload_radiusd() {
  freeradius -C >/dev/null
  systemctl restart freeradius
}

print_summary() {
  echo "FreeRADIUS configuration updated successfully." 
  echo "- Added Post-Auth-Type REJECT block to $DEFAULT_CFG"
  echo "- Updated reply-message strings in $SQLCOUNTER_CFG"
  echo "- Set reject_delay = 0 in $RADIUSD_CFG"
  echo "FreeRADIUS has been restarted."
}

main() {
  require_root
  for f in "$DEFAULT_CFG" "$SQLCOUNTER_CFG" "$RADIUSD_CFG"; do
    if [[ ! -f $f ]]; then
      echo "File not found: $f" >&2
      exit 1
    fi
    backup_file "$f"
  done

  update_default_cfg
  update_sqlcounter_cfg
  update_radiusd_cfg
  reload_radiusd
  print_summary
}

main "$@"
