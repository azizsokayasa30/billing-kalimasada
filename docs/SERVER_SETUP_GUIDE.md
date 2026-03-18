# 🚀 Panduan Setup Server Ubuntu - Billing + FreeRADIUS + GenieACS

> ⚠️ Semua perintah berikut dijalankan di **Ubuntu Server** via SSH.

---

## 📋 Urutan Setup

1. Copy file billing ke server
2. Setup FreeRADIUS
3. Setup GenieACS (Opsional)
4. Setup & Jalankan Billing

---

## STEP 0: Copy File Billing ke Server

```bash
# Dari Windows (Command Prompt):
scp -r D:\LokasiFile\cvlmedia\ root@YOUR_SERVER_IP:/home/yourserver/

# Atau gunakan WinSCP (direkomendasikan, lebih mudah)
```

---

## STEP 1: Setup FreeRADIUS

```bash
# SSH ke server
ssh root@YOUR_SERVER_IP

# Install dependencies
sudo apt update
sudo apt install git -y

# Clone repository
git clone https://github.com/enosrotua/FreeRADIUSPaket.git
cd FreeRADIUSPaket

# Auto-setup
sudo bash setup.sh
```

### ⚠️ PENTING: Simpan Password!

Saat setup muncul output seperti ini, **SIMPAN PASSWORD-NYA**:

```
[+] Generated password: xxxxxxxxxxxxxxx
[+] Generated MariaDB root password: xxxxxxxxxxxxxxx
```

> Password ini digunakan untuk akses database RADIUS dan di-setup di Billing CVLMedia  
> (Menu: Settingan → Setting RADIUS)

### Ganti User Billing (Opsional)

```bash
sudo bash scripts/setup_billing_user.sh

# Atau dengan custom values:
export BILLING_DB_USER=billing
export BILLING_DB_PASSWORD=secure_password
export BILLING_DB_HOST=localhost
sudo -E bash scripts/setup_billing_user.sh
```

---

## STEP 2: Setup GenieACS (Opsional)

```bash
# Install dependencies
apt install git curl -y

# Clone repository
git clone https://github.com/enosrotua/cvlgenieACS.git
cd cvlgenieACS

# Set permission
chmod +x *.sh

# Install dengan dark mode
bash darkmode.sh
```

### Akses GenieACS

| Item | Value |
|------|-------|
| URL | `http://YOUR_SERVER_IP:3000` |
| Username | `admin` |
| Password | `admin` |

### Kustomisasi GenieACS

```bash
# Ganti logo
bash change-logo.sh

# Ganti tema/background color
bash change-theme.sh

# Management suite lengkap
bash genieacs-manager.sh
```

---

## STEP 3: Setup & Jalankan Billing

```bash
# Masuk ke directory billing
cd /home/yourserver/cvlmedia

# Jalankan setup
bash setup.sh

# Jalankan aplikasi
pm2 start app.js --name cvlmedia
pm2 save
```

### Akses Billing

| Item | Value |
|------|-------|
| URL | `http://YOUR_SERVER_IP:3003` |
| Admin Login | `http://YOUR_SERVER_IP:3003/admin/login` |
| Username | `admin` |
| Password | `admin` |

> ⚠️ Ubah password admin segera setelah login pertama!

---

## STEP 4: Konfigurasi via UI

1. **Setting Umum** → Informasi perusahaan, kontak, pembayaran
2. **Setting RADIUS** → Masukkan password dari STEP 1
3. **Setting Koneksi** → GenieACS server & Router Mikrotik
4. **WhatsApp Bot** → Scan QR code
5. **Paket Internet** → Buat paket & harga
6. **Auto Suspension** → Konfigurasi isolir otomatis

---

## 🔧 Troubleshooting

```bash
# Cek status aplikasi
pm2 status
pm2 logs cvlmedia

# Restart aplikasi
pm2 restart cvlmedia

# Cek FreeRADIUS
systemctl status freeradius

# Test koneksi database RADIUS
mysql -u billing -p radius -e "SELECT 1;"
```
