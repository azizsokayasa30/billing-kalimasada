#!/bin/bash
#
# Script untuk memperbaiki password user 'radius' di MySQL
# Menggunakan root password dari file credentials

set -euo pipefail

CREDENTIALS_FILE="/root/.freeradius_credentials"
MYSQL_ROOT_PASSWORD=""
RADIUS_PASSWORD="oynFhZz8yD9zZ9jQF3CIdwi1d"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Fix RADIUS MySQL Password Script    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Read root password from credentials file
if [[ -f "$CREDENTIALS_FILE" ]]; then
    echo -e "${BLUE}[*] Membaca credentials dari ${CREDENTIALS_FILE}...${NC}"
    MYSQL_ROOT_PASSWORD=$(grep "MARIADB_ROOT_PASSWORD" "$CREDENTIALS_FILE" | cut -d'"' -f2)
    if [[ -z "$MYSQL_ROOT_PASSWORD" ]]; then
        echo -e "${YELLOW}[!] Root password tidak ditemukan di file credentials${NC}"
        read -rs -p "Masukkan password MySQL root: " MYSQL_ROOT_PASSWORD
        echo ""
    fi
else
    echo -e "${YELLOW}[!] File credentials tidak ditemukan${NC}"
    read -rs -p "Masukkan password MySQL root: " MYSQL_ROOT_PASSWORD
    echo ""
fi

# Test MySQL connection
echo -e "${BLUE}[*] Testing MySQL connection...${NC}"
if mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}[+] Koneksi MySQL berhasil${NC}"
else
    echo -e "${RED}[!] Gagal koneksi ke MySQL${NC}"
    exit 1
fi

# Check if user radius exists
echo -e "${BLUE}[*] Memeriksa user 'radius'...${NC}"
USER_EXISTS=$(mysql -u root -p"$MYSQL_ROOT_PASSWORD" -sN -e "SELECT COUNT(*) FROM mysql.user WHERE User='radius' AND Host='localhost';" 2>/dev/null || echo "0")

if [[ "$USER_EXISTS" -eq "0" ]]; then
    echo -e "${YELLOW}[!] User 'radius' tidak ditemukan, membuat user baru...${NC}"
    mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF
CREATE USER 'radius'@'localhost' IDENTIFIED BY '${RADIUS_PASSWORD}';
GRANT ALL PRIVILEGES ON radius.* TO 'radius'@'localhost';
FLUSH PRIVILEGES;
EOF
    echo -e "${GREEN}[+] User 'radius' berhasil dibuat${NC}"
else
    echo -e "${BLUE}[*] User 'radius' ditemukan, memperbarui password...${NC}"
    # Try different methods for different MySQL/MariaDB versions
    mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF 2>/dev/null || \
    mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF2
ALTER USER 'radius'@'localhost' IDENTIFIED BY '${RADIUS_PASSWORD}';
FLUSH PRIVILEGES;
EOF
SET PASSWORD FOR 'radius'@'localhost' = PASSWORD('${RADIUS_PASSWORD}');
FLUSH PRIVILEGES;
EOF2
    echo -e "${GREEN}[+] Password user 'radius' berhasil diperbarui${NC}"
fi

# Grant privileges
echo -e "${BLUE}[*] Memberikan privileges...${NC}"
mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF
GRANT ALL PRIVILEGES ON radius.* TO 'radius'@'localhost';
FLUSH PRIVILEGES;
EOF
echo -e "${GREEN}[+] Privileges berhasil diberikan${NC}"

# Test connection with new password
echo -e "${BLUE}[*] Testing koneksi dengan password baru...${NC}"
if mysql -u radius -p"$RADIUS_PASSWORD" -e "SELECT 'Connection successful' as status;" >/dev/null 2>&1; then
    echo -e "${GREEN}[+] ✅ Koneksi dengan password baru berhasil!${NC}"
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Password berhasil diperbaiki!      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Password user 'radius': ${RADIUS_PASSWORD}${NC}"
    echo ""
    echo -e "${YELLOW}[*] Restart FreeRADIUS untuk menerapkan perubahan...${NC}"
    systemctl restart freeradius
    sleep 2
    systemctl status freeradius --no-pager | head -10
else
    echo -e "${RED}[!] ❌ Koneksi dengan password baru masih gagal${NC}"
    echo -e "${YELLOW}[!] Mungkin perlu menggunakan metode lain${NC}"
    exit 1
fi

