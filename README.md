# Gembok Bill

Monorepo aplikasi ISP (billing, GenieACS, MikroTik, dll.); sumber kode hanya di **root** repo ini—bukan struktur bertingkat dengan folder submodule `billing-kalimasada/` di dalam proyek.

**Patokan versi:** aplikasi billing yang sedang berjalan di **http://192.168.166.196** adalah yang **paling mutakhir** dan harus dijadikan acuan; pertahankan kesesuaian perilaku, konfigurasi, dan data dengan server tersebut saat deploy, backup, atau merge perubahan.

**URL untuk klien (Android, dll.):** salin `.env.example` → `.env`, isi `PUBLIC_APP_BASE_URL` (atau `PUBLIC_APP_HOST` + `PUBLIC_APP_PORT`); endpoint baca konfigurasi: `GET /api/public/client`.
