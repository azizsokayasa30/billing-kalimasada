#!/bin/bash

# Script untuk generate command Mikrotik untuk port forwarding
# Copy command ini ke terminal Mikrotik atau Winbox

DOMAIN="bil.cvlmedia.my.id"
PUBLIC_IP="5.181.178.56"

echo "🔧 Setup Port Forwarding Mikrotik untuk $DOMAIN"
echo "================================================"
echo ""
echo "📋 Informasi:"
echo "   Domain: $DOMAIN"
echo "   IP Public Router: $PUBLIC_IP"
echo ""
read -p "Masukkan IP Local Server (contoh: 192.168.1.50): " LOCAL_IP

if [ -z "$LOCAL_IP" ]; then
    echo "❌ IP Local Server harus diisi!"
    exit 1
fi

echo ""
echo "✅ Command untuk Mikrotik:"
echo "=========================="
echo ""
echo "# 1. Setup NAT (Port Forwarding)"
echo "/ip firewall nat add chain=dstnat protocol=tcp dst-port=80 action=dst-nat to-addresses=$LOCAL_IP to-ports=80 comment=\"HTTP for $DOMAIN\""
echo ""
echo "/ip firewall nat add chain=dstnat protocol=tcp dst-port=443 action=dst-nat to-addresses=$LOCAL_IP to-ports=443 comment=\"HTTPS for $DOMAIN\""
echo ""
echo "# 2. Setup Firewall Filter (Allow Connection)"
echo "/ip firewall filter add chain=input protocol=tcp dst-port=80 action=accept comment=\"Allow HTTP for $DOMAIN\""
echo ""
echo "/ip firewall filter add chain=input protocol=tcp dst-port=443 action=accept comment=\"Allow HTTPS for $DOMAIN\""
echo ""
echo "# 3. Verifikasi"
echo "/ip firewall nat print where comment~\"$DOMAIN\""
echo "/ip firewall filter print where comment~\"$DOMAIN\""
echo ""
echo "📝 Cara menggunakan:"
echo "   1. Login ke Mikrotik (Winbox atau SSH)"
echo "   2. Copy command di atas"
echo "   3. Paste di terminal Mikrotik atau jalankan via Winbox"
echo "   4. Verifikasi dengan command: /ip firewall nat print"
echo ""

