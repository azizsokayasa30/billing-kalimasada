#!/bin/bash
# Script untuk debug Access-Reject di FreeRADIUS

echo "🔍 Debugging FreeRADIUS Access-Reject..."
echo ""

# Stop FreeRADIUS service
echo "1. Stopping FreeRADIUS service..."
sudo systemctl stop freeradius
sleep 2

# Start FreeRADIUS in debug mode in background
echo "2. Starting FreeRADIUS in debug mode..."
sudo freeradius -X -d /etc/freeradius/3.0 > /tmp/freeradius-debug.log 2>&1 &
FREERADIUS_PID=$!
sleep 5

# Test dengan radtest
echo "3. Testing with radtest..."
echo "   User: enos"
echo "   Password: 220208"
echo "   Client: 192.168.1.29"
echo ""

# Test dari localhost
echo "   Testing from localhost..."
sudo radtest enos 220208 127.0.0.1 0 testing123 2>&1 | head -20

sleep 2

# Test dari Mikrotik IP (simulasi)
echo ""
echo "   Testing from Mikrotik IP (192.168.1.29)..."
# Note: Ini akan fail karena kita test dari server, bukan dari Mikrotik
# Tapi kita bisa lihat log untuk melihat apa yang terjadi

sleep 2

# Stop FreeRADIUS debug
echo ""
echo "4. Stopping FreeRADIUS debug mode..."
sudo pkill -9 freeradius
sleep 2

# Show relevant log
echo ""
echo "5. Relevant log entries:"
echo "=========================="
grep -i "enos\|reject\|sql\|auth\|error" /tmp/freeradius-debug.log | tail -30

echo ""
echo "6. Full debug log saved to: /tmp/freeradius-debug.log"
echo "   View with: cat /tmp/freeradius-debug.log | grep -i 'enos\|reject\|sql'"

# Restart FreeRADIUS service
echo ""
echo "7. Restarting FreeRADIUS service..."
sudo systemctl start freeradius

