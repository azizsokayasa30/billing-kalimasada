# Hubungan Gangguan & Perbaikan di Database

Semua data gangguan (`trouble_reports`) dan instalasi (`installation_jobs`) kini telah dimigrasikan ke database SQLite.

## Struktur Tabel Trouble Reports
Tabel `trouble_reports` menyimpan informasi berikut:
- **id**: ID Tiket unik (Contoh: TR123456ABC)
- **name**: Nama pelanggan
- **phone**: Nomor telepon pelanggan
- **location**: Alamat atau lokasi gangguan
- **category**: Kategori (WiFi, Internet Lambat, dll)
- **description**: Detail masalah yang dilaporkan
- **status**: `open`, `in_progress`, `resolved`, `closed`
- **priority**: `Normal`, `High`, dll
- **assigned_technician_id**: ID Teknisi yang ditugaskan
- **notes**: JSON List yang berisi riwayat aktivitas teknisi (status, catatan, timestamp)

## Cara Kerja Update di Mobile
Ketika teknisi memperbarui status di aplikasi mobile:
1. Aplikasi mengirim `PATCH` ke `/api/technicians/jobs/:id`.
2. Backend akan mendeteksi apakah itu `installation` atau `repair`.
3. Backend akan menambah catatan baru ke dalam kolom `notes` (JSON List).
4. Aplikasi mobile menampilkan seluruh riwayat tersebut di bagian **Riwayat Aktivitas**.
