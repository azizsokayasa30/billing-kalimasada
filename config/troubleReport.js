const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('./logger');
const { getSetting } = require('./settingsManager');
const { sendMessage, setSock } = require('./sendMessage');

// Database helper
const dbPath = path.join(__dirname, '../data/billing.db');
const getDB = () => new sqlite3.Database(dbPath);

// Helper function untuk format tanggal Indonesia yang benar
function formatIndonesianDateTime(date = new Date()) {
  try {
    let targetDate = new Date(date);
    
    const currentYear = targetDate.getFullYear();
    if (currentYear > 2026) {
      const yearDiff = currentYear - 2026;
      targetDate = new Date(targetDate.getTime() - (yearDiff * 365 * 24 * 60 * 60 * 1000));
    }
    
    const options = {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    const formatter = new Intl.DateTimeFormat('id-ID', options);
    const parts = formatter.formatToParts(targetDate);
    
    const day = parts.find(part => part.type === 'day').value;
    const month = parts.find(part => part.type === 'month').value;
    const year = parts.find(part => part.type === 'year').value;
    const hour = parts.find(part => part.type === 'hour').value;
    const minute = parts.find(part => part.type === 'minute').value;
    const second = parts.find(part => part.type === 'second').value;
    
    return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
  } catch (error) {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hour = d.getHours().toString().padStart(2, '0');
    const minute = d.getMinutes().toString().padStart(2, '0');
    const second = d.getSeconds().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
  }
}

// Mendapatkan semua laporan gangguan
async function getAllTroubleReports() {
  return new Promise((resolve, reject) => {
    const db = getDB();
    db.all("SELECT * FROM trouble_reports ORDER BY created_at DESC", [], (err, rows) => {
      db.close();
      if (err) {
        logger.error(`Gagal membaca laporan gangguan: ${err.message}`);
        return reject(err);
      }
      resolve(rows.map(r => ({...r, notes: JSON.parse(r.notes || '[]')})));
    });
  });
}

// Mendapatkan laporan gangguan berdasarkan ID
async function getTroubleReportById(id) {
  return new Promise((resolve, reject) => {
    const db = getDB();
    db.get("SELECT * FROM trouble_reports WHERE id = ?", [id], (err, row) => {
      db.close();
      if (err) return reject(err);
      if (row) {
        row.notes = JSON.parse(row.notes || '[]');
      }
      resolve(row || null);
    });
  });
}

// Mendapatkan laporan gangguan berdasarkan nomor pelanggan
async function getTroubleReportsByPhone(phone) {
  return new Promise((resolve, reject) => {
    const db = getDB();
    db.all("SELECT * FROM trouble_reports WHERE phone = ? ORDER BY created_at DESC", [phone], (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows.map(r => ({...r, notes: JSON.parse(r.notes || '[]')})));
    });
  });
}

// Membuat laporan gangguan baru
async function createTroubleReport(reportData) {
  return new Promise((resolve, reject) => {
    const db = getDB();
    const id = `TR${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const now = new Date().toISOString();
    
    const sql = `
      INSERT INTO trouble_reports (
        id, status, created_at, updated_at, name, phone, location, 
        category, description, assigned_technician_id, priority, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      id,
      'open',
      now,
      now,
      reportData.name,
      reportData.phone,
      reportData.location,
      reportData.category,
      reportData.description,
      reportData.assigned_technician_id || reportData.assignedTechnicianId,
      reportData.priority || 'Normal',
      JSON.stringify([])
    ];

    db.run(sql, params, async function(err) {
      db.close();
      if (err) {
        logger.error(`Gagal membuat laporan gangguan: ${err.message}`);
        return reject(err);
      }
      
      const newReport = {
        id,
        status: 'open',
        created_at: now,
        updated_at: now,
        ...reportData,
        notes: []
      };

      // Notifikasi
      try {
        if (getSetting('trouble_report.auto_ticket', 'true') === 'true') {
          sendNotificationToTechnicians(newReport);
        }
      } catch (notificationError) {
        logger.warn('Failed to send technician notification:', notificationError.message);
      }
      
      resolve(newReport);
    });
  });
}

// Update status laporan gangguan
async function updateTroubleReportStatus(id, status, notes, technicalData = {}, sendNotification = true) {
  const currentReport = await getTroubleReportById(id);
  if (!currentReport) return null;

  return new Promise((resolve, reject) => {
    const db = getDB();
    const now = new Date().toISOString();
    let updatedNotes = currentReport.notes || [];
    
    if (notes) {
      const noteEntry = {
        timestamp: now,
        content: notes,
        status,
        notificationSent: sendNotification
      };
      updatedNotes.push(noteEntry);
    }

    const { odp, sn, signal_level } = technicalData;

    const sql = `
      UPDATE trouble_reports 
      SET status = ?, notes = ?, updated_at = ?, odp = ?, sn = ?, signal_level = ?
      WHERE id = ?
    `;
    
    db.run(sql, [status, JSON.stringify(updatedNotes), now, odp, sn, signal_level, id], async function(err) {
      db.close();
      if (err) {
        logger.error(`Gagal mengupdate status laporan gangguan: ${err.message}`);
        return reject(err);
      }
      
      const updatedReport = {
        ...currentReport,
        status,
        notes: updatedNotes,
        updated_at: now,
        odp,
        sn,
        signal_level
      };

      if (sendNotification) {
        sendStatusUpdateToCustomer(updatedReport);
      }
      
      resolve(updatedReport);
    });
  });
}

// Kirim notifikasi ke teknisi dan admin
async function sendNotificationToTechnicians(report) {
  try {
    logger.info(`🔔 Mencoba mengirim notifikasi laporan gangguan ${report.id} ke teknisi dan admin`);
    
    const technicianGroupId = getSetting('technician_group_id', '');
    const companyHeader = getSetting('company_header', 'CV Lintas Multimedia');
    
    const message = `🚨 *LAPORAN GANGGUAN BARU*

*${companyHeader}*

📝 *ID Tiket*: ${report.id}
👤 *Pelanggan*: ${report.name || 'N/A'}
📱 *No. HP*: ${report.phone || 'N/A'}
📍 *Lokasi*: ${report.location || 'N/A'}
🔧 *Kategori*: ${report.category || 'N/A'}
🕒 *Waktu Laporan*: ${formatIndonesianDateTime(new Date(report.created_at || report.createdAt))}

💬 *Deskripsi Masalah*:
${report.description || 'Tidak ada deskripsi'}

📌 *Status*: ${report.status.toUpperCase()}

⚠️ *PRIORITAS TINGGI* - Silakan segera ditindaklanjuti!`;

    let sentSuccessfully = false;
    
    if (technicianGroupId) {
      try {
        const result = await sendMessage(technicianGroupId, message);
        if (result) sentSuccessfully = true;
      } catch (error) {
        logger.error(`❌ Error mengirim ke grup teknisi: ${error.message}`);
      }
    }
    
    const { sendTechnicianMessage } = require('./sendMessage');
    try {
      const techResult = await sendTechnicianMessage(message, 'high');
      if (techResult) sentSuccessfully = true;
    } catch (error) {
      logger.error(`❌ Error mengirim ke nomor teknisi: ${error.message}`);
    }
    
    return sentSuccessfully;
  } catch (error) {
    logger.error(`❌ Error mengirim notifikasi ke teknisi: ${error.message}`);
    return false;
  }
}

// Kirim notifikasi update status ke pelanggan
async function sendStatusUpdateToCustomer(report) {
  try {
    if (!report.phone) return false;
    
    const waJid = report.phone.replace(/^0/, '62') + '@s.whatsapp.net';
    const companyHeader = getSetting('company_header', 'ISP Monitor');
    
    const statusMap = {
      'open': 'Dibuka',
      'in_progress': 'Sedang Ditangani',
      'resolved': 'Terselesaikan',
      'closed': 'Ditutup'
    };
    
    const latestNote = report.notes && report.notes.length > 0 
      ? report.notes[report.notes.length - 1].content 
      : '';
    
    let message = `📣 *UPDATE LAPORAN GANGGUAN*
    
*${companyHeader}*

📝 *ID Tiket*: ${report.id}
🕒 *Update Pada*: ${formatIndonesianDateTime(new Date(report.updated_at || report.updatedAt))}
📌 *Status Baru*: ${statusMap[report.status] || report.status.toUpperCase()}

${latestNote ? `💬 *Catatan Teknisi*:
${latestNote}

` : ''}`;
    
    if (report.status === 'open') {
      message += `Laporan Anda telah diterima dan akan segera ditindaklanjuti oleh tim teknisi kami.`;
    } else if (report.status === 'in_progress') {
      message += `Tim teknisi kami sedang menangani laporan Anda. Mohon kesabarannya.`;
    } else if (report.status === 'resolved') {
      message += `✅ Laporan Anda telah diselesaikan. Jika masalah sudah benar-benar teratasi, silakan tutup laporan ini melalui portal pelanggan.`;
    } else if (report.status === 'closed') {
      message += `🙏 Terima kasih telah menggunakan layanan kami. Laporan ini telah ditutup.`;
    }
    
    message += `\n\nJika ada pertanyaan, silakan hubungi kami.`;
    await sendMessage(waJid, message);
    return true;
  } catch (error) {
    logger.error(`❌ Error mengirim update status ke pelanggan: ${error.message}`);
    return false;
  }
}

// Fungsi untuk set sock instance
function setSockInstance(sockInstance) {
  setSock(sockInstance);
}

module.exports = {
  getAllTroubleReports,
  getTroubleReportById,
  getTroubleReportsByPhone,
  createTroubleReport,
  updateTroubleReportStatus,
  sendNotificationToTechnicians,
  sendStatusUpdateToCustomer,
  setSockInstance
};
