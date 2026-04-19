# Dokumentasi Route & Akses Login

## Akses Login Utama

### 1. 👮 Administrator (Admin)
- **URL Login:** `/admin/mobile` atau `/admin/login/mobile`
- **Tujuan:** Halaman kontrol utama untuk mengatur semua aspek aplikasi (tagihan, pengaturan, member, dll).
- **Kredensial Default:**
  - **Username:** `admin` (Bisa dicek/diubah di file [settings.json](file:///d:/job_nation/RADIUS-BILLING-19-02-26T1529/RADIUS-BILLING-19-02-26T1529/RADIUS-BILLING-19-02-26T1529/cvlmedia%28oldmembertmplatevoucer%29/settings.json) pada field `admin_username`)
  - **Password:** `admin` (Bisa dicek/diubah di file [settings.json](file:///d:/job_nation/RADIUS-BILLING-19-02-26T1529/RADIUS-BILLING-19-02-26T1529/RADIUS-BILLING-19-02-26T1529/cvlmedia%28oldmembertmplatevoucer%29/settings.json) pada field `admin_password`)
- **Catatan:** Jika Anda mengubah nilainya di file [settings.json](file:///d:/job_nation/RADIUS-BILLING-19-02-26T1529/RADIUS-BILLING-19-02-26T1529/RADIUS-BILLING-19-02-26T1529/cvlmedia%28oldmembertmplatevoucer%29/settings.json), gunakan nilai terbaru tersebut untuk login.

### 2. 🤝 Agen WiFi / Reseller (Agent)
- **URL Login:** `/agent/login`
- **Tujuan:** Portal khusus bagi agen atau reseller untuk membeli saldo/voucher dan memantau transaksi penjualan voucher yang mereka lakukan.
- **Kredensial:** 
  - **Username:** Sesuai dengan yang terdaftar.
  - **Password:** Sesuai dengan yang terdaftar.
- **Catatan:** Agen baru dapat membuat akun sendiri melalui halaman pendaftaran (`/agent/register`), atau dapat ditambahkan secara manual oleh Admin melalui dashboard Admin.

### 3. 🏍️ Tukang Tagih (Collector)
- **URL Login:** `/collector/login`
- **Tujuan:** Portal khusus bagi tukang tagih (kolektor) untuk melihat daftar tagihan yang harus dipungut langsung di lapangan, dan melakukan konfirmasi jika pelanggan sudah membayar secara tunai.
- **Kredensial:**
  - **Nomor HP / Telepon:** Nomor telepon/HP kolektor yang telah didaftarkan.
  - **Password:** Password default yang diatur oleh Admin.
- **Catatan:** Berbeda dengan agen, **akun collector hanya bisa dibuat dan diaktifkan oleh Admin** terlebih dahulu melalui menu `/admin/collectors`.

### 4. 👷‍♂️ Teknisi (Technician)
- **URL Login:** `/technician/login` atau `/teknisi/login`
- **Tujuan:** Portal untuk teknisi melihat jadwal pemasangan layanan baru, pengecekan kabel (ODP/ODC), maupun menangani laporan gangguan pelanggan.

### 5. 🌍 Pelanggan (Customer)
- **URL Login:** `/customer/login` (Mengakses halaman utama `/` akan di-redirect secara otomatis ke halaman ini)
- **Tujuan:** Portal utama bagi pelanggan untuk melihat jumlah tagihan, riwayat transaksi, dan membuat tiket laporan gangguan.

---

## Daftar Lengkap Modul Routing 

Berikut adalah ringkasan dari semua route modul yang digunakan pada aplikasi ini:

### Admin Routes (Protected)
Semua route di bawah ini membutuhkan login sebagai Admin.
- `/admin` : Akses routing Dashboard serta menu-menu esensial.
- `/admin/member` : Kelola Data Pelanggan/Member Mikrotik (PPPoE dan Hotspot).
- `/admin/billing` : Manajemen Tagihan / Invoice bulanan dan manual.
- `/admin/hotspot` : Pengelolaan detail Voucher Hotspot (pembuatan & validasi).
- `/admin/settings` : Pengaturan konfigurasi Billing & Mikrotik/Radius.
- `/admin/technicians` : Manajemen akun Pekerja/Teknisi.
- `/admin/collectors` : Manajemen akun Tukang Tagih (Collector).
- `/admin/agents` : Manajemen akun Agen secara keseluruhan oleh Admin.
- `/admin/cable-network` : Manajemen topologi dan jalur Kabel/Jaringan.

### Agent Routes
- `/agent` atau `/agent/dashboard` : Halaman dashboard operasional agen.
- `/agent/profile` : Halaman profil agen tempat agen bisa berganti password (route dilindungi sesi auth).

### Collector Routes
- `/collector/login` : Autentikasi untuk para kolektor lapangan. 
- `/collector/dashboard` : Halaman daftar rekapitulasi pelanggan yang harus bayar.

### Public & Webhook Routes
- `/payment` : Endpoint / Webhook untuk merekam proses pembayaran online dari Payment Gateway (Midtrans, Duitku, Xendit).
- `/voucher` : Portal publik pembelian voucher Hotspot melalui antarmuka web langsung.
- `/api` : Endpoint API, biasanya digunakan oleh sistem front-end untuk load data secara asinkron seperti log traffic Mikrotik.
- `/tools` : Tool publik tambahan yang tersedia tanpa akses login.
