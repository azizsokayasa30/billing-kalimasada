#!/usr/bin/env bash
#
# Script untuk memberikan permission ALTER TABLE ke user billing
# untuk tabel radius.hotspot_profiles
#
# Usage:
#   sudo bash scripts/grant_alter_permission.sh
#
# Atau dengan custom values:
#   export MYSQL_ROOT_PASSWORD=your_root_password
#   export BILLING_DB_USER=billing
#   export BILLING_DB_HOST=localhost
#   export RADIUS_DB_NAME=radius
#   sudo -E bash scripts/grant_alter_permission.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-}"
BILLING_DB_USER="${BILLING_DB_USER:-billing}"
BILLING_DB_HOST="${BILLING_DB_HOST:-localhost}"
RADIUS_DB_NAME="${RADIUS_DB_NAME:-radius}"

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Grant ALTER Permission Script      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[!] Error: Script harus dijalankan dengan sudo${NC}"
   echo -e "${YELLOW}[!] Usage: sudo bash scripts/grant_alter_permission.sh${NC}"
   exit 1
fi

# Function to get MySQL root password
get_mysql_root_password() {
    if [[ -z "$MYSQL_ROOT_PASSWORD" ]]; then
        read -rs -p "Masukkan password MySQL root: " MYSQL_ROOT_PASSWORD
        echo ""
        if [[ -z "$MYSQL_ROOT_PASSWORD" ]]; then
            echo -e "${YELLOW}[!] Mencoba login tanpa password...${NC}"
        fi
    fi
}

# Function to test MySQL connection
test_mysql_connection() {
    echo -e "${BLUE}[*] Menguji koneksi MySQL...${NC}"
    
    if [[ -z "$MYSQL_ROOT_PASSWORD" ]]; then
        mysql -u root -e "SELECT 1;" > /dev/null 2>&1
    else
        mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1
    fi
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}[+] Koneksi MySQL berhasil${NC}"
        return 0
    else
        echo -e "${RED}[!] Gagal koneksi ke MySQL${NC}"
        return 1
    fi
}

# Function to check if user exists
check_user_exists() {
    echo -e "${BLUE}[*] Memeriksa apakah user '${BILLING_DB_USER}'@'${BILLING_DB_HOST}' ada...${NC}"
    
    local user_exists
    if [[ -z "$MYSQL_ROOT_PASSWORD" ]]; then
        user_exists=$(mysql -u root -sN -e "SELECT COUNT(*) FROM mysql.user WHERE User='${BILLING_DB_USER}' AND Host='${BILLING_DB_HOST}';" 2>/dev/null || echo "0")
    else
        user_exists=$(mysql -u root -p"$MYSQL_ROOT_PASSWORD" -sN -e "SELECT COUNT(*) FROM mysql.user WHERE User='${BILLING_DB_USER}' AND Host='${BILLING_DB_HOST}';" 2>/dev/null || echo "0")
    fi
    
    if [[ "$user_exists" -eq 0 ]]; then
        echo -e "${RED}[!] User '${BILLING_DB_USER}'@'${BILLING_DB_HOST}' tidak ditemukan${NC}"
        echo -e "${YELLOW}[!] Apakah Anda ingin membuat user baru? (y/N)${NC}"
        read -r -n 1 -p "" response
        echo ""
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}[!] Script dibatalkan${NC}"
            exit 1
        fi
        return 1
    else
        echo -e "${GREEN}[+] User '${BILLING_DB_USER}'@'${BILLING_DB_HOST}' ditemukan${NC}"
        return 0
    fi
}

# Function to check if database exists
check_database_exists() {
    echo -e "${BLUE}[*] Memeriksa apakah database '${RADIUS_DB_NAME}' ada...${NC}"
    
    local db_exists
    if [[ -z "$MYSQL_ROOT_PASSWORD" ]]; then
        db_exists=$(mysql -u root -sN -e "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${RADIUS_DB_NAME}';" 2>/dev/null || echo "0")
    else
        db_exists=$(mysql -u root -p"$MYSQL_ROOT_PASSWORD" -sN -e "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${RADIUS_DB_NAME}';" 2>/dev/null || echo "0")
    fi
    
    if [[ "$db_exists" -eq 0 ]]; then
        echo -e "${RED}[!] Database '${RADIUS_DB_NAME}' tidak ditemukan${NC}"
        exit 1
    else
        echo -e "${GREEN}[+] Database '${RADIUS_DB_NAME}' ditemukan${NC}"
    fi
}

# Function to grant ALTER permission
grant_alter_permission() {
    echo -e "${BLUE}[*] Memberikan permission ALTER TABLE...${NC}"
    
    local sql_commands=(
        "GRANT ALTER ON ${RADIUS_DB_NAME}.hotspot_profiles TO '${BILLING_DB_USER}'@'${BILLING_DB_HOST}';"
        "FLUSH PRIVILEGES;"
    )
    
    for sql in "${sql_commands[@]}"; do
        echo -e "${BLUE}[*] Menjalankan: ${sql}${NC}"
        
        if [[ -z "$MYSQL_ROOT_PASSWORD" ]]; then
            mysql -u root -e "$sql" 2>&1
        else
            mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "$sql" 2>&1
        fi
        
        if [[ $? -eq 0 ]]; then
            echo -e "${GREEN}[+] Berhasil${NC}"
        else
            echo -e "${RED}[!] Gagal${NC}"
            return 1
        fi
    done
    
    return 0
}

# Function to verify permission
verify_permission() {
    echo -e "${BLUE}[*] Memverifikasi permission...${NC}"
    
    local grants
    if [[ -z "$MYSQL_ROOT_PASSWORD" ]]; then
        grants=$(mysql -u root -sN -e "SHOW GRANTS FOR '${BILLING_DB_USER}'@'${BILLING_DB_HOST}';" 2>/dev/null || echo "")
    else
        grants=$(mysql -u root -p"$MYSQL_ROOT_PASSWORD" -sN -e "SHOW GRANTS FOR '${BILLING_DB_USER}'@'${BILLING_DB_HOST}';" 2>/dev/null || echo "")
    fi
    
    if echo "$grants" | grep -q "ALTER.*${RADIUS_DB_NAME}.*hotspot_profiles"; then
        echo -e "${GREEN}[+] Permission ALTER TABLE berhasil diberikan${NC}"
        echo ""
        echo -e "${GREEN}Grants untuk user '${BILLING_DB_USER}'@'${BILLING_DB_HOST}':${NC}"
        echo "$grants" | grep -i "ALTER\|GRANT" || echo "$grants"
        return 0
    else
        echo -e "${YELLOW}[!] Permission mungkin belum terlihat, tetapi sudah diberikan${NC}"
        echo -e "${YELLOW}[!] Coba restart aplikasi dan periksa log${NC}"
        return 0
    fi
}

# Main execution
main() {
    echo -e "${BLUE}[*] Konfigurasi:${NC}"
    echo -e "   User: ${BILLING_DB_USER}@${BILLING_DB_HOST}"
    echo -e "   Database: ${RADIUS_DB_NAME}"
    echo ""
    
    # Get MySQL root password
    get_mysql_root_password
    
    # Test connection
    if ! test_mysql_connection; then
        echo -e "${RED}[!] Gagal koneksi ke MySQL. Pastikan MySQL sudah berjalan dan password benar.${NC}"
        exit 1
    fi
    
    # Check database exists
    check_database_exists
    
    # Check user exists
    if ! check_user_exists; then
        echo -e "${YELLOW}[!] User tidak ditemukan. Silakan buat user terlebih dahulu.${NC}"
        exit 1
    fi
    
    # Grant permission
    if grant_alter_permission; then
        echo -e "${GREEN}[+] Permission berhasil diberikan${NC}"
    else
        echo -e "${RED}[!] Gagal memberikan permission${NC}"
        exit 1
    fi
    
    # Verify
    verify_permission
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Script Completed Successfully!      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Restart aplikasi:"
    echo "     pm2 restart cvlmedia"
    echo ""
    echo "  2. Periksa log untuk memastikan warning tidak muncul lagi:"
    echo "     pm2 logs cvlmedia | grep -i 'hotspot_profiles'"
    echo ""
}

# Run main function
main

