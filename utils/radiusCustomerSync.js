const logger = require('../config/logger');
const { getUserAuthModeAsync, getRadiusConnection } = require('../config/mikrotik');

function normalizeGroupName(profile) {
    if (!profile || typeof profile !== 'string') return null;
    return profile.toLowerCase().trim().replace(/\s+/g, '_');
}

function sanitizeIp(value) {
    if (!value || typeof value !== 'string') return null;
    const ip = value.trim();
    if (!ip) return null;
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    return ipv4.test(ip) ? ip : null;
}

/**
 * Sync customer PPPoE auth data from billing to RADIUS SQL tables.
 * - radcheck: Cleartext-Password
 * - radusergroup: package/profile mapping
 * - radreply: Framed-IP-Address (optional)
 */
async function syncCustomerToRadius(customer, options = {}) {
    const pppoeUsername = String(customer?.pppoe_username || customer?.username || '').trim();
    const pppoePassword = String(options.pppoe_password || options.password || '').trim();
    const groupname = normalizeGroupName(options.pppoe_profile || customer?.pppoe_profile || null);
    const framedIp = sanitizeIp(options.static_ip || options.assigned_ip || customer?.static_ip || customer?.assigned_ip || null);

    if (!pppoeUsername) {
        return { success: false, skipped: true, message: 'PPPoE username kosong, skip sync RADIUS' };
    }

    const authMode = await getUserAuthModeAsync();
    if (authMode !== 'radius') {
        return { success: false, skipped: true, message: `Mode auth ${authMode}, sync RADIUS di-skip` };
    }

    let conn;
    try {
        conn = await getRadiusConnection();

        if (pppoePassword) {
            await conn.execute(
                "INSERT INTO radcheck (username, attribute, op, value) VALUES (?, 'Cleartext-Password', ':=', ?) ON CONFLICT(username, attribute) DO UPDATE SET op = excluded.op, value = excluded.value",
                [pppoeUsername, pppoePassword]
            );
        } else {
            const [existingPassword] = await conn.execute(
                "SELECT id FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password' LIMIT 1",
                [pppoeUsername]
            );
            if (!existingPassword || existingPassword.length === 0) {
                return {
                    success: false,
                    skipped: true,
                    message: `Password PPPoE untuk ${pppoeUsername} tidak tersedia, radcheck tidak bisa dibuat`
                };
            }
        }

        if (groupname) {
            await conn.execute("DELETE FROM radusergroup WHERE username = ?", [pppoeUsername]);
            await conn.execute(
                "INSERT INTO radusergroup (username, groupname, priority) VALUES (?, ?, 1)",
                [pppoeUsername, groupname]
            );
        }

        if (framedIp) {
            await conn.execute(
                "INSERT INTO radreply (username, attribute, op, value) VALUES (?, 'Framed-IP-Address', ':=', ?) ON CONFLICT(username, attribute) DO UPDATE SET op = excluded.op, value = excluded.value",
                [pppoeUsername, framedIp]
            );
        }

        logger.info(`[RADIUS-SYNC] Synced billing customer ${pppoeUsername} to RADIUS`);
        return { success: true, username: pppoeUsername };
    } catch (error) {
        logger.error(`[RADIUS-SYNC] Failed sync for ${pppoeUsername}: ${error.message}`);
        return { success: false, message: error.message };
    } finally {
        if (conn) {
            try {
                await conn.end();
            } catch (_) {}
        }
    }
}

module.exports = {
    syncCustomerToRadius
};
