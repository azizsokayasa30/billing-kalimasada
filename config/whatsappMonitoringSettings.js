/**
 * Master switches untuk notifikasi WhatsApp otomatis / terjadwal (bukan template isi pesan).
 * Disimpan di settings.json sebagai object: whatsapp_system_monitors
 */
const { getSetting, setSetting } = require('./settingsManager');

const MONITOR_DEFINITIONS = [
    {
        id: 'pppoe_login_logout_wa',
        category: 'PPPoE & MikroTik',
        title: 'Login / logout PPPoE',
        description: 'Pesan ke admin & teknisi saat user PPPoE login atau logout (monitor interval).'
    },
    {
        id: 'rx_power_threshold_wa',
        category: 'GenieACS & RX',
        title: 'Peringatan RX power (ambang)',
        description: 'Notifikasi perangkat dengan redaman/RX mendekati kritis (interval rxPowerMonitor).'
    },
    {
        id: 'genieacs_rx_recap_wa',
        category: 'GenieACS & RX',
        title: 'Rekap redaman RX (GenieACS)',
        description: 'Ringkasan periodik perangkat RX rendah dari GenieACS ke teknisi.'
    },
    {
        id: 'genieacs_offline_digest_wa',
        category: 'GenieACS & RX',
        title: 'Digest perangkat offline',
        description: 'Ringkasan periodik ONU/perangkat offline ke teknisi.'
    },
    {
        id: 'billing_daily_due_wa',
        category: 'Billing',
        title: 'Pengingat jatuh tempo harian',
        description: 'Job scheduler jam 09:00 — kirim WA tagihan jatuh tempo / terlambat ke pelanggan.'
    },
    {
        id: 'billing_scheduler_invoice_wa',
        category: 'Billing',
        title: 'WA tagihan baru (generator otomatis)',
        description: 'Saat invoice terbuat otomatis (bulanan/harian billing), kirim WA tagihan baru ke pelanggan.'
    },
    {
        id: 'isolir_suspension_wa',
        category: 'Isolir & layanan',
        title: 'WA saat layanan diisolir',
        description: 'Notifikasi WhatsApp ke pelanggan saat isolir/suspensi otomatis.'
    },
    {
        id: 'isolir_restore_wa',
        category: 'Isolir & layanan',
        title: 'WA saat layanan dipulihkan',
        description: 'Notifikasi saat layanan diaktifkan kembali setelah pembayaran / restore.'
    },
    {
        id: 'member_isolir_wa',
        category: 'Isolir & layanan',
        title: 'WA isolir member hotspot',
        description: 'Pesan ke member hotspot saat proses isolir member.'
    },
    {
        id: 'trouble_report_routing_wa',
        category: 'Laporan gangguan',
        title: 'WA laporan gangguan',
        description: 'Notifikasi tiket baru ke grup teknisi dan update status ke pelanggan (selain toggle per-template).'
    },
    {
        id: 'broadcast_group_wa',
        category: 'Grup & broadcast',
        title: 'Kirim ke grup WA terdaftar',
        description: 'Saat broadcast gangguan/pengumuman atau alur yang memakai daftar group billing — kirim salinan ke grup.'
    }
];

function defaultMonitorsObject() {
    const o = {};
    MONITOR_DEFINITIONS.forEach((m) => {
        o[m.id] = true;
    });
    return o;
}

function getMergedMonitors() {
    const saved = getSetting('whatsapp_system_monitors', null);
    const base = defaultMonitorsObject();
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        Object.keys(saved).forEach((k) => {
            if (k in base) {
                base[k] = saved[k] !== false;
            }
        });
    }
    return base;
}

function isWaSystemMonitorEnabled(id) {
    const m = getMergedMonitors();
    return m[id] !== false;
}

function setMonitorsPartial(partial) {
    const current = getMergedMonitors();
    if (partial && typeof partial === 'object') {
        Object.keys(partial).forEach((k) => {
            if (MONITOR_DEFINITIONS.some((d) => d.id === k)) {
                current[k] = partial[k] !== false;
            }
        });
    }
    setSetting('whatsapp_system_monitors', current);
    return getMergedMonitors();
}

module.exports = {
    MONITOR_DEFINITIONS,
    getMergedMonitors,
    isWaSystemMonitorEnabled,
    setMonitorsPartial
};
