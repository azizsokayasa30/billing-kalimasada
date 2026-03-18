#!/usr/bin/env node
/**
 * Script untuk membuat template voucher premium dengan desain modern
 * Template ini memiliki semua informasi yang diperlukan: logo, nama perusahaan, kode voucher, harga, durasi, validity
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/billing.db');
const db = new sqlite3.Database(dbPath);

// Template Premium dengan desain modern dan informasi lengkap
const premiumTemplate = {
    name: 'Premium Complete',
    code: `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: #f5f7fa;
    padding: 10px;
}

.voucher-container {
    width: 6cm;
    height: 4cm;
    display: inline-block;
    margin: 4px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
    position: relative;
    vertical-align: top;
}

.voucher-header {
    background: rgba(255, 255, 255, 0.95);
    padding: 4px 6px;
    text-align: center;
    border-bottom: 1px solid rgba(102, 126, 234, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 0.8cm;
    min-height: 20px;
}

.voucher-logo {
    max-width: 50px;
    max-height: 18px;
    height: auto;
    display: block;
}

.company-name {
    font-size: 9px;
    font-weight: 700;
    color: #2d3748;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    line-height: 1.1;
    flex: 1;
    text-align: center;
}

.voucher-body {
    background: #ffffff;
    padding: 5px 6px;
    height: calc(100% - 0.8cm - 0.6cm);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.voucher-code-section {
    text-align: center;
    margin-bottom: 5px;
    padding: 2px 0;
}

.code-label {
    font-size: 7px;
    color: #718096;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
    font-weight: 600;
}

.voucher-code {
    font-size: 16px;
    font-weight: 800;
    color: #667eea;
    font-family: 'Courier New', monospace;
    letter-spacing: 1px;
    padding: 4px 8px;
    border: 1.5px dashed #667eea;
    border-radius: 4px;
    margin: 2px 0;
    display: inline-block;
    min-width: 80px;
    /* Pastikan warna solid untuk print */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
}

.voucher-code-large {
    font-size: 18px;
    font-weight: 900;
    /* Pastikan warna solid, bukan gradient transparent */
    color: #667eea !important;
    -webkit-text-fill-color: #667eea !important;
    background: transparent !important;
}

.voucher-info {
    background: #f7fafc;
    border-radius: 6px;
    padding: 4px 5px;
    margin-bottom: 2px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    flex: 1;
}

.info-row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 2px 0;
    min-height: auto;
}

.info-label {
    font-size: 6px;
    color: #718096;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.3px;
    line-height: 1.2;
    margin-bottom: 1px;
}

.info-value {
    font-size: 8px;
    color: #2d3748;
    font-weight: 700;
    line-height: 1.3;
    word-break: break-word;
}

.price-value {
    font-size: 10px;
    color: #667eea;
    font-weight: 800;
}

.duration-value, .validity-value {
    font-size: 7px;
    color: #48bb78;
    font-weight: 700;
}

.voucher-footer {
    background: rgba(102, 126, 234, 0.1);
    padding: 2px 4px;
    text-align: center;
    border-top: 1px solid rgba(102, 126, 234, 0.2);
    height: 0.6cm;
    min-height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.login-url {
    font-size: 6px;
    color: #667eea;
    font-weight: 600;
    margin: 0;
    line-height: 1.2;
    word-break: break-all;
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
        /* Pastikan background gradient tercetak */
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        /* Pastikan border dan shadow tercetak */
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1) !important;
    }
    
    .voucher-header {
        background: rgba(255, 255, 255, 0.95) !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    .voucher-body {
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    .voucher-code {
        /* Pastikan kode voucher terlihat dengan warna solid */
        color: #667eea !important;
        background: transparent !important;
        border: 1.5px dashed #667eea !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        /* Pastikan text tidak hilang */
        -webkit-text-fill-color: #667eea !important;
    }
    
    .voucher-info {
        background: #f7fafc !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    .voucher-footer {
        background: rgba(102, 126, 234, 0.1) !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    .price-value {
        color: #667eea !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    .duration-value, .validity-value {
        color: #48bb78 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    .login-url {
        color: #667eea !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    /* Pastikan semua text terlihat */
    .company-name,
    .code-label,
    .info-label,
    .info-value {
        color: inherit !important;
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
    <div class="voucher-header">
        {if $vs['logo_url'] neq ''}
        <img src="{$vs['logo_url']}" alt="Logo" class="voucher-logo" onerror="this.style.display='none';">
        {/if}
        <p class="company-name">{$vs['company_name']}</p>
    </div>
    
    <div class="voucher-body">
        <!-- Voucher Code (selalu tampilkan kode voucher) -->
        <div class="voucher-code-section">
            <div class="code-label">Voucher Code</div>
            <div class="voucher-code voucher-code-large">{$vs['code']}</div>
        </div>
        
        <div class="voucher-info">
            <div class="info-row">
                <span class="info-label">Harga</span>
                <span class="info-value price-value">{$vs['total']}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Durasi</span>
                <span class="info-value duration-value">
                    {$vs['timelimit_display']}
                </span>
            </div>
            <div class="info-row">
                <span class="info-label">Validity</span>
                <span class="info-value validity-value">
                    {$vs['validity_display']}
                </span>
            </div>
        </div>
    </div>
    
    <div class="voucher-footer">
        <p class="login-url">Web Login : http://{$hotspotdns}</p>
    </div>
</div>
{/foreach} <!-- DON'T REMOVE THIS LINE -->
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
        
        console.log('📦 Creating Premium Complete template...\n');
        
        // Cek apakah template sudah ada
        db.get(
            'SELECT id FROM voucher_print_templates WHERE template_name = ?',
            [premiumTemplate.name],
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
                        [premiumTemplate.code, premiumTemplate.name],
                        function(updateErr) {
                            if (updateErr) {
                                console.error(`❌ Error updating template ${premiumTemplate.name}:`, updateErr);
                            } else {
                                console.log(`✅ Template '${premiumTemplate.name}' berhasil diupdate`);
                            }
                            db.close();
                            process.exit(updateErr ? 1 : 0);
                        }
                    );
                } else {
                    // Insert template baru
                    db.run(
                        'INSERT INTO voucher_print_templates (template_name, template_code, is_default, status) VALUES (?, ?, ?, ?)',
                        [premiumTemplate.name, premiumTemplate.code, 0, 'enabled'],
                        function(insertErr) {
                            if (insertErr) {
                                console.error(`❌ Error inserting template ${premiumTemplate.name}:`, insertErr);
                            } else {
                                console.log(`✅ Template '${premiumTemplate.name}' berhasil dibuat`);
                                console.log(`\n📋 Template ini memiliki:`);
                                console.log(`   ✓ Logo perusahaan`);
                                console.log(`   ✓ Nama perusahaan`);
                                console.log(`   ✓ Kode voucher (atau Username/Password)`);
                                console.log(`   ✓ Harga`);
                                console.log(`   ✓ Durasi`);
                                console.log(`   ✓ Validity`);
                                console.log(`   ✓ URL Login`);
                            }
                            db.close();
                            process.exit(insertErr ? 1 : 0);
                        }
                    );
                }
            }
        );
    });
});
