# 🐳 Gembok-Bill Docker Deployment Guide

Panduan untuk men-deploy Gembok-Bill menggunakan Docker untuk mempermudah manajemen dependensi dan isolasi lingkungan.

## 🚀 Persiapan Cepat

1.  **Clone Repositori**:
    ```bash
    git clone https://github.com/alijayanet/gembok-bill.git
    cd gembok-bill/cvlmedia(oldmembertmplatevoucer)
    ```

2.  **Jalankan Auto-Setup**:
    ```bash
    chmod +x docker-setup.sh
    ./docker-setup.sh
    ```

## 📂 Struktur Volume (Persistensi Data)

Untuk memastikan data Anda tidak hilang saat container dihapus/di-update, Docker memetakan direktori berikut ke host Anda:

-   `./data`: Berisi database SQLite (`billing.db`).
-   `./logs`: Berisi log aplikasi.
-   `./whatsapp-session`: Berisi sesi WhatsApp agar tidak perlu scan ulang.
-   `./settings.json`: File konfigurasi utama aplikasi.

## ⚙️ Konfigurasi (`.env`)

Buat file `.env` di root direktori (otomatis dibuat oleh `docker-setup.sh`):

```env
PORT=22917
TUNNEL_TOKEN=token_cloudflare_anda
```

## 🛠️ Perintah Manajemen

### Melihat Logs (Untuk Scan QR WhatsApp)
```bash
docker compose logs -f gembok-bill
```

### Menghentikan Aplikasi
```bash
docker compose down
```

### Memulai/Restart Aplikasi
```bash
docker compose up -d
```

### Masuk ke dalam Container (Shell)
```bash
docker exec -it gembok-bill sh
```

## 🐛 Troubleshooting

### SQLite3 Native Module Error
Jika Anda melihat error terkait SQLite3, jalankan build ulang di Docker:
```bash
docker compose up -d --build
```

### Port Sudah Digunakan
Ubah nilai `PORT` di file `.env`, lalu jalankan `docker compose up -d`.

### Permissions (Linux)
Jika container gagal menulis logs atau database, pastikan permissions benar:
```bash
sudo chown -R 1000:1000 data logs whatsapp-session settings.json
```
*(Catatan: Container biasanya berjalan sebagai root kecuali dikonfigurasi lain).*

---
**Happy Deploying! 🚀**
