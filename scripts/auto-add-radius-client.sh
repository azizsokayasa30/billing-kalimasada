#!/bin/bash
#
# Script untuk auto-add client RADIUS berdasarkan IP yang mencoba connect
# Usage: sudo bash scripts/auto-add-radius-client.sh <IP_ADDRESS> [SECRET]
#

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
   echo "Script harus dijalankan dengan sudo" >&2
   exit 1
fi

IP_ADDRESS="${1:-}"
SECRET="${2:-testing123}"
CLIENTS_CONF="/etc/freeradius/3.0/clients.conf"

if [[ -z "$IP_ADDRESS" ]]; then
    echo "Usage: sudo bash scripts/auto-add-radius-client.sh <IP_ADDRESS> [SECRET]"
    echo "Example: sudo bash scripts/auto-add-radius-client.sh 192.168.20.11 testing123"
    exit 1
fi

# Check if client already exists
if grep -q "ipaddr = $IP_ADDRESS" "$CLIENTS_CONF" 2>/dev/null; then
    echo "Client dengan IP $IP_ADDRESS sudah ada di clients.conf"
    exit 0
fi

# Generate client name
CLIENT_NAME="mikrotik-$(echo $IP_ADDRESS | tr '.' '-')"

# Add client to clients.conf
cat >> "$CLIENTS_CONF" << EOF

# Client added automatically - IP: $IP_ADDRESS
client $CLIENT_NAME {
	ipaddr = $IP_ADDRESS
	secret = $SECRET
	nas_type = other
	require_message_authenticator = no
}
EOF

echo "Client $CLIENT_NAME dengan IP $IP_ADDRESS berhasil ditambahkan"

# Validate config
if freeradius -Cx >/dev/null 2>&1; then
    echo "Konfigurasi valid, restarting FreeRADIUS..."
    systemctl restart freeradius
    sleep 2
    if systemctl is-active --quiet freeradius; then
        echo "✅ FreeRADIUS berhasil direstart"
    else
        echo "⚠️  FreeRADIUS restart, cek status: systemctl status freeradius"
    fi
else
    echo "⚠️  Konfigurasi tidak valid, client ditambahkan tapi FreeRADIUS tidak direstart"
    echo "Cek konfigurasi: freeradius -Cx"
fi

