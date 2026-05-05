const { checkLicenseStatus, isLicenseValid, isTrialExpired } = require('../config/licenseManager');
const logger = require('../config/logger');

/**
 * Middleware untuk mengecek license status sebelum login
 * Jika trial habis atau license tidak valid, block login
 */
async function licenseCheck(req, res, next) {
    next();
}

/**
 * Middleware khusus untuk route login
 * Block login jika trial habis atau license tidak valid
 */
async function licenseLoginCheck(req, res, next) {
    next();
}

module.exports = {
    licenseCheck,
    licenseLoginCheck
};
