#!/bin/bash

# Script untuk setup SSL gratis menggunakan Let's Encrypt untuk domain bill.cvlmedia.my.id
# Pastikan domain sudah pointing ke IP server ini sebelum menjalankan script ini

set -e

DOMAIN="bill.cvlmedia.my.id"
EMAIL="cvlintasmultimedia@gmail.com"  # Ganti dengan email Anda untuk notifikasi Let's Encrypt
NGINX_CONF_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
NGINX_CONF_FILE="$NGINX_CONF_DIR/$DOMAIN"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
APP_PORT="3003"

echo "🔒 Setup SSL untuk domain: $DOMAIN"
echo "=================================="
echo ""

# 1. Cek apakah domain sudah pointing ke server ini
echo ""
echo "📋 Step 1: Verifikasi DNS dan IP Server"
echo "========================================"

# IP Public yang diketahui (dari Mikrotik port forwarding)
PUBLIC_IP="5.181.178.56"

# Get IP dari server (untuk verifikasi)
SERVER_IP=$(curl -4 -s ifconfig.me 2>/dev/null || curl -4 -s icanhazip.com 2>/dev/null || curl -4 -s ipinfo.io/ip 2>/dev/null || echo "unknown")

echo "IP Public Router (untuk DNS): $PUBLIC_IP"
if [ "$SERVER_IP" != "unknown" ]; then
    echo "IP Server (detected): $SERVER_IP"
    if [ "$SERVER_IP" != "$PUBLIC_IP" ]; then
        echo "ℹ️ Server berada di belakang router dengan port forwarding"
        echo "   Gunakan IP Public Router ($PUBLIC_IP) untuk DNS A record"
    fi
fi
echo ""

# Cek DNS
echo "Checking DNS for $DOMAIN..."
DNS_IP=$(dig +short $DOMAIN 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1 || echo "")

if [ -n "$DNS_IP" ]; then
    echo "DNS Record: $DOMAIN → $DNS_IP"
    if [ "$DNS_IP" = "$PUBLIC_IP" ]; then
        echo "✅ DNS sudah pointing ke IP public router!"
    else
        echo "⚠️ DNS pointing ke IP berbeda: $DNS_IP (Expected: $PUBLIC_IP)"
        echo "   Pastikan DNS A record pointing ke: $PUBLIC_IP"
    fi
else
    echo "⚠️ DNS record tidak ditemukan atau belum propagate"
    echo "   Pastikan DNS A record sudah dibuat untuk: $DOMAIN → $PUBLIC_IP"
fi

echo ""
read -p "Apakah domain sudah pointing ke IP server? (y/n): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "❌ Silakan setup DNS terlebih dahulu."
    echo ""
    echo "📝 Langkah setup DNS:"
    echo "   1. Login ke panel DNS provider (misal: Cloudflare, Namecheap)"
    echo "   2. Buat/update A record:"
    echo "      Type: A"
    echo "      Name: bil"
    echo "      Value: $PUBLIC_IP"
    echo "      TTL: 300"
    echo "   3. Tunggu propagasi DNS (5 menit - 48 jam)"
    echo "   4. Verifikasi dengan: dig +short $DOMAIN"
    echo ""
    echo "📝 Setup Port Forwarding di Mikrotik:"
    echo "   1. Login ke Mikrotik Router"
    echo "   2. Masuk ke IP > Firewall > NAT"
    echo "   3. Tambahkan 2 rules:"
    echo "      - Dst Port: 80 → Dst Address: [IP_LOCAL_SERVER], Port: 80"
    echo "      - Dst Port: 443 → Dst Address: [IP_LOCAL_SERVER], Port: 443"
    echo "   4. Pastikan firewall allow connection masuk ke port 80 & 443"
    echo ""
    exit 1
fi

# 2. Install Nginx dan Certbot jika belum terinstall
echo ""
echo "📦 Step 2: Install Dependencies"
echo "================================"

# Install Nginx
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    sudo apt update
    sudo apt install -y nginx
    echo "✅ Nginx installed"
else
    echo "✅ Nginx sudah terinstall: $(nginx -v 2>&1 | head -1)"
fi

# Install Certbot
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    sudo apt install -y certbot python3-certbot-nginx
    echo "✅ Certbot installed"
else
    echo "✅ Certbot sudah terinstall: $(certbot --version 2>&1 | head -1)"
fi

# Pastikan Nginx running
if ! systemctl is-active --quiet nginx; then
    echo "Starting Nginx..."
    sudo systemctl start nginx
    sudo systemctl enable nginx
    echo "✅ Nginx started and enabled"
else
    echo "✅ Nginx sudah running"
fi

# 3. Cek firewall
echo ""
echo "🔥 Step 3: Setup Firewall"
echo "=========================="
if command -v ufw &> /dev/null; then
    echo "Checking firewall rules..."
    if sudo ufw status | grep -q "80/tcp"; then
        echo "✅ Port 80 already allowed"
    else
        echo "Opening port 80..."
        sudo ufw allow 80/tcp
        echo "✅ Port 80 allowed"
    fi
    
    if sudo ufw status | grep -q "443/tcp"; then
        echo "✅ Port 443 already allowed"
    else
        echo "Opening port 443..."
        sudo ufw allow 443/tcp
        echo "✅ Port 443 allowed"
    fi
else
    echo "⚠️ UFW not found, please manually open port 80 and 443"
fi

# 4. Buat konfigurasi Nginx untuk domain
echo ""
echo "🌐 Step 4: Setup Nginx Configuration"
echo "======================================"
sudo mkdir -p $NGINX_CONF_DIR
sudo mkdir -p $NGINX_ENABLED_DIR

# Buat konfigurasi Nginx untuk domain (hanya HTTP dulu, HTTPS akan ditambahkan setelah certificate didapat)
sudo tee $NGINX_CONF_FILE > /dev/null <<EOF
# HTTP server - untuk Let's Encrypt challenge dan redirect ke HTTPS (setelah SSL didapat)
server {
    listen 80;
    server_name $DOMAIN;

    # Let's Encrypt challenge (PENTING untuk webroot mode)
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Untuk sementara, proxy ke aplikasi (akan diubah ke redirect HTTPS setelah SSL didapat)
    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Webhook Wablas
    location /webhook/wablas {
        proxy_pass http://localhost:$APP_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
EOF

echo "✅ Nginx configuration created: $NGINX_CONF_FILE"

# 5. Buat direktori untuk Let's Encrypt challenge
echo ""
echo "📁 Step 5: Setup Let's Encrypt Challenge Directory"
sudo mkdir -p /var/www/html/.well-known/acme-challenge
sudo chown -R www-data:www-data /var/www/html
echo "✅ Challenge directory created"

# 6. Enable site di Nginx
echo ""
echo "🔗 Step 6: Enable Nginx Site"
# Hapus symlink lama jika ada
sudo rm -f $NGINX_ENABLED_DIR/$DOMAIN
sudo rm -f $NGINX_ENABLED_DIR/default

# Buat symlink baru
sudo ln -sf $NGINX_CONF_FILE $NGINX_ENABLED_DIR/$DOMAIN

# Test konfigurasi Nginx
echo "Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration valid"
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
else
    echo "❌ Nginx configuration error!"
    exit 1
fi

# 7. Get SSL Certificate dengan Certbot
echo ""
echo "🔐 Step 7: Get SSL Certificate from Let's Encrypt"
echo "This will automatically configure SSL for your domain..."

# Gunakan certbot untuk get certificate
echo "Getting SSL certificate from Let's Encrypt..."
echo "Note: Using webroot mode (Nginx will continue running)"
echo ""

# Pastikan webroot directory ada
WEBROOT_DIR="/var/www/html"
sudo mkdir -p $WEBROOT_DIR/.well-known/acme-challenge
sudo chown -R www-data:www-data $WEBROOT_DIR

# Get certificate menggunakan webroot mode (tidak perlu stop nginx)
if sudo certbot certonly --webroot -w $WEBROOT_DIR -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --preferred-challenges http; then
    echo "✅ SSL Certificate obtained successfully!"
    echo ""
    echo "📋 Certificate Details:"
    echo "   Domain: $DOMAIN"
    echo "   Certificate: $CERT_DIR/fullchain.pem"
    echo "   Private Key: $CERT_DIR/privkey.pem"
    echo "   Expires: $(sudo openssl x509 -in $CERT_DIR/fullchain.pem -noout -enddate 2>/dev/null || echo 'Check manually')"
    echo ""
    echo "🔧 Updating Nginx configuration with SSL certificates..."
    
    # Update Nginx config dengan certificate paths
    if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
        # Backup config dulu
        sudo cp $NGINX_CONF_FILE ${NGINX_CONF_FILE}.backup
        
        # Buat konfigurasi HTTPS baru
        sudo tee -a $NGINX_CONF_FILE > /dev/null <<EOF

# HTTPS server (aktif setelah certificate didapat)
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL Configuration
    ssl_certificate $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    
    # SSL Protocols
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Client max body size
    client_max_body_size 10M;

    # Proxy settings
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header X-Forwarded-Port \$server_port;

    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Main application
    location / {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:$APP_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Webhook Wablas (penting untuk Wablas!)
    location /webhook/wablas {
        proxy_pass http://localhost:$APP_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Increase timeout untuk webhook
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Static files caching
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://localhost:$APP_PORT;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        proxy_pass http://localhost:$APP_PORT;
        access_log off;
    }

    # Block access to sensitive files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~ /(settings\.json|\.env|\.git) {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF
        
        # Update HTTP server untuk redirect ke HTTPS (kecuali untuk Let's Encrypt challenge)
        # Buat backup dulu
        sudo cp $NGINX_CONF_FILE ${NGINX_CONF_FILE}.temp
        
        # Hapus location / dan webhook dari HTTP server
        sudo sed -i '/# Untuk sementara, proxy ke aplikasi/,/}/d' $NGINX_CONF_FILE
        sudo sed -i '/# Webhook Wablas/,/}/d' $NGINX_CONF_FILE
        sudo sed -i '/location \/webhook\/wablas {/,/}/d' $NGINX_CONF_FILE
        
        # Insert redirect setelah Let's Encrypt challenge location
        sudo sed -i '/location \/\.well-known\/acme-challenge\/ {/a\
\
    # Redirect all other HTTP to HTTPS\
    location / {\
        return 301 https://$host$request_uri;\
    }' $NGINX_CONF_FILE
        
        # Test dan reload Nginx
        if sudo nginx -t; then
            sudo systemctl reload nginx
            echo "✅ Nginx configuration updated and reloaded"
            echo "✅ HTTP now redirects to HTTPS"
        else
            echo "⚠️ Nginx config error, restoring backup..."
            sudo cp ${NGINX_CONF_FILE}.backup $NGINX_CONF_FILE
            sudo nginx -t
            sudo systemctl reload nginx
        fi
    fi
else
    echo "❌ Failed to obtain SSL certificate"
    echo "Please check:"
    echo "  1. Domain DNS sudah pointing ke IP server ($PUBLIC_IP)"
    echo "  2. Port 80 dan 443 sudah dibuka di firewall"
    echo "  3. Port forwarding di Mikrotik sudah setup"
    echo "  4. Nginx sudah running"
    echo ""
    echo "💡 Tips: Pastikan port 80 bisa diakses dari internet untuk Let's Encrypt verification"
    exit 1
fi

# 8. Setup auto-renewal
echo ""
echo "🔄 Step 8: Setup Auto-Renewal"
# Test renewal
sudo certbot renew --dry-run

if [ $? -eq 0 ]; then
    echo "✅ Auto-renewal test successful"
    echo "Certificate will auto-renew before expiration"
else
    echo "⚠️ Auto-renewal test failed, but certificate is valid"
fi

# 9. Final check
echo ""
echo "✅ SSL Setup Complete!"
echo ""
echo "📋 Summary:"
echo "   Domain: https://$DOMAIN"
echo "   Webhook URL: https://$DOMAIN/webhook/wablas"
echo "   Certificate: Let's Encrypt (Auto-renewal enabled)"
echo ""
echo "🔧 Next Steps:"
echo "  1. Update Wablas webhook URL di dashboard Wablas:"
echo "     https://$DOMAIN/webhook/wablas"
echo ""
echo "  2. Test webhook endpoint:"
echo "     curl -X GET https://$DOMAIN/webhook/wablas/health"
echo ""
echo "  3. Test webhook dengan mengirim pesan ke nomor yang dipair"
echo ""
echo "  4. Cek log aplikasi untuk memastikan webhook diterima:"
echo "     tail -f logs/app.log"
echo ""
echo "📝 Important Notes:"
echo "   - Certificate akan auto-renew setiap 90 hari"
echo "   - Untuk test renewal: sudo certbot renew --dry-run"
echo "   - Pastikan aplikasi billing running di port $APP_PORT"
echo "   - Restart aplikasi setelah setup SSL untuk memastikan konfigurasi ter-load"
echo ""
echo "🔍 Troubleshooting:"
echo "   - Cek Nginx error log: sudo tail -f /var/log/nginx/error.log"
echo "   - Cek Nginx access log: sudo tail -f /var/log/nginx/access.log"
echo "   - Test SSL: openssl s_client -connect $DOMAIN:443 -servername $DOMAIN"

