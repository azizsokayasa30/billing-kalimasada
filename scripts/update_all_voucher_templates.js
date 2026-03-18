#!/usr/bin/env node
/**
 * Script untuk update semua template voucher dengan:
 * - Ukuran 6cm x 4cm landscape (sama dengan Premium Complete)
 * - Informasi lengkap (logo, nama perusahaan, kode voucher, harga, durasi, validity, web login)
 * - Tetap mempertahankan karakteristik desain masing-masing template
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/billing.db');
const db = new sqlite3.Database(dbPath);

// Base template structure dengan ukuran dan informasi standar
const baseStructure = {
    containerWidth: '6cm',
    containerHeight: '4cm',
    headerHeight: '0.8cm',
    footerHeight: '0.6cm',
    bodyHeight: 'calc(100% - 0.8cm - 0.6cm)',
    printCSS: `
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
    
    .voucher-container,
    .container {
        page-break-inside: avoid !important;
        margin: 4px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
    }
    
    .voucher-code,
    .code-highlight,
    .code-text {
        color: inherit !important;
        -webkit-text-fill-color: inherit !important;
        background: transparent !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    @page {
        size: landscape;
        margin: 0.5cm;
    }
}`
};

// Fungsi untuk generate template dengan desain yang berbeda
function generateTemplate(templateName, designStyle) {
    let template = '';
    
    // Base CSS untuk semua template
    const baseCSS = `
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
    width: ${baseStructure.containerWidth};
    height: ${baseStructure.containerHeight};
    display: inline-block;
    margin: 4px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
    position: relative;
    vertical-align: top;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
}

.voucher-header {
    padding: 4px 6px;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: ${baseStructure.headerHeight};
    min-height: 20px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
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
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    line-height: 1.1;
    flex: 1;
    text-align: center;
}

.voucher-body {
    padding: 5px 6px;
    height: ${baseStructure.bodyHeight};
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

.voucher-code-section {
    text-align: center;
    margin-bottom: 5px;
    padding: 2px 0;
}

.code-label {
    font-size: 7px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
    font-weight: 600;
}

.voucher-code {
    font-size: 16px;
    font-weight: 800;
    font-family: 'Courier New', monospace;
    letter-spacing: 1px;
    padding: 4px 8px;
    border-radius: 4px;
    margin: 2px 0;
    display: inline-block;
    min-width: 80px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
}

.voucher-code-large {
    font-size: 18px;
    font-weight: 900;
    color: inherit !important;
    -webkit-text-fill-color: inherit !important;
}

.voucher-info {
    border-radius: 6px;
    padding: 4px 5px;
    margin-bottom: 2px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    flex: 1;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
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
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.3px;
    line-height: 1.2;
    margin-bottom: 1px;
}

.info-value {
    font-size: 8px;
    font-weight: 700;
    line-height: 1.3;
    word-break: break-word;
}

.price-value {
    font-size: 10px;
    font-weight: 800;
}

.duration-value, .validity-value {
    font-size: 7px;
    font-weight: 700;
}

.voucher-footer {
    padding: 2px 4px;
    text-align: center;
    height: ${baseStructure.footerHeight};
    min-height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

.login-url {
    font-size: 6px;
    font-weight: 600;
    margin: 0;
    line-height: 1.2;
    word-break: break-all;
}`;

    // Design-specific CSS berdasarkan nama template
    let designCSS = '';
    let containerStyle = '';
    let headerStyle = '';
    let bodyStyle = '';
    let footerStyle = '';
    let codeStyle = '';
    let infoStyle = '';
    
    const nameLower = templateName.toLowerCase();
    
    if (nameLower.includes('modern gradient') || nameLower.includes('gradient')) {
        // Modern Gradient - gradient purple/pink
        designCSS = `
.voucher-container {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
    border: 2px solid #667eea;
}

.voucher-header {
    background: rgba(255, 255, 255, 0.95);
    border-bottom: 1px solid rgba(102, 126, 234, 0.2);
}

.company-name {
    color: #2d3748;
}

.voucher-body {
    background: #ffffff;
}

.voucher-code {
    color: #667eea;
    border: 1.5px dashed #667eea;
    background: linear-gradient(135deg, #ffffff 0%, #e3f2fd 100%);
}

.code-label {
    color: #718096;
}

.voucher-info {
    background: #f7fafc;
}

.info-label {
    color: #718096;
}

.info-value {
    color: #2d3748;
}

.price-value {
    color: #667eea;
}

.duration-value, .validity-value {
    color: #48bb78;
}

.voucher-footer {
    background: rgba(102, 126, 234, 0.1);
    border-top: 1px solid rgba(102, 126, 234, 0.2);
}

.login-url {
    color: #667eea;
}`;
    } else if (nameLower.includes('classic blue') || nameLower.includes('blue')) {
        // Classic Blue - solid blue
        designCSS = `
.voucher-container {
    background: #ffffff;
    border: 2px solid #2196F3;
}

.voucher-header {
    background: #2196F3;
    border-bottom: 1px solid #1976D2;
}

.company-name {
    color: #ffffff;
}

.voucher-body {
    background: #ffffff;
}

.voucher-code {
    color: #2196F3;
    border: 1.5px dashed #2196F3;
    background: #E3F2FD;
}

.code-label {
    color: #1976D2;
}

.voucher-info {
    background: #E3F2FD;
}

.info-label {
    color: #1976D2;
}

.info-value {
    color: #1565C0;
}

.price-value {
    color: #2196F3;
}

.duration-value, .validity-value {
    color: #4CAF50;
}

.voucher-footer {
    background: #E3F2FD;
    border-top: 1px solid #BBDEFB;
}

.login-url {
    color: #2196F3;
}`;
    } else if (nameLower.includes('green nature') || nameLower.includes('green')) {
        // Green Nature - green theme
        designCSS = `
.voucher-container {
    background: #ffffff;
    border: 2px solid #4CAF50;
}

.voucher-header {
    background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
    border-bottom: 1px solid #1B5E20;
}

.company-name {
    color: #ffffff;
}

.voucher-body {
    background: #ffffff;
}

.voucher-code {
    color: #4CAF50;
    border: 1.5px dashed #4CAF50;
    background: #E8F5E9;
}

.code-label {
    color: #2E7D32;
}

.voucher-info {
    background: #E8F5E9;
}

.info-label {
    color: #2E7D32;
}

.info-value {
    color: #1B5E20;
}

.price-value {
    color: #4CAF50;
}

.duration-value, .validity-value {
    color: #66BB6A;
}

.voucher-footer {
    background: #E8F5E9;
    border-top: 1px solid #C8E6C9;
}

.login-url {
    color: #4CAF50;
}`;
    } else if (nameLower.includes('orange energy') || nameLower.includes('orange')) {
        // Orange Energy - orange theme
        designCSS = `
.voucher-container {
    background: #ffffff;
    border: 2px solid #FF9800;
}

.voucher-header {
    background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%);
    border-bottom: 1px solid #E65100;
}

.company-name {
    color: #ffffff;
}

.voucher-body {
    background: #ffffff;
}

.voucher-code {
    color: #FF9800;
    border: 1.5px dashed #FF9800;
    background: #FFF3E0;
}

.code-label {
    color: #F57C00;
}

.voucher-info {
    background: #FFF3E0;
}

.info-label {
    color: #F57C00;
}

.info-value {
    color: #E65100;
}

.price-value {
    color: #FF9800;
}

.duration-value, .validity-value {
    color: #FFB74D;
}

.voucher-footer {
    background: #FFF3E0;
    border-top: 1px solid #FFE0B2;
}

.login-url {
    color: #FF9800;
}`;
    } else if (nameLower.includes('red classic') || nameLower.includes('red')) {
        // Red Classic - red theme
        designCSS = `
.voucher-container {
    background: #ffffff;
    border: 2px solid #F44336;
}

.voucher-header {
    background: linear-gradient(135deg, #F44336 0%, #C62828 100%);
    border-bottom: 1px solid #B71C1C;
}

.company-name {
    color: #ffffff;
}

.voucher-body {
    background: #ffffff;
}

.voucher-code {
    color: #F44336;
    border: 1.5px dashed #F44336;
    background: #FFEBEE;
}

.code-label {
    color: #C62828;
}

.voucher-info {
    background: #FFEBEE;
}

.info-label {
    color: #C62828;
}

.info-value {
    color: #B71C1C;
}

.price-value {
    color: #F44336;
}

.duration-value, .validity-value {
    color: #E57373;
}

.voucher-footer {
    background: #FFEBEE;
    border-top: 1px solid #FFCDD2;
}

.login-url {
    color: #F44336;
}`;
    } else if (nameLower.includes('mikhmon')) {
        // Mikhmon style - classic simple
        designCSS = `
.voucher-container {
    background: #ffffff;
    border: 1px solid #dee2e6;
}

.voucher-header {
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
}

.company-name {
    color: #212529;
}

.voucher-body {
    background: #ffffff;
}

.voucher-code {
    color: #495057;
    border: 1px solid #adb5bd;
    background: #ffffff;
}

.code-label {
    color: #6c757d;
}

.voucher-info {
    background: #f8f9fa;
}

.info-label {
    color: #6c757d;
}

.info-value {
    color: #212529;
}

.price-value {
    color: #495057;
}

.duration-value, .validity-value {
    color: #28a745;
}

.voucher-footer {
    background: #f8f9fa;
    border-top: 1px solid #dee2e6;
}

.login-url {
    color: #495057;
}`;
    } else {
        // Default - simple white with gray accents
        designCSS = `
.voucher-container {
    background: #ffffff;
    border: 1px solid #e0e0e0;
}

.voucher-header {
    background: #f5f5f5;
    border-bottom: 1px solid #e0e0e0;
}

.company-name {
    color: #212121;
}

.voucher-body {
    background: #ffffff;
}

.voucher-code {
    color: #424242;
    border: 1px dashed #9e9e9e;
    background: #fafafa;
}

.code-label {
    color: #757575;
}

.voucher-info {
    background: #fafafa;
}

.info-label {
    color: #757575;
}

.info-value {
    color: #212121;
}

.price-value {
    color: #424242;
}

.duration-value, .validity-value {
    color: #4caf50;
}

.voucher-footer {
    background: #f5f5f5;
    border-top: 1px solid #e0e0e0;
}

.login-url {
    color: #424242;
}`;
    }
    
    // HTML structure - sama untuk semua template
    const htmlStructure = `
{foreach $v as $vs} <!-- DON'T REMOVE THIS LINE -->
<div class="voucher-container">
    <div class="voucher-header">
        {if $vs['logo_url'] neq ''}
        <img src="{$vs['logo_url']}" alt="Logo" class="voucher-logo" onerror="this.style.display='none';">
        {/if}
        <p class="company-name">{$vs['company_name']}</p>
    </div>
    
    <div class="voucher-body">
        <!-- Voucher Code -->
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
                <span class="info-value duration-value">{$vs['timelimit_display']}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Validity</span>
                <span class="info-value validity-value">{$vs['validity_display']}</span>
            </div>
        </div>
    </div>
    
    <div class="voucher-footer">
        <p class="login-url">Web Login : http://{$hotspotdns}</p>
    </div>
</div>
{/foreach} <!-- DON'T REMOVE THIS LINE -->`;
    
    // Combine semua bagian
    template = `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
${baseCSS}
${designCSS}
${baseStructure.printCSS}
</style>

${htmlStructure}
{include file="rad-template-footer.tpl"} <!-- DON'T REMOVE THIS LINE -->`;
    
    return template;
}

// Main function
db.serialize(() => {
    // Pastikan tabel ada
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
        
        console.log('📦 Updating all voucher templates...\n');
        
        // Ambil semua template dari database
        db.all(
            'SELECT id, template_name FROM voucher_print_templates WHERE status = ?',
            ['enabled'],
            (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching templates:', err);
                    db.close();
                    process.exit(1);
                }
                
                if (!rows || rows.length === 0) {
                    console.log('⚠️  No templates found in database');
                    db.close();
                    process.exit(0);
                }
                
                console.log(`Found ${rows.length} template(s) to update:\n`);
                
                let updated = 0;
                let failed = 0;
                
                // Update setiap template
                rows.forEach((row, index) => {
                    const newTemplateCode = generateTemplate(row.template_name, null);
                    
                    db.run(
                        'UPDATE voucher_print_templates SET template_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [newTemplateCode, row.id],
                        function(updateErr) {
                            if (updateErr) {
                                console.error(`❌ Error updating template "${row.template_name}":`, updateErr.message);
                                failed++;
                            } else {
                                console.log(`✅ Updated: ${row.template_name}`);
                                updated++;
                            }
                            
                            // Jika semua sudah selesai
                            if (updated + failed === rows.length) {
                                console.log(`\n📊 Summary:`);
                                console.log(`   ✅ Updated: ${updated}`);
                                console.log(`   ❌ Failed: ${failed}`);
                                console.log(`\n✨ All templates have been updated with:`);
                                console.log(`   • Size: 6cm x 4cm (landscape)`);
                                console.log(`   • Complete information (logo, company, code, price, duration, validity, web login)`);
                                console.log(`   • Print-ready CSS`);
                                console.log(`   • Design style preserved for each template`);
                                db.close();
                                process.exit(failed > 0 ? 1 : 0);
                            }
                        }
                    );
                });
            }
        );
    });
});
