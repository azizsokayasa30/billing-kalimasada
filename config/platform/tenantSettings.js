'use strict';

const { getTenant, hasTenantContext } = require('./tenantContext');
const { getSetting } = require('../settingsManager');

/**
 * Tenant-scoped settings: tenants.settings JSON first, fallback global settings.json.
 */
function getTenantSetting(key, defaultValue = null) {
    if (hasTenantContext()) {
        const tenant = getTenant();
        if (tenant?.settings && tenant.settings[key] !== undefined && tenant.settings[key] !== null) {
            return tenant.settings[key];
        }
    }
    return getSetting(key, defaultValue);
}

function getTenantBranding() {
    const { hasTenantContext, getTenant } = require('./tenantContext');
    const tenantName = hasTenantContext() ? (getTenant()?.name || 'Kalimasada Billing') : 'Kalimasada Billing';
    return {
        company_header: getTenantSetting('company_header', tenantName),
        company_name: getTenantSetting('company_name', tenantName),
        logo_filename: getTenantSetting('logo_filename', 'logo.png'),
        footer_info: getTenantSetting('footer_info', ''),
        contact_phone: getTenantSetting('contact_phone', ''),
    };
}

module.exports = {
    getTenantSetting,
    getTenantBranding,
};
