// Functions untuk manage FreeRADIUS clients.conf
// Sekarang menggunakan RADIUS SQLite database sebagai primary storage
const fs = require('fs');
const { execSync } = require('child_process');
const logger = require('./logger');

const CLIENTS_CONF_PATH = '/etc/freeradius/3.0/clients.conf';

// Import RADIUS connection
const { getRadiusConnection } = require('./radiusSQLite');

/**
 * Initialize clients management using existing FreeRADIUS nas table
 * The nas table is already created in radiusSQLite.js schema
 */
async function initializeClientsTable() {
    try {
        const conn = await getRadiusConnection();
        // Table nas already exists from radiusSQLite.js schema
        // Just verify connection works
        const result = await conn.execute('SELECT COUNT(*) as count FROM nas');
        logger.info('[RADIUS-CLIENTS] Clients table ready - using nas table from FreeRADIUS schema');
        await conn.end();
        return true;
    } catch (error) {
        logger.error('[RADIUS-CLIENTS] Error verifying clients table:', error.message);
        return false;
    }
}

// Initialize table on load (non-blocking)
initializeClientsTable().catch(err => {
    logger.warn('[RADIUS-CLIENTS] Table initialization warning:', err.message);
    // Don't fail startup if initialization has issues
});

/**
 * Parse clients dari RADIUS SQLite database (primary)
 * Uses the nas table which stores FreeRADIUS NAS clients
 * Fallback ke file jika database tidak tersedia
 */
async function parseClientsConfFromDB() {
    try {
        const conn = await getRadiusConnection();
        // Query nas table: nasname=client name, community/shortname=IP, secret=shared secret
        const [rows] = await conn.execute(`
            SELECT id, nasname, shortname, type, secret, description 
            FROM nas 
            ORDER BY nasname
        `);
        await conn.end();
        
        if (rows && rows.length > 0) {
            logger.info(`[RADIUS-CLIENTS] Loaded ${rows.length} clients dari nas table`);
            return rows.map(row => ({
                id: row.id,
                name: row.shortname || row.nasname, // shortname contains the friendly name
                ipaddr: row.nasname, // nasname contains the IP address
                secret: row.secret || '',
                nas_type: row.type || 'other',
                require_message_authenticator: 'no',  // Default
                comment: row.description || null,
                fromDB: true
            }));
        }
        
        logger.warn('[RADIUS-CLIENTS] No clients found in nas table, attempting file read');
        const fileClients = await parseClientsConfFromFile();
        return fileClients;
    } catch (error) {
        logger.warn(`[RADIUS-CLIENTS] Database read failed, falling back to file: ${error.message}`);
        return await parseClientsConfFromFile();
    }
}

/**
 * Parse clients.conf file (fallback/compatibility)
 */
async function parseClientsConfFromFile() {
    try {
        if (!fs.existsSync(CLIENTS_CONF_PATH)) {
            logger.warn(`clients.conf not found at ${CLIENTS_CONF_PATH}`);
            return [];
        }

        // Try to read file directly first
        let content;
        try {
            content = fs.readFileSync(CLIENTS_CONF_PATH, 'utf8');
        } catch (readError) {
            // If direct read fails, try with sudo
            try {
                content = execSync(`sudo cat ${CLIENTS_CONF_PATH}`, { encoding: 'utf8' });
            } catch (sudoError) {
                logger.error(`Cannot read clients.conf: ${readError.message}`);
                throw new Error(`Tidak dapat membaca file clients.conf: ${readError.message}`);
            }
        }
        
        const clients = [];
        let currentClient = null;
        let inClientBlock = false;
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip comments and empty lines
            if (line.startsWith('#') || line === '') {
                continue;
            }

            // Detect client block start: "client name {" or "client ipaddr {"
            const clientMatch = line.match(/^client\s+([^\s{]+)\s*\{/);
            if (clientMatch) {
                if (currentClient) {
                    clients.push(currentClient);
                }
                currentClient = {
                    name: clientMatch[1],
                    ipaddr: null,
                    addrType: 'ipaddr', // Default type
                    secret: null,
                    nas_type: 'other',
                    require_message_authenticator: 'no',
                    comment: null,
                    rawLines: []
                };
                inClientBlock = true;
                currentClient.rawLines.push(lines[i]);
                continue;
            }

            // Detect client block end
            if (line === '}' && inClientBlock) {
                if (currentClient) {
                    currentClient.rawLines.push(lines[i]);
                    clients.push(currentClient);
                    currentClient = null;
                    inClientBlock = false;
                }
                continue;
            }

            // Parse client attributes
            if (inClientBlock && currentClient) {
                currentClient.rawLines.push(lines[i]);
                
                // Parse ipaddr, ipv4addr, or ipv6addr
                const addrMatch = line.match(/(ipaddr|ipv4addr|ipv6addr)\s*=\s*(.+)/);
                if (addrMatch) {
                    currentClient.addrType = addrMatch[1].trim();
                    currentClient.ipaddr = addrMatch[2].trim();
                }

                // Parse secret
                const secretMatch = line.match(/secret\s*=\s*(.+)/);
                if (secretMatch) {
                    currentClient.secret = secretMatch[1].trim();
                }

                // Parse nas_type
                const nasTypeMatch = line.match(/nas_type\s*=\s*(.+)/);
                if (nasTypeMatch) {
                    currentClient.nas_type = nasTypeMatch[1].trim();
                }

                // Parse require_message_authenticator
                const msgAuthMatch = line.match(/require_message_authenticator\s*=\s*(.+)/);
                if (msgAuthMatch) {
                    currentClient.require_message_authenticator = msgAuthMatch[1].trim();
                }

                // Parse comment (if exists)
                if (line.startsWith('#')) {
                    currentClient.comment = line.substring(1).trim();
                }
            }
        }

        // Add last client if exists
        if (currentClient) {
            clients.push(currentClient);
        }

        return clients;
    } catch (error) {
        logger.error(`Error parsing clients.conf: ${error.message}`);
        throw error;
    }
}

/**
 * Write clients array back to clients.conf file
 */
function writeClientsConf(clients) {
    try {
        // Backup original file
        const backupPath = `${CLIENTS_CONF_PATH}.backup.${Date.now()}`;
        let backupCreated = false;
        
        try {
            if (fs.existsSync(CLIENTS_CONF_PATH)) {
                // Try direct copy first
                try {
                    fs.copyFileSync(CLIENTS_CONF_PATH, backupPath);
                    backupCreated = true;
                } catch (copyError) {
                    // If direct copy fails, try with sudo
                    try {
                        execSync(`sudo cp ${CLIENTS_CONF_PATH} ${backupPath}`, { encoding: 'utf8' });
                        backupCreated = true;
                    } catch (sudoCopyError) {
                        logger.warn(`Cannot create backup: ${copyError.message}`);
                    }
                }
            }
        } catch (backupError) {
            logger.warn(`Backup failed: ${backupError.message}`);
        }
        
        if (backupCreated) {
            logger.info(`Backup created: ${backupPath}`);
        }

        // Read original file untuk preserve header comments
        let headerContent = '';
        if (fs.existsSync(CLIENTS_CONF_PATH)) {
            const originalContent = fs.readFileSync(CLIENTS_CONF_PATH, 'utf8');
            const headerMatch = originalContent.match(/^([\s\S]*?)(?=^client\s)/m);
            if (headerMatch) {
                headerContent = headerMatch[1];
            }
        }

        // Default header jika tidak ada
        if (!headerContent) {
            headerContent = `## clients.conf -- client configuration directives
##
##	\$Id\$

#######################################################################
#
#  Define RADIUS clients (usually a NAS, Access Point, etc.).
#
#  Clients configured via CVLMEDIA Web Interface
#  Generated: ${new Date().toISOString()}
#

`;
        }

        // Build clients section
        let clientsSection = '';
        clients.forEach(client => {
            // Safety check for localhost_ipv6
            if (client.name === 'localhost_ipv6' && !client.ipaddr) {
                client.ipaddr = '::1';
                client.addrType = 'ipv6addr';
            }

            clientsSection += `client ${client.name} {\n`;
            
            if (client.ipaddr) {
                // Determine address keyword
                let keyword = client.addrType || 'ipaddr';
                if (client.ipaddr.includes(':')) {
                    keyword = 'ipv6addr';
                }
                clientsSection += `\t${keyword} = ${client.ipaddr}\n`;
            } else if (client.name === 'localhost') {
                clientsSection += `\tipaddr = 127.0.0.1\n`;
            }

            if (client.secret) {
                clientsSection += `\tsecret = ${client.secret}\n`;
            }
            if (client.nas_type) {
                clientsSection += `\tnas_type = ${client.nas_type}\n`;
            }
            if (client.require_message_authenticator) {
                clientsSection += `\trequire_message_authenticator = ${client.require_message_authenticator}\n`;
            }
            if (client.comment) {
                clientsSection += `\t# ${client.comment}\n`;
            }
            clientsSection += `}\n\n`;
        });

        // Write to file
        const fullContent = headerContent + clientsSection;
        try {
            fs.writeFileSync(CLIENTS_CONF_PATH, fullContent, 'utf8');
        } catch (writeError) {
            // If direct write fails, try with sudo
            try {
                const tempFile = `/tmp/clients.conf.${Date.now()}`;
                fs.writeFileSync(tempFile, fullContent, 'utf8');
                execSync(`sudo cp ${tempFile} ${CLIENTS_CONF_PATH}`, { encoding: 'utf8' });
                fs.unlinkSync(tempFile);
            } catch (sudoWriteError) {
                logger.error(`Cannot write clients.conf: ${writeError.message}`);
                throw new Error(`Tidak dapat menulis file clients.conf: ${writeError.message}`);
            }
        }
        
        // Ensure secure permissions (not globally writable)
        try {
            // Try 640 (rw-r-----) or 660 (rw-rw----)
            const secureMode = 0o660; 
            fs.chmodSync(CLIENTS_CONF_PATH, secureMode);
            logger.info(`Set secure permissions (660) on clients.conf`);
        } catch (chmodError) {
            // If direct chmod fails, try with sudo
            try {
                execSync(`sudo chmod 660 ${CLIENTS_CONF_PATH}`);
                logger.info(`Set secure permissions (660) on clients.conf via sudo`);
            } catch (sudoChmodError) {
                logger.warn(`Could not set secure permissions: ${chmodError.message}. FreeRADIUS might fail start if globally writable.`);
            }
        }
        
        logger.info(`clients.conf updated successfully with ${clients.length} clients`);

        return true;
    } catch (error) {
        logger.error(`Error writing clients.conf: ${error.message}`);
        throw error;
    }
}

/**
 * Restart FreeRADIUS service
 */
function restartFreeRADIUS() {
    try {
        // Check if systemctl exists
        try {
            execSync('command -v systemctl', { stdio: 'ignore' });
        } catch (e) {
            logger.warn('systemctl not found. If running in Docker, please restart FreeRADIUS on the host manually.');
            return { 
                success: false, 
                message: 'systemctl tidak ditemukan. Jika Anda menggunakan Docker, silakan restart FreeRADIUS secara manual di host Ubuntu: sudo systemctl restart freeradius'
            };
        }

        // Try with sudo first
        try {
            execSync('sudo systemctl restart freeradius', { encoding: 'utf8', timeout: 10000 });
            logger.info('FreeRADIUS restarted successfully');
            return { success: true, message: 'FreeRADIUS berhasil direstart' };
        } catch (sudoError) {
            // If sudo fails, try without sudo (might work if running as root)
            try {
                execSync('systemctl restart freeradius', { encoding: 'utf8', timeout: 10000 });
                logger.info('FreeRADIUS restarted successfully (without sudo)');
                return { success: true, message: 'FreeRADIUS berhasil direstart' };
            } catch (directError) {
                logger.warn(`FreeRADIUS restart failed. Please restart manually: sudo systemctl restart freeradius`);
                return { 
                    success: false, 
                    message: 'Gagal restart FreeRADIUS secara otomatis. Silakan restart manual di host: sudo systemctl restart freeradius',
                    error: directError.message
                };
            }
        }
    } catch (error) {
        logger.error(`Error restarting FreeRADIUS: ${error.message}`);
        return { 
            success: false, 
            message: `Gagal restart FreeRADIUS: ${error.message}`,
            error: error.message
        };
    }
}

/**
 * Validate client data
 */
function validateClient(client) {
    const errors = [];

    if (!client.name || client.name.trim() === '') {
        errors.push('Client name diperlukan');
    }

    if (!client.ipaddr || client.ipaddr.trim() === '') {
        errors.push('IP address diperlukan');
    } else {
        // Simple IP validation
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
        if (!ipRegex.test(client.ipaddr.trim())) {
            errors.push('Format IP address tidak valid');
        }
    }

    if (!client.secret || client.secret.trim() === '') {
        errors.push('Secret diperlukan');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Write clients to RADIUS SQLite database using nas table
 * PRIMARY METHOD - replaces file writing
 */
async function writeClientsConfToDB(clients) {
    try {
        const conn = await getRadiusConnection();
        
        // Clear existing clients (truncate nas table)
        await conn.execute('DELETE FROM nas');
        
        // Insert new clients
        for (const client of clients) {
            if (!client.name || !client.secret) {
                logger.warn(`[RADIUS-CLIENTS] Skipping incomplete client: ${client.name}`);
                continue;
            }
            
            try {
                await conn.execute(`
                    INSERT INTO nas (nasname, shortname, type, secret, description)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    client.ipaddr || client.name, // nasname MUST be the IP address for FreeRADIUS to find it
                    client.name,                  // shortname is the friendly client name
                    client.nas_type || 'other',
                    client.secret,
                    client.comment || null
                ]);
            } catch (insertError) {
                logger.warn(`[RADIUS-CLIENTS] Error inserting client ${client.name}: ${insertError.message}`);
                // Continue with next client
            }
        }
        
        await conn.end();
        logger.info(`[RADIUS-CLIENTS] Saved ${clients.length} clients to nas table`);
        return true;
    } catch (error) {
        logger.error(`[RADIUS-CLIENTS] Error writing clients to database: ${error.message}`);
        throw error;
    }
}

/**
 * Wrapper sync function untuk backward compatibility (deprecated - gunakan async version)
 */
function parseClientsConf() {
    logger.warn('[RADIUS-CLIENTS] parseClientsConf() is deprecated. Use parseClientsConfFromDB() instead');
    // Return empty array or try read from file as fallback
    if (fs.existsSync(CLIENTS_CONF_PATH)) {
        try {
            const content = fs.readFileSync(CLIENTS_CONF_PATH, 'utf8');
            // Simple parse dari file
            const clients = [];
            let currentClient = null;
            const lines = content.split('\n');
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('client ') && trimmed.endsWith('{')) {
                    const nameMatch = trimmed.match(/^client\s+([^\s{]+)\s*\{/);
                    if (nameMatch) {
                        currentClient = {
                            name: nameMatch[1],
                            ipaddr: null,
                            secret: null,
                            nas_type: 'other',
                            require_message_authenticator: 'no'
                        };
                    }
                } else if (trimmed === '}' && currentClient) {
                    clients.push(currentClient);
                    currentClient = null;
                } else if (currentClient) {
                    const ipMatch = trimmed.match(/(ipaddr|ipv4addr|ipv6addr)\s*=\s*(.+)/);
                    if (ipMatch) currentClient.ipaddr = ipMatch[2].trim();
                    
                    const secretMatch = trimmed.match(/secret\s*=\s*(.+)/);
                    if (secretMatch) currentClient.secret = secretMatch[1].trim();
                    
                    const typeMatch = trimmed.match(/nas_type\s*=\s*(.+)/);
                    if (typeMatch) currentClient.nas_type = typeMatch[1].trim();
                }
            }
            
            logger.info(`[RADIUS-CLIENTS] Loaded ${clients.length} clients from file (sync fallback)`);
            return clients;
        } catch (error) {
            logger.error(`[RADIUS-CLIENTS] Error reading file sync: ${error.message}`);
            return [];
        }
    }
    return [];
}

module.exports = {
    initializeClientsTable,
    parseClientsConf,
    parseClientsConfFromDB,
    parseClientsConfFromFile,
    writeClientsConf,
    writeClientsConfToDB,
    restartFreeRADIUS,
    validateClient,
    CLIENTS_CONF_PATH
};

