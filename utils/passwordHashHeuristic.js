/**
 * Mendeteksi string yang jelas bukan sandi PPPoE cleartext untuk teknisi
 * (mis. bcrypt/argon2 yang terlanjur masuk kolom value radcheck).
 */

/**
 * @param {string|null|undefined} s
 * @returns {boolean}
 */
function looksLikePasswordHashNotCleartext(s) {
    const t = (s && String(s).trim()) || '';
    if (!t) return false;
    if (/^\$2[aby]\$\d{2}\$/.test(t)) return true;
    if (/^\$argon2(id|i|d)\$/i.test(t)) return true;
    if (/^\$5\$/.test(t) || /^\$6\$/.test(t)) return true;
    if (/^\$1\$/.test(t)) return true;
    if (/^\{SHA\}/i.test(t) || /^\{SSHA/i.test(t)) return true;
    return false;
}

module.exports = { looksLikePasswordHashNotCleartext };
