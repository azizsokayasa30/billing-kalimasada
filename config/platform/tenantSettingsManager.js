'use strict';

const path = require('path');
const tenantStore = require('./tenantStore');
const {
    buildMinimalSettingsForTenant,
    mergeTenantSettingsForDisplay,
    scrubLegacyTemplateKeys,
} = require('./saasTenantSettings');

/** Legacy template — hanya untuk scrub data tenant, BUKAN di-merge ke tenant SaaS. */
const LEGACY_TEMPLATE_PATH = path.join(__dirname, '../../settings.server.template.json');
const SAAS_TEMPLATE_PATH = path.join(__dirname, '../../settings.saas.tenant.template.json');

let legacyTemplateCache = null;
let saasTemplateCache = null;

function loadLegacyTemplateForScrub() {
    if (legacyTemplateCache) return { ...legacyTemplateCache };
    try {
        const fs = require('fs');
        if (fs.existsSync(LEGACY_TEMPLATE_PATH)) {
            legacyTemplateCache = JSON.parse(fs.readFileSync(LEGACY_TEMPLATE_PATH, 'utf8'));
            return { ...legacyTemplateCache };
        }
    } catch (e) {
        console.warn('[tenantSettings] legacy template load failed:', e.message);
    }
    legacyTemplateCache = {};
    return {};
}

function loadTemplateDefaults() {
    if (saasTemplateCache) return { ...saasTemplateCache };
    try {
        const fs = require('fs');
        if (fs.existsSync(SAAS_TEMPLATE_PATH)) {
            saasTemplateCache = JSON.parse(fs.readFileSync(SAAS_TEMPLATE_PATH, 'utf8'));
            return { ...saasTemplateCache };
        }
    } catch (e) {
        console.warn('[tenantSettings] saas template load failed:', e.message);
    }
    saasTemplateCache = {};
    return {};
}

function mergeSettings(defaults, overrides) {
    const base = { ...defaults };
    if (!overrides || typeof overrides !== 'object') return base;
    Object.keys(overrides).forEach((key) => {
        const val = overrides[key];
        if (val !== null && typeof val === 'object' && !Array.isArray(val)
            && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
            base[key] = { ...base[key], ...val };
        } else if (val !== undefined) {
            base[key] = val;
        }
    });
    return base;
}

function buildTenantOverrides(tenant) {
    return buildMinimalSettingsForTenant(tenant);
}

async function getFullSettingsForTenantId(tenantId) {
    const tenant = await tenantStore.getTenantById(tenantId);
    if (!tenant) return loadTemplateDefaults();
    return mergeTenantSettingsForDisplay(tenant);
}

async function saveFullSettingsForTenantId(tenantId, updates) {
    const tenant = await tenantStore.getTenantById(tenantId);
    if (!tenant) throw new Error('Tenant tidak ditemukan');

    const current = mergeTenantSettingsForDisplay(tenant);
    const merged = mergeSettings(current, updates);

    const toStore = { ...(tenant.settings || {}) };
    Object.keys(merged).forEach((key) => {
        toStore[key] = merged[key];
    });
    if (toStore.admin_password === undefined && tenant.settings?.admin_password) {
        toStore.admin_password = tenant.settings.admin_password;
    }
    if (toStore.admin_username === undefined) {
        toStore.admin_username = merged.admin_username || 'admin';
    }

    await tenantStore.updateTenantSettings(tenantId, toStore);
    return merged;
}

function seedSettingsForNewTenant(tenant) {
    return buildMinimalSettingsForTenant(tenant);
}

function scrubStoredTenantSettings(stored) {
    return scrubLegacyTemplateKeys(stored, loadLegacyTemplateForScrub());
}

module.exports = {
    loadTemplateDefaults,
    mergeSettings,
    getFullSettingsForTenantId,
    saveFullSettingsForTenantId,
    seedSettingsForNewTenant,
    buildTenantOverrides,
    scrubStoredTenantSettings,
};
