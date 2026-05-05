# Gembok Bill

Monorepo aplikasi ISP (billing, GenieACS, MikroTik, dll.); sumber kode hanya di **root** repo ini—bukan struktur bertingkat dengan folder submodule `billing-kalimasada/` di dalam proyek.

**Patokan versi:** aplikasi billing yang sedang berjalan di **http://192.168.166.196** adalah yang **paling mutakhir** dan harus dijadikan acuan; pertahankan kesesuaian perilaku, konfigurasi, dan data dengan server tersebut saat deploy, backup, atau merge perubahan.

**URL untuk klien (Android, dll.):** salin `.env.example` → `.env`, isi `PUBLIC_APP_BASE_URL` (atau `PUBLIC_APP_HOST` + `PUBLIC_APP_PORT`); endpoint baca konfigurasi: `GET /api/public/client`.

**Alur Git ke depan:** `main` dan branch fitur (mis. `kalimasada-billing-cursor`) dijaga **ujung commit sama**—kerja bisa **hanya di `main`**, atau di branch fitur lalu sebelum selesai jalankan `git checkout <branch-fitur> && git merge main --ff-only` (setelah `main` di-update) dan `git push`; setelah PR/merge ke `main`, fast-forward branch fitur ke `main` lagi. Hindari dua pohon yang saling menyimpang lama.
