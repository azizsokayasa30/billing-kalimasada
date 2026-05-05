// Functions untuk manage FreeRADIUS clients.conf
// Sekarang menggunakan RADIUS SQLite database sebagai primary storage
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('./logger');

const CLIENTS_CONF_PATH = '/etc/freeradius/3.0/clients.conf';
const APP_ROOT = path.join(__dirname, '..');
const CLIENTS_CONF_MIRROR = path.join(APP_ROOT, 'data', 'clients.conf.mirror');

/** Terakhir hasil baca clients.conf (untuk pesan di UI) */
let _clientsConfReadDiag = {
    ok: false,
    sourcePath: null,
    attempted: [],
    hint: null
};

function getRadiusClientsConfReadDiagnostics() {
    return { ..._clientsConfReadDiag };
}

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
 * Parse clients: gabungan tabel nas (SQLite) + /etc/freeradius/3.0/clients.conf.
 * - Tampilan aplikasi = union keduanya (dedupe per IP / nama).
 * - Jika nas kosong tetapi clients.conf berisi client, isi ulang nas otomatis agar konsisten dengan FR.
 * - Simpan dari UI menulis clients.conf DAN nas (lihat writeClientsConfToDB).
 */
async function parseClientsConfFromDB() {
    let dbRows = [];
    try {
        const conn = await getRadiusConnection();
        const [rows] = await conn.execute(`
            SELECT id, nasname, shortname, type, secret, description
            FROM nas
            ORDER BY nasname
        `);
        dbRows = Array.isArray(rows) ? rows : [];
    } catch (error) {
        logger.warn(`[RADIUS-CLIENTS] Gagal baca nas: ${error.message}`);
        dbRows = [];
    }

    const dbClients = dbRows.map(mapNasRowToClient);
    const fileClients = await parseClientsConfFromFile();
    const merged = mergeClientsFromDbAndFile(dbClients, fileClients);

    if (dbRows.length === 0 && fileClients.length > 0) {
        try {
            await replaceNasTable(merged);
            logger.info(
                `[RADIUS-CLIENTS] nas kosong — disinkronkan dari clients.conf (${merged.length} client)`
            );
        } catch (e) {
            logger.warn(`[RADIUS-CLIENTS] Auto-sync nas dari file gagal: ${e.message}`);
        }
    }

    if (merged.length > 0) {
        logger.info(`[RADIUS-CLIENTS] Daftar gabungan: ${merged.length} client (nas + clients.conf)`);
    }
    return merged;
}

/**
 * Baca teks clients.conf: mirror (bisa dibaca PM2) → /etc → sudo -n cat.
 * Proses Node biasanya bukan root sehingga /etc/... sering EACCES tanpa mirror atau NOPASSWD sudo.
 */
function readRadiusClientsConfTextWithMeta() {
    const attempted = [];
    const candidates = [];
    const envMirror = process.env.RADIUS_CLIENTS_CONF_MIRROR && String(process.env.RADIUS_CLIENTS_CONF_MIRROR).trim();
    if (envMirror) {
        candidates.push(path.resolve(envMirror));
    }
    candidates.push(CLIENTS_CONF_MIRROR);
    candidates.push(CLIENTS_CONF_PATH);

    for (const p of candidates) {
        if (!p) continue;
        attempted.push(p);
        try {
            if (fs.existsSync(p)) {
                fs.accessSync(p, fs.constants.R_OK);
                const content = fs.readFileSync(p, 'utf8');
                if (content && content.includes('client ')) {
                    _clientsConfReadDiag = {
                        ok: true,
                        sourcePath: p,
                        attempted: [...attempted],
                        hint: null
                    };
                    return { content, diag: _clientsConfReadDiag };
                }
            }
        } catch (e) {
            logger.debug(`[RADIUS-CLIENTS] Lewati baca ${p}: ${e.message}`);
        }
    }

    try {
        const out = execSync(`sudo -n cat ${CLIENTS_CONF_PATH}`, {
            encoding: 'utf8',
            maxBuffer: 2 * 1024 * 1024,
            timeout: 5000
        });
        if (out && out.includes('client ')) {
            _clientsConfReadDiag = {
                ok: true,
                sourcePath: `${CLIENTS_CONF_PATH} (sudo -n)`,
                attempted: [...attempted, 'sudo -n cat'],
                hint: null
            };
            return { content: out, diag: _clientsConfReadDiag };
        }
    } catch (e) {
        attempted.push(`sudo -n cat (${e.message})`);
    }

    const hint =
        'Billing (PM2) tidak bisa membaca /etc/freeradius/3.0/clients.conf. Salin mirror ke folder aplikasi (sekali setelah ubah FR), lalu restart PM2:\n' +
        `  npm run radius:mirror-clients\n` +
        'atau manual:\n' +
        `  sudo cp ${CLIENTS_CONF_PATH} ${CLIENTS_CONF_MIRROR} && sudo chown $(whoami):$(whoami) ${CLIENTS_CONF_MIRROR} && chmod 640 ${CLIENTS_CONF_MIRROR}\n` +
        'Opsi: set env RADIUS_CLIENTS_CONF_MIRROR ke path file salinan yang bisa dibaca user proses Node.';
    _clientsConfReadDiag = { ok: false, sourcePath: null, attempted, hint };
    logger.warn(`[RADIUS-CLIENTS] clients.conf tidak terbaca oleh proses Node. ${hint.split('\n')[0]}`);
    return { content: null, diag: _clientsConfReadDiag };
}

function parseClientsConfContent(content) {
    if (!content || typeof content !== 'string') return [];

    const clients = [];
    let currentClient = null;
    let inClientBlock = false;
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('#') || line === '') {
            continue;
        }

        const clientMatch = line.match(/^client\s+([^\s{]+)\s*\{/);
        if (clientMatch) {
            if (currentClient) {
                clients.push(currentClient);
            }
            currentClient = {
                name: clientMatch[1],
                ipaddr: null,
                addrType: 'ipaddr',
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

        if (line === '}' && inClientBlock) {
            if (currentClient) {
                currentClient.rawLines.push(lines[i]);
                clients.push(currentClient);
                currentClient = null;
                inClientBlock = false;
            }
            continue;
        }

        if (inClientBlock && currentClient) {
            currentClient.rawLines.push(lines[i]);

            const addrMatch = line.match(/(ipaddr|ipv4addr|ipv6addr)\s*=\s*(.+)/);
            if (addrMatch) {
                currentClient.addrType = addrMatch[1].trim();
                currentClient.ipaddr = addrMatch[2].trim();
            }

            const secretMatch = line.match(/secret\s*=\s*(.+)/);
            if (secretMatch) {
                currentClient.secret = secretMatch[1].trim();
            }

            const nasTypeMatch = line.match(/nas_type\s*=\s*(.+)/);
            if (nasTypeMatch) {
                currentClient.nas_type = nasTypeMatch[1].trim();
            }

            const msgAuthMatch = line.match(/require_message_authenticator\s*=\s*(.+)/);
            if (msgAuthMatch) {
                currentClient.require_message_authenticator = msgAuthMatch[1].trim();
            }

            if (line.startsWith('#')) {
                currentClient.comment = line.substring(1).trim();
            }
        }
    }

    if (currentClient) {
        clients.push(currentClient);
    }

    return clients.map((c) => ({
        name: c.name,
        ipaddr: c.ipaddr,
        addrType: c.addrType || 'ipaddr',
        secret: c.secret,
        nas_type: c.nas_type || 'other',
        require_message_authenticator: c.require_message_authenticator || 'no',
        comment: c.comment
    }));
}

/**
 * Parse clients.conf (isi dari mirror atau /etc atau sudo -n).
 */
async function parseClientsConfFromFile() {
    try {
        const { content } = readRadiusClientsConfTextWithMeta();
        if (!content) return [];
        return parseClientsConfContent(content);
    } catch (error) {
        logger.error(`Error parsing clients.conf: ${error.message}`);
        return [];
    }
}

function isLikelyIpv4(ip) {
    return /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test((ip || '').trim());
}

/** Kunci deduplikasi: IP bila valid, else nama client */
function clientDedupeKey(c) {
    const ip = (c.ipaddr || '').trim();
    if (ip && (isLikelyIpv4(ip) || ip.includes(':'))) return `ip:${ip}`;
    const n = (c.name || '').trim();
    return n ? `name:${n}` : '';
}

function mapNasRowToClient(row) {
    const nn = (row.nasname || '').trim();
    const sn = (row.shortname || '').trim();
    const ipaddr = isLikelyIpv4(nn) || (nn && nn.includes(':')) ? nn : '';
    return {
        id: row.id,
        name: sn || nn || 'client',
        ipaddr: ipaddr || nn,
        secret: row.secret || '',
        nas_type: row.type || 'other',
        require_message_authenticator: 'no',
        comment: row.description || null,
        fromDB: true
    };
}

/**
 * Gabungkan klien dari tabel nas (SQLite) + clients.conf (FreeRADIUS).
 * Untuk IP yang sama, data dari DB menimpa file (nilai di aplikasi diutamakan).
 */
function mergeClientsFromDbAndFile(dbClients, fileClients) {
    const m = new Map();
    for (const c of fileClients) {
        if (!c || !c.name) continue;
        const k = clientDedupeKey(c);
        if (!k) continue;
        m.set(k, {
            name: c.name,
            ipaddr: c.ipaddr || null,
            secret: c.secret || '',
            nas_type: c.nas_type || 'other',
            require_message_authenticator: c.require_message_authenticator || 'no',
            comment: c.comment || null,
            addrType: c.addrType || 'ipaddr'
        });
    }
    for (const c of dbClients) {
        const k = clientDedupeKey(c);
        if (!k) continue;
        const prev = m.get(k) || {};
        m.set(k, {
            ...prev,
            id: c.id,
            name: c.name,
            ipaddr: c.ipaddr || prev.ipaddr,
            secret: c.secret != null && c.secret !== '' ? c.secret : prev.secret,
            nas_type: c.nas_type || prev.nas_type,
            require_message_authenticator:
                c.require_message_authenticator || prev.require_message_authenticator || 'no',
            comment: c.comment != null ? c.comment : prev.comment,
            addrType: c.addrType || prev.addrType || 'ipaddr',
            fromDB: true
        });
    }
    return [...m.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/** Hanya isi ulang tabel nas (tanpa menulis clients.conf) — dipakai auto-heal + writeClientsConfToDB */
async function replaceNasTable(clients) {
    const conn = await getRadiusConnection();
    await conn.execute('DELETE FROM nas');
    for (const client of clients) {
        if (!client.name || !client.secret) {
            logger.warn(`[RADIUS-CLIENTS] Lewati client tidak lengkap: ${client.name}`);
            continue;
        }
        const ip = (client.ipaddr || '').trim();
        if (!ip) {
            logger.warn(`[RADIUS-CLIENTS] Lewati client tanpa IP: ${client.name}`);
            continue;
        }
        await conn.execute(
            `INSERT INTO nas (nasname, shortname, type, secret, description)
             VALUES (?, ?, ?, ?, ?)`,
            [ip, client.name, client.nas_type || 'other', client.secret, client.comment || null]
        );
    }
    logger.info(`[RADIUS-CLIENTS] Tabel nas diisi ulang (${clients.length} entri masukan)`);
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
 * Tulis daftar client ke clients.conf (yang dibaca FreeRADIUS) DAN ke tabel nas (SQLite).
 * Keduanya harus sama agar UI, backup DB, dan FR konsisten.
 */
async function writeClientsConfToDB(clients) {
    try {
        writeClientsConf(clients);
        await replaceNasTable(clients);
        logger.info(`[RADIUS-CLIENTS] Disimpan ${clients.length} client ke clients.conf + nas`);
        return true;
    } catch (error) {
        logger.error(`[RADIUS-CLIENTS] Error writing clients: ${error.message}`);
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
    getRadiusClientsConfReadDiagnostics,
    CLIENTS_CONF_PATH,
    CLIENTS_CONF_MIRROR
};

