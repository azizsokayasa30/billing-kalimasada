/**
 * Utility untuk sync password FreeRADIUS dengan password dari database billing
 * Ini memastikan password di FreeRADIUS config sesuai dengan password yang digunakan aplikasi billing
 */

const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const { getRadiusConfig } = require('../config/radiusConfig');
const logger = require('../config/logger');

const execAsync = promisify(exec);

const FREERADIUS_SQL_CONFIG = '/etc/freeradius/3.0/mods-available/sql';

/**
 * Sync password FreeRADIUS dengan password dari database billing
 * @returns {Promise<{success: boolean, message: string, oldPassword?: string, newPassword?: string}>}
 */
async function syncRadiusPassword() {
    try {
        // 1. Get password dari database billing
        const config = await getRadiusConfig();
        const billingPassword = config.radius_password || '';
        
        if (!billingPassword) {
            throw new Error('Password RADIUS tidak ditemukan di database billing');
        }
        
        // 2. Read FreeRADIUS config file
        let configContent = await fs.readFile(FREERADIUS_SQL_CONFIG, 'utf8');
        
        // 3. Extract current password
        const passwordMatch = configContent.match(/password\s*=\s*"([^"]+)"/);
        const oldPassword = passwordMatch ? passwordMatch[1] : null;
        
        // 4. Check if password already matches
        if (oldPassword === billingPassword) {
            return {
                success: true,
                message: 'Password sudah sinkron, tidak perlu update',
                oldPassword: oldPassword,
                newPassword: billingPassword
            };
        }
        
        // 5. Update password in config
        const updatedContent = configContent.replace(
            /password\s*=\s*"[^"]+"/,
            `password = "${billingPassword}"`
        );
        
        // 6. Write updated config
        await fs.writeFile(FREERADIUS_SQL_CONFIG, updatedContent, 'utf8');
        
        // 7. Fix permissions
        await execAsync(`chown freerad:freerad ${FREERADIUS_SQL_CONFIG}`);
        await execAsync(`chmod 640 ${FREERADIUS_SQL_CONFIG}`);
        
        logger.info(`Password FreeRADIUS diupdate: ${oldPassword ? '***' : '(kosong)'} -> ***`);
        
        // 8. Restart FreeRADIUS
        try {
            await execAsync('systemctl restart freeradius');
            logger.info('FreeRADIUS berhasil direstart setelah sync password');
        } catch (error) {
            logger.warn(`Gagal restart FreeRADIUS: ${error.message}`);
            // Continue even if restart fails
        }
        
        return {
            success: true,
            message: 'Password FreeRADIUS berhasil disinkronkan dengan password database billing',
            oldPassword: oldPassword,
            newPassword: billingPassword
        };
        
    } catch (error) {
        logger.error('Error syncing RADIUS password:', error);
        return {
            success: false,
            message: `Gagal sync password: ${error.message}`
        };
    }
}

/**
 * Check if password is synced
 * @returns {Promise<{synced: boolean, billingPassword?: string, freeradiusPassword?: string}>}
 */
async function checkPasswordSync() {
    try {
        // Get password dari database billing
        const config = await getRadiusConfig();
        const billingPassword = config.radius_password || '';
        
        // Read FreeRADIUS config
        const configContent = await fs.readFile(FREERADIUS_SQL_CONFIG, 'utf8');
        const passwordMatch = configContent.match(/password\s*=\s*"([^"]+)"/);
        const freeradiusPassword = passwordMatch ? passwordMatch[1] : null;
        
        return {
            synced: billingPassword === freeradiusPassword,
            billingPassword: billingPassword,
            freeradiusPassword: freeradiusPassword
        };
        
    } catch (error) {
        logger.error('Error checking password sync:', error);
        return {
            synced: false,
            error: error.message
        };
    }
}

module.exports = {
    syncRadiusPassword,
    checkPasswordSync
};

