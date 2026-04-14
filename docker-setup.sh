#!/bin/bash

# 🚀 Gembok-Bill Docker Setup Script
# Automatically prepares the environment and starts the Docker containers

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Gembok-Bill Docker setup...${NC}"

# 1. Create necessary directories
echo -e "${BLUE}📁 Creating required directories...${NC}"
mkdir -p data/backup logs whatsapp-session

# 2. Ensure settings.json exists
if [ ! -f settings.json ]; then
    echo -e "${YELLOW}⚠️  settings.json not found! Creating from template...${NC}"
    if [ -f settings.server.template.json ]; then
        cp settings.server.template.json settings.json
        echo -e "${GREEN}✅ Created settings.json from template.${NC}"
    else
        echo -e "${RED}❌ settings.server.template.json not found! Please create settings.json manually.${NC}"
        exit 1
    fi
fi

# 3. Ensure .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env not found! Creating from example...${NC}"
    cat <<EOF > .env
PORT=22917
TUNNEL_TOKEN=your_cloudflare_tunnel_token_here
EOF
    echo -e "${GREEN}✅ Created .env. Please update TUNNEL_TOKEN if needed.${NC}"
fi

# 4. Set permissions (Linux/macOS)
if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "win32" ]]; then
    echo -e "${BLUE}🔐 Setting permissions...${NC}"
    chmod 755 data/ logs/ whatsapp-session/
    chmod 644 settings.json .env
fi

# 5. Build and Start
echo -e "${BLUE}🐳 Building and starting Docker containers...${NC}"
docker compose up -d --build

echo ""
echo -e "${GREEN}✅ Gembok-Bill is starting!${NC}"
echo -e "  - Web UI: http://localhost:$(grep PORT .env | cut -d '=' -f2 || echo 22917)"
echo -e "  - Logs: docker compose logs -f gembok-bill"
echo ""
echo -e "${YELLOW}📌 Note: Scan the WhatsApp QR code by viewing logs: docker compose logs -f gembok-bill${NC}"
