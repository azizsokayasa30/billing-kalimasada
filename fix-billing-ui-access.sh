#!/bin/bash

# Script untuk memperbaiki akses Billing UI dari network

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================== Memperbaiki Akses Billing UI ==================${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Script ini harus dijalankan dengan sudo${NC}"
    exit 1
fi

# Get local IP
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo -e "${GREEN}IP Server: $LOCAL_IP${NC}"

# Check current service status
echo -e "${YELLOW}1. Cek status service...${NC}"
if pm2 list | grep -q "cvlmedia.*online"; then
    echo -e "${GREEN}✓ cvlmedia: RUNNING${NC}"
    pm2 list | grep cvlmedia
else
    echo -e "${RED}✗ cvlmedia: NOT RUNNING${NC}"
    echo -e "${YELLOW}Mencoba start aplikasi...${NC}"
    cd /home/adit123/cvlmedia && pm2 start app.js --name cvlmedia || {
        echo -e "${RED}Gagal start aplikasi${NC}"
        exit 1
    }
    sleep 5
fi

# Check port listening
echo -e "${YELLOW}2. Cek port listening...${NC}"
PORT=$(cd /home/adit123/cvlmedia && node -e "const {getSetting} = require('./config/settingsManager'); console.log(getSetting('server_port', 3003));" 2>/dev/null || echo "3003")
echo -e "${BLUE}Port yang digunakan: $PORT${NC}"

if ss -tlnp | grep -q ":$PORT"; then
    echo -e "${GREEN}✓ Port $PORT: LISTENING${NC}"
    ss -tlnp | grep ":$PORT"
    
    # Check if listening on all interfaces
    if ss -tlnp | grep ":$PORT" | grep -q "0.0.0.0\|::"; then
        echo -e "${GREEN}✓ Port $PORT listen di semua interface (0.0.0.0)${NC}"
    else
        echo -e "${RED}✗ Port $PORT TIDAK listen di semua interface!${NC}"
        echo -e "${YELLOW}Ini adalah masalah utama - aplikasi hanya listen di localhost${NC}"
    fi
else
    echo -e "${RED}✗ Port $PORT: NOT LISTENING${NC}"
    exit 1
fi

# Check and configure firewall
echo -e "${YELLOW}3. Konfigurasi firewall...${NC}"

# Check UFW
if command -v ufw >/dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
        echo -e "${YELLOW}UFW aktif, menambahkan rule untuk port $PORT...${NC}"
        ufw allow $PORT/tcp comment 'Billing UI' 2>/dev/null || echo "Rule mungkin sudah ada"
        echo -e "${GREEN}✓ UFW rules ditambahkan${NC}"
        ufw status | grep $PORT
    else
        echo -e "${YELLOW}UFW tidak aktif${NC}"
    fi
else
    echo -e "${YELLOW}UFW tidak terinstall${NC}"
fi

# Check iptables
echo -e "${YELLOW}4. Cek iptables rules...${NC}"
if iptables -L INPUT -n | grep -q "$PORT"; then
    echo -e "${GREEN}✓ iptables sudah ada rule untuk port $PORT${NC}"
    iptables -L INPUT -n | grep $PORT
else
    echo -e "${YELLOW}Menambahkan iptables rules...${NC}"
    # Allow port
    iptables -I INPUT -p tcp --dport $PORT -j ACCEPT 2>/dev/null && echo -e "${GREEN}✓ iptables rule ditambahkan${NC}" || echo -e "${YELLOW}⚠ Tidak bisa menambahkan iptables rule (mungkin perlu konfigurasi manual)${NC}"
fi

# Ensure app listens on all interfaces
echo -e "${YELLOW}5. Memastikan aplikasi listen di semua interface...${NC}"

# Check app.js to see if it binds to 0.0.0.0
cd /home/adit123/cvlmedia
if grep -q "app.listen($PORT" app.js || grep -q "app.listen($PORT, '0.0.0.0'" app.js; then
    echo -e "${GREEN}✓ app.js sudah dikonfigurasi untuk listen di semua interface${NC}"
else
    echo -e "${YELLOW}⚠ app.js mungkin perlu dikonfigurasi untuk listen di 0.0.0.0${NC}"
    echo -e "${YELLOW}   Saat ini menggunakan: app.listen($PORT)${NC}"
    echo -e "${YELLOW}   Seharusnya: app.listen($PORT, '0.0.0.0')${NC}"
fi

# Restart service to apply changes
echo -e "${YELLOW}6. Restart service untuk menerapkan perubahan...${NC}"
cd /home/adit123/cvlmedia
pm2 restart cvlmedia
sleep 5

# Verify service is running
if pm2 list | grep -q "cvlmedia.*online"; then
    echo -e "${GREEN}✓ cvlmedia: RUNNING${NC}"
else
    echo -e "${RED}✗ cvlmedia: GAGAL START${NC}"
    pm2 logs cvlmedia --lines 20 --nostream
    exit 1
fi

# Test connection
echo -e "${YELLOW}7. Test koneksi...${NC}"
sleep 2
if curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT | grep -q "200\|301\|302"; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT)
    echo -e "${GREEN}✓ Localhost:$PORT dapat diakses (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ Localhost:$PORT tidak dapat diakses${NC}"
fi

if curl -s -o /dev/null -w "%{http_code}" http://$LOCAL_IP:$PORT | grep -q "200\|301\|302"; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$LOCAL_IP:$PORT)
    echo -e "${GREEN}✓ $LOCAL_IP:$PORT dapat diakses (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${YELLOW}⚠ $LOCAL_IP:$PORT mungkin tidak dapat diakses dari network${NC}"
    echo -e "${YELLOW}   Cek apakah aplikasi benar-benar listen di 0.0.0.0${NC}"
fi

# Check port binding
echo -e "${YELLOW}8. Cek port binding...${NC}"
ss -tlnp | grep ":$PORT"
echo ""

# Summary
echo -e "${BLUE}================== RINGKASAN ==================${NC}"
echo -e "${GREEN}IP Server: $LOCAL_IP${NC}"
echo -e "${GREEN}Billing UI URL: http://$LOCAL_IP:$PORT${NC}"
echo ""
echo -e "${YELLOW}Jika masih tidak bisa diakses dari browser:${NC}"
echo "1. Pastikan komputer client di network yang sama (192.168.1.x)"
echo "2. Cek firewall di router/network:"
echo "   - Pastikan port $PORT tidak diblokir"
echo "3. Test dari komputer lain:"
echo "   telnet $LOCAL_IP $PORT"
echo "   atau: curl http://$LOCAL_IP:$PORT"
echo "4. Cek log untuk error:"
echo "   pm2 logs cvlmedia --lines 50"
echo "5. Pastikan aplikasi listen di 0.0.0.0, bukan hanya 127.0.0.1"
echo ""
echo -e "${GREEN}Selesai!${NC}"

