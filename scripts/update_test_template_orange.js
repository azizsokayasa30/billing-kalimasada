#!/usr/bin/env node
/**
 * Script untuk update template "Test" dengan desain Orange style
 * Berdasarkan source code dari: https://raw.githubusercontent.com/laksa19/laksa19.github.io/master/download/voucher/Orange.txt
 * Disesuaikan dengan ukuran 6cm x 4cm dan informasi lengkap
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/billing.db');
const db = new sqlite3.Database(dbPath);

// Template Orange style dengan ukuran 6cm x 4cm
const orangeTemplate = {
    name: 'Test',
    code: `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Agency FB', Arial, sans-serif;
    background: #f5f7fa;
    padding: 10px;
}

.voucher-container {
    width: 6cm;
    height: 4cm;
    display: inline-block;
    margin: 4px;
    position: relative;
    overflow: hidden;
    border: 1px solid #FFF3E0;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
}

/* Diagonal Split - Orange setengah halaman */
/* Container: 6cm x 4cm = 226.77px x 151.18px (96 DPI) */
.bg-diagonal-main {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 0;
    height: 0;
    /* Diagonal dari bottom-right ke center-top untuk split 50/50 */
    border-top: 151px solid transparent;
    border-left: 0;
    border-right: 227px solid #FFAB40;
    border-bottom: 0;
    z-index: 1;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

/* Price Box - Top Left */
.price-box {
    position: absolute;
    top: 0;
    left: 0;
    background: #FF6D00;
    color: #fff;
    font-weight: bold;
    font-family: 'Agency FB', Arial, sans-serif;
    font-size: 20px;
    padding: 2.5px 25px 2.5px 20px;
    border-radius: 0 0 50px 0;
    z-index: 10;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

.price-currency {
    font-size: 8px;
    margin-left: -17px;
    position: absolute;
    top: 2px;
    left: 5px;
}

.price-amount {
    font-size: 20px;
}

/* Duration & Data Limit - Top Right */
.duration-box {
    position: absolute;
    top: 8px;
    right: 0;
    text-align: right;
    z-index: 10;
}

.duration-text {
    padding: 0 2.5px;
    font-size: 7px;
    font-weight: bold;
    color: #333333;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 2px;
    margin-bottom: 2px;
    display: inline-block;
}

.data-limit {
    padding: 0 2.5px;
    font-size: 8px;
    font-weight: bold;
    color: #bf0000;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 2px;
    display: inline-block;
}

/* Voucher Code Section - Center Right (di area orange) */
.voucher-code-section {
    position: absolute;
    top: 50%;
    right: 10px;
    left: 50%;
    transform: translateY(-50%);
    text-align: center;
    z-index: 10;
    width: calc(50% - 20px);
}

.voucher-label {
    padding: 0;
    text-align: center;
    font-weight: bold;
    font-size: 10px;
    font-family: 'Courier New', monospace;
    width: 100%;
    background: #333;
    color: #fff;
    padding: 3px 5px;
    margin-bottom: 5px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

.voucher-code {
    padding: 0 5px 0 0;
    border-top: 1px solid #fff;
    border-bottom: 1px solid #fff;
    text-align: center;
    font-weight: bold;
    font-size: 24px;
    font-family: 'Courier New', monospace;
    color: #fff;
    background: transparent;
    padding: 8px 5px;
    width: 100%;
    display: block;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

/* QR Code - Left Bottom (di area white) */
.qr-code-container {
    position: absolute;
    bottom: 35px;
    left: 5px;
    width: 60px;
    height: 60px;
    z-index: 10;
}

.qrcode {
    height: 60px;
    width: 60px;
    max-width: 100%;
    max-height: 100%;
}

/* Logo - Bottom Left (di area white) */
.voucher-logo {
    position: absolute;
    bottom: 5px;
    left: 5px;
    width: 80px;
    height: 25px;
    max-width: 80px;
    max-height: 25px;
    object-fit: contain;
    z-index: 10;
}

/* Login URL - Bottom Right */
.login-url {
    position: absolute;
    bottom: 2px;
    right: 5px;
    color: #fff;
    font-size: 7px;
    font-weight: bold;
    margin: 0 -2.5px;
    padding: 2.5px;
    width: 60%;
    text-align: right;
    z-index: 10;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

/* Background Diagonal Orange - Setengah halaman */
.bg-diagonal-main {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 0;
    height: 0;
    border-top: 200px solid transparent;
    border-left: 0;
    border-right: 300px solid #FFAB40;
    border-bottom: 0;
    z-index: 1;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

/* Number Badge (optional) */
.num-badge {
    position: absolute;
    width: auto;
    top: 20px;
    right: 80px;
    color: #333;
    font-size: 8px;
    padding: 0;
    z-index: 10;
}

@media print {
    /* Pastikan semua warna dan background tercetak */
    * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
    }
    
    body {
        background: white !important;
        padding: 5px !important;
        margin: 0 !important;
    }
    
    .voucher-container {
        page-break-inside: avoid !important;
        margin: 4px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        border: 1px solid #FFF3E0 !important;
    }
    
    .price-box {
        background: #FF6D00 !important;
        color: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    .voucher-label {
        background: #333 !important;
        color: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    .voucher-code {
        background: rgba(255, 171, 64, 0.9) !important;
        color: #fff !important;
        border-top: 1px solid #fff !important;
        border-bottom: 1px solid #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    .bg-diagonal-main {
        border-right-color: #FFAB40 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    .login-url {
        color: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    @page {
        size: landscape;
        margin: 0.5cm;
    }
}
</style>

{foreach $v as $vs} <!-- DON'T REMOVE THIS LINE -->
<div class="voucher-container">
    <!-- Background Diagonal Orange - Setengah halaman -->
    <div class="bg-diagonal-main"></div>
    
    <!-- Price Box - Top Left -->
    <div class="price-box">
        <span class="price-currency">Rp</span>
        <span class="price-amount">{$vs['total']}</span>
    </div>
    
    <!-- Duration & Data Limit - Top Right -->
    <div class="duration-box">
        <div class="duration-text">{$vs['validity_display']}</div>
        <div class="data-limit">Data {$vs['datalimit_display']}</div>
    </div>
    
    <!-- Voucher Code Section - Center Right (di area orange) -->
    <div class="voucher-code-section">
        <div class="voucher-label">VOUCHER</div>
        <div class="voucher-code">{$vs['code']}</div>
    </div>
    
    <!-- QR Code - Left Bottom (optional, akan di-generate oleh script) -->
    <div class="qr-code-container" id="qrcode-{$vs['code']}"></div>
    
    <!-- Logo - Bottom Left -->
    {if $vs['logo_url'] neq ''}
    <img src="{$vs['logo_url']}" alt="Logo" class="voucher-logo" onerror="this.style.display='none';">
    {/if}
    
    <!-- Login URL - Bottom Right -->
    <div class="login-url">
        cek status/logout: http://{$hotspotdns}
    </div>
</div>
{/foreach} <!-- DON'T REMOVE THIS LINE -->

<script src="https://cdn.rawgit.com/davidshimjs/qrcodejs/gh-pages/qrcode.min.js"></script>
<script>
// Generate QR Code untuk setiap voucher
document.addEventListener('DOMContentLoaded', function() {
    const qrContainers = document.querySelectorAll('[id^="qrcode-"]');
    qrContainers.forEach(function(container) {
        const voucherCode = container.id.replace('qrcode-', '');
        // Ambil login URL dari elemen login-url terdekat
        const loginUrlElement = container.closest('.voucher-container').querySelector('.login-url');
        let loginUrl = '';
        if (loginUrlElement) {
            const urlText = loginUrlElement.textContent.trim();
            const urlMatch = urlText.match(/http:\/\/[^\\s]+/);
            if (urlMatch) {
                loginUrl = urlMatch[0];
            }
        }
        // QR Code berisi login URL dan voucher code
        const qrData = loginUrl ? (loginUrl + '\\n' + voucherCode) : voucherCode;
        
        if (typeof QRCode !== 'undefined') {
            new QRCode(container, {
                text: qrData,
                width: 60,
                height: 60,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    });
});
</script>

{include file="rad-template-footer.tpl"} <!-- DON'T REMOVE THIS LINE -->`
};

// Pastikan tabel ada
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS voucher_print_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_name TEXT NOT NULL UNIQUE,
            template_code TEXT NOT NULL,
            is_default INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('❌ Error creating table:', err);
            process.exit(1);
        }
        
        console.log('📦 Updating Test template with Orange style...\n');
        
        // Cek apakah template "Test" sudah ada
        db.get(
            'SELECT id FROM voucher_print_templates WHERE template_name = ?',
            [orangeTemplate.name],
            (err, row) => {
                if (err) {
                    console.error('❌ Error checking template:', err);
                    db.close();
                    process.exit(1);
                }
                
                if (row) {
                    // Update template yang sudah ada
                    db.run(
                        'UPDATE voucher_print_templates SET template_code = ?, updated_at = CURRENT_TIMESTAMP WHERE template_name = ?',
                        [orangeTemplate.code, orangeTemplate.name],
                        function(updateErr) {
                            if (updateErr) {
                                console.error(`❌ Error updating template ${orangeTemplate.name}:`, updateErr);
                                db.close();
                                process.exit(1);
                            } else {
                                console.log(`✅ Template '${orangeTemplate.name}' berhasil diupdate dengan desain Orange style`);
                                console.log(`\n📋 Fitur template:`);
                                console.log(`   ✓ Ukuran: 6cm x 4cm (landscape)`);
                                console.log(`   ✓ Desain Orange dengan diagonal background`);
                                console.log(`   ✓ Price box di top-left`);
                                console.log(`   ✓ Voucher code di kanan`);
                                console.log(`   ✓ QR Code di bottom-left`);
                                console.log(`   ✓ Logo di bottom-left`);
                                console.log(`   ✓ Login URL di bottom-right`);
                                console.log(`   ✓ Duration & Data limit di top-right`);
                                console.log(`   ✓ Print-ready CSS`);
                                db.close();
                                process.exit(0);
                            }
                        }
                    );
                } else {
                    // Insert template baru
                    db.run(
                        'INSERT INTO voucher_print_templates (template_name, template_code, is_default, status) VALUES (?, ?, ?, ?)',
                        [orangeTemplate.name, orangeTemplate.code, 0, 'enabled'],
                        function(insertErr) {
                            if (insertErr) {
                                console.error(`❌ Error inserting template ${orangeTemplate.name}:`, insertErr);
                                db.close();
                                process.exit(1);
                            } else {
                                console.log(`✅ Template '${orangeTemplate.name}' berhasil dibuat dengan desain Orange style`);
                                db.close();
                                process.exit(0);
                            }
                        }
                    );
                }
            }
        );
    });
});
