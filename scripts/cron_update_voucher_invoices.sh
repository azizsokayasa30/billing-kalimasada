#!/bin/bash

# Cron job untuk auto-update invoice voucher saat digunakan
# Jalankan setiap 5 menit untuk update invoice voucher menjadi 'paid' jika sudah digunakan

# Path ke script update voucher invoices
SCRIPT_PATH="/home/enos/cvlmedia/scripts/update_voucher_invoices_on_use.js"

# Path ke log file
LOG_FILE="/home/enos/cvlmedia/logs/voucher_update_cron.log"

# Jalankan script dan log hasilnya
cd /home/enos/cvlmedia && node "$SCRIPT_PATH" >> "$LOG_FILE" 2>&1

# Rotate log jika terlalu besar (lebih dari 10MB)
if [ -f "$LOG_FILE" ]; then
    LOG_SIZE=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
    if [ "$LOG_SIZE" -gt 10485760 ]; then
        mv "$LOG_FILE" "${LOG_FILE}.old"
        touch "$LOG_FILE"
    fi
fi

