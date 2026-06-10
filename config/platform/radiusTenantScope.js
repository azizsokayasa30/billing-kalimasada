'use strict';

const TENANT_SCOPED_TABLES = [
    'radcheck',
    'radreply',
    'radusergroup',
    'radgroupcheck',
    'radgroupreply',
    'nas',
];

function shouldScopeRadiusByTenant() {
    try {
        const { hasTenantContext, isCentralHost } = require('./tenantContext');
        return hasTenantContext() && !isCentralHost();
    } catch (_) {
        return false;
    }
}

function resolveRadiusTenantId() {
    try {
        const { getTenantId } = require('./tenantContext');
        return getTenantId();
    } catch (_) {
        return 1;
    }
}

function sqlAlreadyScoped(sql) {
    return /\btenant_id\b/i.test(sql);
}

/**
 * Inject tenant_id filter into SQL touching shared RADIUS tables.
 * Used by radiusSQLite for reads/writes when a tenant context is active.
 */
function applyRadiusTenantScope(sql, params = []) {
    if (!shouldScopeRadiusByTenant()) {
        return { sql, params: Array.isArray(params) ? [...params] : [] };
    }
    if (sqlAlreadyScoped(sql)) {
        return { sql, params: Array.isArray(params) ? [...params] : [] };
    }

    const touches = TENANT_SCOPED_TABLES.some((t) => new RegExp(`\\b${t}\\b`, 'i').test(sql));
    if (!touches) {
        return { sql, params: Array.isArray(params) ? [...params] : [] };
    }

    const tenantId = resolveRadiusTenantId();
    let outSql = String(sql);
    let outParams = Array.isArray(params) ? [...params] : [];
    const upper = outSql.trim().toUpperCase();

    // INSERT handled in radiusSQLite (needs bound params)
    if (upper.startsWith('INSERT')) {
        return { sql: outSql, params: outParams };
    }

    // DELETE FROM nas / radcheck ...
    if (upper.startsWith('DELETE')) {
        if (/\bWHERE\b/i.test(outSql)) {
            outSql = outSql.replace(/\bWHERE\b/i, 'WHERE tenant_id = ? AND');
            outParams = [tenantId, ...outParams];
        } else {
            outSql = outSql.replace(/;\s*$/, '').trim() + ' WHERE tenant_id = ?';
            outParams = [...outParams, tenantId];
        }
        return { sql: outSql, params: outParams };
    }

    // UPDATE table SET ... WHERE
    if (upper.startsWith('UPDATE')) {
        if (/\bWHERE\b/i.test(outSql)) {
            outSql = outSql.replace(/\bWHERE\b/i, 'WHERE tenant_id = ? AND');
            outParams = [tenantId, ...outParams];
        } else {
            outSql = outSql.replace(/;\s*$/, '').trim() + ' WHERE tenant_id = ?';
            outParams = [...outParams, tenantId];
        }
        return { sql: outSql, params: outParams };
    }

    // SELECT — inject on every FROM tenant_table [alias] WHERE
    for (const table of TENANT_SCOPED_TABLES) {
        const aliasWhere = new RegExp(
            `(\\bFROM\\s+${table}\\s+(?:AS\\s+)?(\\w+)\\s+WHERE\\s+)`,
            'gi'
        );
        outSql = outSql.replace(aliasWhere, (match, prefix, alias) => {
            if (new RegExp(`\\b${alias}\\.tenant_id\\b`, 'i').test(outSql)) return match;
            return `${prefix}${alias}.tenant_id = ${tenantId} AND `;
        });

        const tableWhere = new RegExp(`(\\bFROM\\s+${table}\\s+WHERE\\s+)`, 'gi');
        outSql = outSql.replace(tableWhere, (match) => {
            if (/\btenant_id\b/i.test(match)) return match;
            return `${match}${table}.tenant_id = ${tenantId} AND `;
        });
    }

    if (/\btenant_id\b/i.test(outSql)) {
        return { sql: outSql, params: outParams };
    }

    // SELECT without WHERE on tenant table
    if (/\bWHERE\b/i.test(outSql)) {
        outSql = outSql.replace(/\bWHERE\b/i, 'WHERE tenant_id = ? AND');
        outParams = [tenantId, ...outParams];
    } else {
        const tail = outSql.match(/\s+(ORDER\s+BY|GROUP\s+BY|LIMIT|HAVING)\b/i);
        if (tail && tail.index != null) {
            outSql = `${outSql.slice(0, tail.index)} WHERE tenant_id = ? ${outSql.slice(tail.index)}`;
        } else {
            outSql = outSql.replace(/;\s*$/, '').trim() + ' WHERE tenant_id = ?';
        }
        outParams = [...outParams, tenantId];
    }

    return { sql: outSql, params: outParams };
}

module.exports = {
    TENANT_SCOPED_TABLES,
    shouldScopeRadiusByTenant,
    resolveRadiusTenantId,
    applyRadiusTenantScope,
};
