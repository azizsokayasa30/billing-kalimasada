'use strict';

const { getTenantId, hasTenantContext } = require('./tenantContext');

/**
 * Append ` AND alias.tenant_id = ?` when request runs inside a tenant subdomain.
 */
function tenantWhere(alias = '') {
    if (!hasTenantContext()) return { sql: '', params: [] };
    const col = alias ? `${alias}.tenant_id` : 'tenant_id';
    return { sql: ` AND ${col} = ?`, params: [getTenantId()] };
}

function tenantWhereClause(alias = '') {
    const t = tenantWhere(alias);
    if (!t.sql) return { sql: '', params: [] };
    return { sql: t.sql.replace(/^ AND /, ' WHERE '), params: t.params };
}

function scopedTenantId() {
    return getTenantId();
}

function appendTenantToInsert(columns, placeholders, values) {
    if (!hasTenantContext()) {
        return { columns, placeholders, values };
    }
    return {
        columns: `${columns}, tenant_id`,
        placeholders: `${placeholders}, ?`,
        values: [...values, getTenantId()],
    };
}

function mergeSql(baseSql, baseParams = [], alias = '') {
    const t = tenantWhere(alias);
    return { sql: baseSql + t.sql, params: [...baseParams, ...t.params] };
}

module.exports = {
    tenantWhere,
    tenantWhereClause,
    scopedTenantId,
    appendTenantToInsert,
    mergeSql,
    getTenantId,
    hasTenantContext,
};
