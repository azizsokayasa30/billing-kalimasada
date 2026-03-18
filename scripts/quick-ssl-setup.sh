#!/bin/bash

# Quick SSL Setup Script untuk bil.cvlmedia.my.id
# Script ini akan menjalankan semua langkah setup SSL secara otomatis

set -e

DOMAIN="bil.cvlmedia.my.id"
EMAIL="cvlintasmultimedia@gmail.com"

echo "🚀 Quick SSL Setup untuk $DOMAIN"
echo "=================================="
echo ""

# Jalankan script setup SSL utama
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETUP_SCRIPT="$SCRIPT_DIR/setup-ssl.sh"

if [ -f "$SETUP_SCRIPT" ]; then
    chmod +x "$SETUP_SCRIPT"
    sudo bash "$SETUP_SCRIPT"
else
    echo "❌ Script setup-ssl.sh tidak ditemukan!"
    exit 1
fi

