const { looksLikePasswordHashNotCleartext } = require('./passwordHashHeuristic');

/**
 * Kebijakan sandi PPPoE operasional (teknisi / API mobile / form instalasi):
 * — Selaras dengan `/admin/mikrotik`: mode **RADIUS** → `radcheck` cleartext; mode **Mikrotik**
 *   → `/ppp/secret` di setiap NAS (`routers`). Jika sumber utama kosong, coba sumber lain
 *   (sinkron tidak sempurna antar RADIUS ↔ router).
 * — DILARANG memakai `customers.password` (portal / bcrypt) sebagai sandi PPPoE.
 */

/**
 * @param {string|null|undefined} pppoeUsername
 * @returns {Promise<string|null>} cleartext operasional (RADIUS dan/atau Mikrotik), atau null
 */
async function resolvePppoeCleartextFromRadiusOnly(pppoeUsername) {
    const u = (pppoeUsername && String(pppoeUsername).trim()) || '';
    if (!u) return null;

    let getRadcheckCleartextPassword;
    let getUserAuthModeAsync;
    let getPppSecretCleartextPasswordFromMikrotikRouters;
    try {
        ({
            getRadcheckCleartextPassword,
            getUserAuthModeAsync,
            getPppSecretCleartextPasswordFromMikrotikRouters
        } = require('../config/mikrotik'));
    } catch (e) {
        return null;
    }

    let mode = 'mikrotik';
    try {
        if (typeof getUserAuthModeAsync === 'function') {
            const raw = await getUserAuthModeAsync();
            mode = String(raw == null ? 'mikrotik' : raw).toLowerCase().trim() || 'mikrotik';
        }
    } catch (e) {
        mode = 'mikrotik';
    }

    const fromRadius = async () => {
        if (typeof getRadcheckCleartextPassword !== 'function') return null;
        try {
            const raw = await getRadcheckCleartextPassword(u);
            if (raw == null || String(raw).trim() === '') return null;
            const t = String(raw).trim();
            if (looksLikePasswordHashNotCleartext(t)) return null;
            return t;
        } catch (e) {
            return null;
        }
    };

    const fromMikrotik = async () => {
        if (typeof getPppSecretCleartextPasswordFromMikrotikRouters !== 'function') return null;
        try {
            const v = await getPppSecretCleartextPasswordFromMikrotikRouters(u);
            return v && String(v).trim() !== '' ? String(v).trim() : null;
        } catch (e) {
            return null;
        }
    };

    if (mode === 'radius') {
        const r = await fromRadius();
        if (r) return r;
        const m = await fromMikrotik();
        return m || null;
    }

    const mFirst = await fromMikrotik();
    if (mFirst) return mFirst;
    const rSecond = await fromRadius();
    return rSecond || null;
}

module.exports = {
    resolvePppoeCleartextFromRadiusOnly
};
