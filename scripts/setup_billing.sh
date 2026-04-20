#!/usr/bin/env bash
#
# Setup script untuk Billing CVLMEDIA
# Menginstall Node.js, dependencies, dan setup database
# Setelah git clone, jalankan: bash scripts/setup_billing.sh
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BILLING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Billing CVLMEDIA - Setup Script    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${YELLOW}[!] Warning: Running as root. Some steps may need sudo later.${NC}"
fi

# Deteksi OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    else
        echo -e "${RED}[!] Cannot detect OS type${NC}"
        exit 1
    fi
}

# Check Node.js installation
check_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        NPM_VERSION=$(npm -v | cut -d'.' -f1)
        echo -e "${GREEN}[+] Node.js found: $(node -v)${NC}"
        echo -e "${GREEN}[+] npm found: $(npm -v)${NC}"
        
        # Check if version is LTS (v18, v20, or v22+)
        if [[ $NODE_VERSION -ge 18 ]]; then
            echo -e "${GREEN}[+] Node.js version is compatible (>= v18)${NC}"
            return 0
        else
            echo -e "${YELLOW}[!] Node.js version is too old (need >= v18), will upgrade${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}[!] Node.js not found${NC}"
        return 1
    fi
}

# Install Node.js LTS
install_nodejs() {
    echo -e "${GREEN}[*] Installing Node.js LTS...${NC}"
    detect_os
    
    if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
        # Install curl jika belum ada
        if ! command -v curl &> /dev/null; then
            echo -e "${BLUE}[*] Installing curl...${NC}"
            sudo apt-get update -qq
            sudo apt-get install -y curl
        fi
        
        # Install Node.js LTS via NodeSource
        echo -e "${BLUE}[*] Adding NodeSource repository...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        
        echo -e "${BLUE}[*] Installing Node.js...${NC}"
        sudo apt-get install -y nodejs
        
        # Install build tools
        echo -e "${BLUE}[*] Installing build tools...${NC}"
        sudo apt-get install -y build-essential
        
    elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
        # Install curl jika belum ada
        if ! command -v curl &> /dev/null; then
            echo -e "${BLUE}[*] Installing curl...${NC}"
            if command -v dnf &> /dev/null; then
                sudo dnf install -y curl
            else
                sudo yum install -y curl
            fi
        fi
        
        # Install Node.js LTS via NodeSource
        echo -e "${BLUE}[*] Adding NodeSource repository...${NC}"
        curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
        
        echo -e "${BLUE}[*] Installing Node.js...${NC}"
        if command -v dnf &> /dev/null; then
            sudo dnf install -y nodejs
        else
            sudo yum install -y nodejs
        fi
        
        # Install build tools
        echo -e "${BLUE}[*] Installing build tools...${NC}"
        if command -v dnf &> /dev/null; then
            sudo dnf groupinstall -y "Development Tools"
        else
            sudo yum groupinstall -y "Development Tools"
        fi
    else
        echo -e "${RED}[!] Unsupported OS: $OS${NC}"
        echo -e "${YELLOW}[!] Please install Node.js manually from https://nodejs.org/${NC}"
        exit 1
    fi
    
    # Verify installation
    if command -v node &> /dev/null; then
        echo -e "${GREEN}[+] Node.js installed: $(node -v)${NC}"
        echo -e "${GREEN}[+] npm installed: $(npm -v)${NC}"
    else
        echo -e "${RED}[!] Failed to install Node.js${NC}"
        exit 1
    fi
}

# Install PM2
install_pm2() {
    if command -v pm2 &> /dev/null; then
        echo -e "${GREEN}[+] PM2 found: $(pm2 -v)${NC}"
    else
        echo -e "${GREEN}[*] Installing PM2...${NC}"
        sudo npm install -g pm2
        echo -e "${GREEN}[+] PM2 installed: $(pm2 -v)${NC}"
    fi
}

# Install npm dependencies
install_dependencies() {
    if [ ! -f "${BILLING_DIR}/package.json" ]; then
        echo -e "${RED}[!] package.json not found in ${BILLING_DIR}${NC}"
        echo -e "${YELLOW}[!] Please ensure you're in the correct directory or specify BILLING_DIR${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}[*] Installing npm dependencies...${NC}"
    cd "${BILLING_DIR}"
    
    # Check if node_modules exists
    if [ -d "node_modules" ]; then
        echo -e "${BLUE}[*] node_modules found, checking if update needed...${NC}"
    fi
    
    npm install
    echo -e "${GREEN}[+] Dependencies installed${NC}"
}

# Setup database
setup_database() {
    echo -e "${GREEN}[*] Setting up database...${NC}"
    cd "${BILLING_DIR}"
    
    # Check if billing.db exists
    if [ -f "data/billing.db" ]; then
        echo -e "${GREEN}[+] billing.db found${NC}"
    else
        echo -e "${BLUE}[*] Creating data directory...${NC}"
        mkdir -p data
    fi
    
    # Run database setup scripts if they exist
    if [ -f "scripts/create-voucher-revenue-table.js" ]; then
        echo -e "${BLUE}[*] Running voucher revenue table setup...${NC}"
        node scripts/create-voucher-revenue-table.js || echo -e "${YELLOW}[!] Warning: Voucher revenue table setup failed${NC}"
    fi
    
    if [ -f "scripts/add-technician-tables.js" ]; then
        echo -e "${BLUE}[*] Running technician tables setup...${NC}"
        node scripts/add-technician-tables.js || echo -e "${YELLOW}[!] Warning: Technician tables setup failed${NC}"
    fi
    
    echo -e "${GREEN}[+] Database setup completed${NC}"
}

# Setup PM2 startup
setup_pm2_startup() {
    echo -e "${GREEN}[*] Setting up PM2 startup...${NC}"
    
    if command -v pm2 &> /dev/null; then
        # Save PM2 process list
        cd "${BILLING_DIR}"
        pm2 save 2>/dev/null || echo -e "${BLUE}[*] No PM2 processes to save${NC}"
        
        # Setup PM2 startup (will ask for sudo password)
        echo -e "${BLUE}[*] Configuring PM2 to start on boot...${NC}"
        echo -e "${YELLOW}[!] You may need to run 'pm2 startup' manually and follow instructions${NC}"
        pm2 startup 2>/dev/null || echo -e "${YELLOW}[!] PM2 startup configuration skipped (may need manual setup)${NC}"
    else
        echo -e "${YELLOW}[!] PM2 not installed, skipping startup setup${NC}"
    fi
}

# Create settings.json if not exists
setup_settings() {
    if [ ! -f "${BILLING_DIR}/settings.json" ]; then
        echo -e "${BLUE}[*] Creating default settings.json...${NC}"
        cd "${BILLING_DIR}"
        
        cat > settings.json << 'EOF'
{
  "admin_username": "admin",
  "admin_password": "admin",
  "user_auth_mode": "radius",
  "server_port": "3003",
  "radius_host": "localhost",
  "radius_user": "billing",
  "radius_password": "change_me",
  "radius_database": "radius"
}
EOF
        echo -e "${GREEN}[+] Default settings.json created${NC}"
        echo -e "${YELLOW}[!] IMPORTANT: Please edit settings.json and update RADIUS credentials${NC}"
    else
        echo -e "${GREEN}[+] settings.json found${NC}"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}[*] Billing directory: ${BILLING_DIR}${NC}"
    
    # Check if billing directory exists
    if [ ! -d "${BILLING_DIR}" ]; then
        echo -e "${RED}[!] Billing directory not found: ${BILLING_DIR}${NC}"
        echo -e "${YELLOW}[!] Please ensure cvlmedia directory exists or set BILLING_DIR variable${NC}"
        exit 1
    fi
    
    # Check/Install Node.js
    if ! check_nodejs; then
        install_nodejs
    fi
    
    # Install PM2
    install_pm2
    
    # Setup settings
    setup_settings
    
    # Install dependencies
    install_dependencies
    
    # Setup database
    setup_database
    
    # Setup PM2 startup (optional)
    read -p "Setup PM2 to start on boot? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_pm2_startup
    fi
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Setup Completed Successfully!      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Edit settings.json and configure:"
    echo "     - RADIUS credentials (radius_host, radius_user, radius_password)"
    echo "     - Admin password (admin_password)"
    echo "     - Server port (server_port)"
    echo ""
    echo "  2. Start the application:"
    echo "     cd ${BILLING_DIR}"
    echo "     pm2 start app.js --name cvlmedia"
    echo "     pm2 save"
    echo ""
    echo "  3. View logs:"
    echo "     pm2 logs cvlmedia"
    echo ""
    echo "  4. Access web UI:"
    echo "     http://localhost:3003/admin"
    echo ""
}

# Run main function
main

