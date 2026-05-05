// Modul monitoring koneksi untuk WhatsApp dan Mikrotik
const logger = require('./logger');
const whatsapp = require('./whatsapp');
const mikrotik = require('./mikrotik');

let whatsappMonitorInterval = null;
let mikrotikMonitorInterval = null;
let isRestarting = false;

// Fungsi untuk monitoring koneksi WhatsApp
function startWhatsAppMonitoring() {
    if (whatsappMonitorInterval) {
        clearInterval(whatsappMonitorInterval);
    }

    whatsappMonitorInterval = setInterval(async () => {
        try {
            const status = whatsapp.getWhatsAppStatus();
            
            // Hanya reconnect jika benar-benar disconnected dan tidak sedang dalam proses connect
            if (!status.connected && !isRestarting && status.status !== 'qr_code') {
                logger.warn('WhatsApp connection lost, attempting to reconnect...');
                isRestarting = true;
                
                // Coba reconnect WhatsApp (dengan delay untuk avoid conflict)
                setTimeout(async () => {
                    try {
                        await whatsapp.connectToWhatsApp();
                    } catch (error) {
                        logger.error('Error reconnecting WhatsApp:', error);
                    } finally {
                        setTimeout(() => {
                            isRestarting = false;
                        }, 15000); // Increase delay
                    }
                }, 5000); // Delay 5 detik sebelum reconnect
            }
        } catch (error) {
            logger.error('Error in WhatsApp monitoring:', error);
            isRestarting = false;
        }
    }, 30000); // Check setiap 30 detik (lebih agresif untuk detect disconnects lebih cepat)

    logger.info('WhatsApp connection monitoring started');
}

// Fungsi untuk monitoring koneksi Mikrotik
function startMikrotikMonitoring() {
    if (mikrotikMonitorInterval) {
        clearInterval(mikrotikMonitorInterval);
    }

    mikrotikMonitorInterval = setInterval(async () => {
        try {
            // Test koneksi Mikrotik dengan command sederhana
            const connection = await mikrotik.getMikrotikConnection();
            if (!connection) {
                logger.warn('Mikrotik connection lost, attempting to reconnect...');
                
                // Coba reconnect Mikrotik
                await mikrotik.connectToMikrotik();
            }
        } catch (error) {
            logger.error('Error in Mikrotik monitoring:', error);
        }
    }, 300000); // Check setiap 5 menit (dioptimasi untuk mengurangi beban API MikroTik)

    logger.info('Mikrotik connection monitoring started');
}

// Fungsi untuk stop monitoring
function stopMonitoring() {
    if (whatsappMonitorInterval) {
        clearInterval(whatsappMonitorInterval);
        whatsappMonitorInterval = null;
    }
    
    if (mikrotikMonitorInterval) {
        clearInterval(mikrotikMonitorInterval);
        mikrotikMonitorInterval = null;
    }
    
    logger.info('Connection monitoring stopped');
}

// Fungsi untuk mendapatkan status monitoring
function getMonitoringStatus() {
    return {
        whatsappMonitoring: !!whatsappMonitorInterval,
        mikrotikMonitoring: !!mikrotikMonitorInterval,
        isRestarting: isRestarting
    };
}

// Fungsi untuk restart monitoring
function restartMonitoring() {
    stopMonitoring();
    startWhatsAppMonitoring();
    startMikrotikMonitoring();
}

module.exports = {
    startWhatsAppMonitoring,
    startMikrotikMonitoring,
    stopMonitoring,
    getMonitoringStatus,
    restartMonitoring
}; 