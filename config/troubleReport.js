const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('./logger');
const { getSetting, getLocalTimestamp } = require('./settingsManager');
const { sendMessage, setSock } = require('./sendMessage');

// Database helper
const dbPath = path.join(__dirname, '../data/billing.db');
const getDB = () => new sqlite3.Database(dbPath);

// Helper function untuk format tanggal Indonesia yang benar
function formatIndonesianDateTime(date = new Date()) {
  try {
    const targetDate = new Date(date);
    
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
    // Fallback manual dengan offset WIB +7
    const d = new Date(date);
    const wibDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    const day = wibDate.getUTCDate().toString().padStart(2, '0');
    const month = (wibDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = wibDate.getUTCFullYear();
    const hour = wibDate.getUTCHours().toString().padStart(2, '0');
    const minute = wibDate.getUTCMinutes().toString().padStart(2, '0');
    const second = wibDate.getUTCSeconds().toString().padStart(2, '0');
    
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
    const now = getLocalTimestamp();
    
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
    const now = getLocalTimestamp();
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

// Menghapus laporan gangguan
async function deleteTroubleReport(id) {
  return new Promise((resolve, reject) => {
    const db = getDB();
    db.run("DELETE FROM trouble_reports WHERE id = ?", [id], function(err) {
      db.close();
      if (err) {
        logger.error(`Gagal menghapus laporan gangguan: ${err.message}`);
        return reject(err);
      }
      resolve(this.changes > 0);
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

/** Isi dari catatan teknisi di app mobile: [Penyelesaian teknisi] + teks + baris foto opsional */
function extractTechnicianCompletion(report) {
  if (!report || !Array.isArray(report.notes)) {
    return { description: null, photoPath: null, completedAt: null };
  }
  const candidates = report.notes.filter(
    (n) => n && typeof n.content === 'string' && n.content.includes('[Penyelesaian teknisi]')
  );
  if (candidates.length === 0) {
    return { description: null, photoPath: null, completedAt: null };
  }
  candidates.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const n = candidates[0];
  const lines = String(n.content)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length);
  let photoPath = null;
  const descParts = [];
  for (const line of lines) {
    if (line.startsWith('[Penyelesaian teknisi]')) continue;
    const imgMatch = line.match(/(\/img\/field-completion\/[^\s]+\.(?:jpg|jpeg|png|webp))/i);
    if (imgMatch) {
      photoPath = imgMatch[1];
      continue;
    }
    if (line.startsWith('📷')) {
      const m2 = line.match(/(\/img\/[^\s]+)/);
      if (m2) photoPath = m2[1];
      continue;
    }
    descParts.push(line);
  }
  return {
    description: descParts.join('\n').trim() || null,
    photoPath,
    completedAt: n.timestamp || null
  };
}

module.exports = {
  getAllTroubleReports,
  getTroubleReportById,
  getTroubleReportsByPhone,
  createTroubleReport,
  deleteTroubleReport,
  updateTroubleReportStatus,
  sendNotificationToTechnicians,
  sendStatusUpdateToCustomer,
  setSockInstance,
  extractTechnicianCompletion
};
