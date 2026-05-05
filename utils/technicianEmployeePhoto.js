'use strict';

const { getPublicAppBaseUrl } = require('../config/public-endpoint');

function digitsOnly(s) {
    return String(s || '').replace(/\D/g, '');
}

/** Varian nomor untuk cocokkan no_hp karyawan ↔ phone teknisi */
function phoneDigitVariants(phone) {
    const d = digitsOnly(phone);
    if (!d || d.length < 8) return [];
    const s = new Set([d]);
    if (d.startsWith('62') && d.length > 2) s.add('0' + d.slice(2));
    if (d.startsWith('0') && d.length > 2) s.add('62' + d.slice(1));
    return [...s];
}

/**
 * Cari foto karyawan yang dipetakan ke teknisi (nama sama, atau nomor sama).
 * @param {import('sqlite3').Database} db
 * @param {{ name?: string, phone?: string }} technicianRow
 * @param {(err: Error|null, fotoPath: string|null) => void} callback
 */
function resolveEmployeePhotoPath(db, technicianRow, callback) {
    const name = String(technicianRow.name || '').trim();
    const variants = phoneDigitVariants(technicianRow.phone);

    const finishPhone = () => {
        if (variants.length === 0) {
            return process.nextTick(() => callback(null, null));
        }
        const qs = variants.map(() => '?').join(',');
        db.get(
            `SELECT foto_path FROM employees
             WHERE LOWER(IFNULL(status, '')) != 'nonaktif'
               AND foto_path IS NOT NULL AND TRIM(foto_path) != ''
               AND REPLACE(REPLACE(REPLACE(IFNULL(no_hp, ''), ' ', ''), '-', ''), '+', '') IN (${qs})
             LIMIT 1`,
            variants,
            (e2, r2) => {
                if (e2) return callback(e2);
                callback(null, (r2 && r2.foto_path) || null);
            }
        );
    };

    if (name) {
        db.get(
            `SELECT foto_path FROM employees
             WHERE LOWER(IFNULL(status, '')) != 'nonaktif'
               AND foto_path IS NOT NULL AND TRIM(foto_path) != ''
               AND LOWER(TRIM(nama_lengkap)) = LOWER(?)
             LIMIT 1`,
            [name],
            (err, row) => {
                if (err) return callback(err);
                if (row && row.foto_path) return callback(null, row.foto_path);
                finishPhone();
            }
        );
        return;
    }

    finishPhone();
}

/** URL absolut untuk gambar di aplikasi mobile */
function buildPhotoUrl(relPath) {
    if (!relPath || typeof relPath !== 'string') return null;
    const p = relPath.startsWith('/') ? relPath : `/${relPath}`;
    const base = getPublicAppBaseUrl().replace(/\/+$/, '');
    return `${base}${p}`;
}

module.exports = {
    resolveEmployeePhotoPath,
    buildPhotoUrl,
    digitsOnly,
    phoneDigitVariants,
};
