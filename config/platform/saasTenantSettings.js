'use strict';

/** Field informasi pembayaran — selalu tampil di Pengaturan Umum (default kosong). */
const TENANT_PAYMENT_SETTING_KEYS = [
    'payment_bank_name',
    'payment_account_holder',
    'payment_account_number',
    'payment_cash_address',
    'payment_cash_hours',
    'invoice_notes',
];

/** Key minimal yang disimpan saat tenant baru dibuat — tanpa data legacy sourcecode. */
const SAAS_TENANT_CORE_KEYS = new Set([
    'admin_username',
    'admin_password',
    'company_header',
    'company_name',
    'app_name',
    'logo_filename',
    'footer_info',
    'contact_phone',
    'contact_whatsapp',
    'contact_email',
    'server_port',
    'timezone',
    ...TENANT_PAYMENT_SETTING_KEYS,
]);

function emptyPaymentSettings() {
    return Object.fromEntries(TENANT_PAYMENT_SETTING_KEYS.map((k) => [k, '']));
}

function loadLegacyContactEmail() {
    try {
        const fs = require('fs');
        const path = require('path');
        const templatePath = path.join(__dirname, '../../settings.server.template.json');
        if (!fs.existsSync(templatePath)) return '';
        const parsed = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        return String(parsed?.contact_email || '').trim();
    } catch (_) {
        return '';
    }
}

function resolveTenantContactEmail(tenant, stored = {}) {
    const ownerEmail = String(tenant?.owner_email || '').trim();
    const fromStored = String(stored?.contact_email || '').trim();
    if (!fromStored) return ownerEmail;
    const legacyEmail = loadLegacyContactEmail();
    if (legacyEmail && fromStored === legacyEmail) return ownerEmail || fromStored;
    if (fromStored === 'alijayanet@gmail.com' && ownerEmail) return ownerEmail;
    return fromStored;
}

function buildMinimalSettingsForTenant(tenant) {
    const name = String(tenant?.name || 'Tenant').trim();
    const year = new Date().getFullYear();
    const creds = tenant?.settings || {};
    return {
        admin_username: creds.admin_username || tenant?.admin_username || 'admin',
        admin_password: creds.admin_password || tenant?.admin_password,
        company_header: creds.company_header || name,
        company_name: creds.company_name || name,
        app_name: creds.app_name || name,
        logo_filename: creds.logo_filename || 'logo.png',
        footer_info: creds.footer_info || `© ${year} ${name}`,
        contact_phone: creds.contact_phone || tenant?.owner_phone || '',
        contact_whatsapp: creds.contact_whatsapp || tenant?.owner_phone || '',
        contact_email: resolveTenantContactEmail(tenant, creds),
        server_port: creds.server_port || process.env.PORT || '4555',
        timezone: creds.timezone || 'Asia/Jakarta',
        ...emptyPaymentSettings(),
        ...TENANT_PAYMENT_SETTING_KEYS.reduce((acc, key) => {
            if (creds[key] !== undefined && creds[key] !== null) acc[key] = creds[key];
            return acc;
        }, {}),
    };
}

/** Gabungkan settings tenant dengan fallback branding — tanpa template legacy. */
function mergeTenantSettingsForDisplay(tenant) {
    if (!tenant) return {};
    const stored = tenant.settings && typeof tenant.settings === 'object' ? tenant.settings : {};
    const merged = { ...buildMinimalSettingsForTenant(tenant), ...stored };
    merged.contact_email = resolveTenantContactEmail(tenant, merged);
    merged.contact_phone = merged.contact_phone || tenant.owner_phone || '';
    merged.contact_whatsapp = merged.contact_whatsapp || tenant.owner_phone || '';
    return merged;
}

function pickSidebarBranding(settings, tenantName = 'Kalimasada Billing') {
    const s = settings || {};
    const name = s.company_header || s.company_name || s.app_name || tenantName;
    return {
        logo_filename: s.logo_filename || 'logo.png',
        company_header: name,
        company_name: s.company_name || name,
        app_name: s.app_name || name,
        footer_info: s.footer_info || '',
    };
}

/**
 * Hapus key yang hanya salinan template legacy (JINOM / sourcecode lama).
 * Pertahankan core branding + key yang nilainya beda dari template.
 */
function scrubLegacyTemplateKeys(stored, legacyTemplate) {
    if (!stored || typeof stored !== 'object') return {};
    const template = legacyTemplate && typeof legacyTemplate === 'object' ? legacyTemplate : {};
    const out = {};

    Object.keys(stored).forEach((key) => {
        const val = stored[key];
        if (SAAS_TENANT_CORE_KEYS.has(key)) {
            out[key] = val;
            return;
        }
        if (!(key in template)) {
            out[key] = val;
            return;
        }
        try {
            if (JSON.stringify(template[key]) !== JSON.stringify(val)) {
                out[key] = val;
            }
        } catch (_) {
            if (template[key] !== val) out[key] = val;
        }
    });

    return out;
}

module.exports = {
    TENANT_PAYMENT_SETTING_KEYS,
    SAAS_TENANT_CORE_KEYS,
    emptyPaymentSettings,
    buildMinimalSettingsForTenant,
    mergeTenantSettingsForDisplay,
    pickSidebarBranding,
    scrubLegacyTemplateKeys,
    resolveTenantContactEmail,
};
