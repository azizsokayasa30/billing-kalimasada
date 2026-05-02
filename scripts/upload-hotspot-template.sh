#!/usr/bin/env bash
# Script untuk upload template hotspot ke Mikrotik
# Template ini akan menampilkan Reply-Message dari FreeRADIUS

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
TEMPLATE_FILE="${1:-docs/templates/hotspot-login-template.html}"
MIKROTIK_IP="${MIKROTIK_IP:-}"
MIKROTIK_USER="${MIKROTIK_USER:-admin}"
MIKROTIK_PASSWORD="${MIKROTIK_PASSWORD:-}"

echo -e "${GREEN}📤 Upload Hotspot Template ke Mikrotik${NC}"
echo ""

# Check if template file exists
if [[ ! -f "$TEMPLATE_FILE" ]]; then
    echo -e "${RED}[ERROR] Template file tidak ditemukan: $TEMPLATE_FILE${NC}"
    exit 1
fi

# Check if required tools are available
if ! command -v scp &> /dev/null; then
    echo -e "${YELLOW}[WARN] SCP tidak ditemukan. Gunakan Winbox untuk upload manual.${NC}"
    echo ""
    echo "Langkah manual:"
    echo "1. Buka Winbox > Files"
    echo "2. Masuk ke folder hotspot"
    echo "3. Upload file: $TEMPLATE_FILE"
    echo "4. Rename menjadi: login.html"
    exit 0
fi

# Get Mikrotik IP if not provided
if [[ -z "$MIKROTIK_IP" ]]; then
    read -p "Masukkan IP Mikrotik: " MIKROTIK_IP
fi

# Get password if not provided
if [[ -z "$MIKROTIK_PASSWORD" ]]; then
    read -sp "Masukkan password Mikrotik: " MIKROTIK_PASSWORD
    echo ""
fi

# Upload template
echo -e "${GREEN}[*] Uploading template ke Mikrotik...${NC}"
scp "$TEMPLATE_FILE" "${MIKROTIK_USER}@${MIKROTIK_IP}:/hotspot/login.html" <<EOF
$MIKROTIK_PASSWORD
EOF

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}[+] Template berhasil diupload!${NC}"
    echo ""
    echo "Template sudah diupload ke: /hotspot/login.html"
    echo ""
    echo "Selanjutnya:"
    echo "1. Pastikan hotspot profile menggunakan html-directory=hotspot"
    echo "2. Test login dengan voucher expired"
    echo "3. Pastikan pesan 'Durasi Voucher Sudah Habis' muncul"
else
    echo -e "${RED}[ERROR] Gagal upload template${NC}"
    exit 1
fi

