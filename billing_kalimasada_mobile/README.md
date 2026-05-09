# Billing Kalimasada — mobile (Flutter)

Aplikasi untuk teknisi, kolektor, dan peran lain yang terhubung ke **API billing di server** (Node.js), **bukan** langsung ke file database/SQL dari ponsel. Port yang Anda buka (`30196`) harus mengarah ke proses aplikasi billing (mis. Express), sama seperti akses dari browser/admin.

## URL server (.env)

1. Copy contoh konfigurasi (opsional kalau `.env` sudah ada):

   ```bash
   cp .env.example .env
   ```

2. Isi **`API_URL`** tanpa slash di akhir, misalnya:

   ```env
   API_URL=http://38.253.240.243:30196
   ```

   Variabel alternatif yang dibaca app: `BILLING_API_URL`, `API_BASE_URL` (lihat `lib/services/api_client.dart`).

3. **HTTP vs HTTPS**  
   Untuk produksi, disarankan reverse proxy (Nginx/Caddy) + sertifikat TLS dan domain, lalu ganti `API_URL` ke `https://...`. Android sudah mengizinkan HTTP cleartext untuk build ini (`usesCleartextTraffic="true"` di `AndroidManifest.xml`); untuk rilis Play Store kebijakan bisa lebih ketat — pertimbangkan HTTPS.

## Prerequisites

- [Flutter SDK](https://docs.flutter.dev/get-started/install) stabil, channel Anda pilih (`stable` disarankan).
- Android SDK / Android Studio untuk build APK.

Periksa lingkungan:

```bash
flutter doctor -v
```

## Build APK (release)

Dari folder `billing_kalimasada_mobile/`:

```bash
cd billing_kalimasada_mobile
flutter pub get
flutter build apk --release
```

Hasil utama:

- `build/app/outputs/flutter-apk/app-release.apk` — APK universal (.arm + .x86_64 dalam satu artefak besar).

Ukuran lebih kecil (per ABI):

```bash
flutter build apk --release --split-per-abi
```

Output di folder yang sama: `app-armeabi-v8a-release.apk`, `app-arm64-v8a-release.apk`, dll.

## Build App Bundle (untuk Play Store)

```bash
flutter build appbundle --release
```

Output: `build/app/outputs/bundle/release/app-release.aab`.

## Pengecekan cepat di perangkat

```bash
flutter run --release
```

(pastikan HP dalam mode USB debugging dan terdeteksi `flutter devices`)

## Firewall / router

Pastikan **port forwarding** atau security group membuka **`30196` → mesin billing**, dan aplikasi Node benar-benar listen di `0.0.0.0:30196` (bukan hanya localhost), agar bisa dijangkau dari internet.
