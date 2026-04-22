/**
 * KALIMASADA BADGE FORMATTER v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Secara otomatis memformat warna badge berdasarkan isi teks.
 * Berlaku global di semua halaman yang memuat file ini.
 *
 * Aturan Warna:
 *  🟢 Hijau  (bg-success)  : aktif, lunas, online, berhasil
 *  🟤 Cokelat (bg-brown)   : nonaktif, tidak aktif, tidak ada data
 *  🟡 Kuning (bg-warning)  : terlambat, pending, belum lunas, belum bayar
 *  🔴 Merah  (bg-danger)   : isolir, offline, failed, gagal, error, suspend
 *  🔵 Biru   (bg-info)     : register, info, profil
 *  🟦 Primer (bg-primary)  : complete, selesai
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  // ── Peta teks → kelas warna ──────────────────────────────────────────────
  var BADGE_MAP = [
    {
      cls: 'bg-success',
      texts: [
        'aktif', 'lunas', 'online', 'berhasil', 'settlement',
        'sudah bayar', 'terbayar', 'active', 'paid', 'connected',
        'terhubung', 'selesai (bayar)', 'verified'
      ]
    },
    {
      cls: 'bg-brown',
      texts: [
        'nonaktif', 'tidak aktif', 'inactive', 'tidak ada', 'disabled',
        'belum aktif', 'tidak berlangganan'
      ]
    },
    {
      cls: 'bg-warning',
      needsDark: true,
      texts: [
        'terlambat', 'pending', 'belum lunas', 'belum bayar',
        'menunggu', 'waiting', 'ditangguhkan', 'overdue',
        'unpaid', 'jatuh tempo', 'proses', 'processing'
      ]
    },
    {
      cls: 'bg-danger',
      texts: [
        'isolir', 'offline', 'failed', 'uncomplete', 'gagal',
        'error', 'suspend', 'suspended', 'suspended/isolir',
        'diblokir', 'blocked', 'nonaktif (isolir)', 'disconnected',
        'terputus', 'expire', 'expired', 'rejected', 'dibatalkan',
        'canceled', 'tidak selesai'
      ]
    },
    {
      cls: 'bg-info',
      texts: [
        'register', 'registrasi', 'mendaftar', 'baru mendaftar',
        'trial', 'uji coba', 'promo'
      ]
    },
    {
      cls: 'bg-primary',
      texts: [
        'complete', 'selesai', 'completed', 'done', 'finish',
        'closed', 'resolved', 'sukses', 'success'
      ]
    }
  ];

  // ── Fungsi utama ─────────────────────────────────────────────────────────
  function formatBadge(badge) {
    var rawText = badge.textContent.trim().toLowerCase();
    if (!rawText) return;

    for (var i = 0; i < BADGE_MAP.length; i++) {
      var rule = BADGE_MAP[i];
      if (rule.texts.indexOf(rawText) === -1) continue;

      // Cek apakah sudah benar
      if (badge.classList.contains(rule.cls)) {
        // Sudah benar, pastikan hanya 1 bg-* class
        var extra = false;
        badge.classList.forEach(function (c) {
          if (c.startsWith('bg-') && c !== rule.cls) extra = true;
        });
        if (!extra) return; // sudah bersih, tidak perlu lagi
      }

      // Hapus semua bg-* yang ada, lalu tambahkan yang benar
      badge.classList.forEach(function (c) {
        if (c.startsWith('bg-')) badge.classList.remove(c);
      });
      badge.classList.add(rule.cls);

      // Kelola text-dark
      if (rule.needsDark) {
        badge.classList.add('text-dark');
      } else {
        badge.classList.remove('text-dark');
      }

      return; // sudah cocok, tidak perlu iterasi lanjut
    }
  }

  function formatAllBadges(root) {
    var badges = (root || document).querySelectorAll('.badge');
    for (var i = 0; i < badges.length; i++) {
      formatBadge(badges[i]);
    }
  }

  // ── Inisialisasi ─────────────────────────────────────────────────────────
  function init() {
    formatAllBadges(document);

    // Pantau perubahan DOM (badge yang di-render via JS/DataTables/fetch)
    if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function (mutations) {
        for (var m = 0; m < mutations.length; m++) {
          var added = mutations[m].addedNodes;
          for (var n = 0; n < added.length; n++) {
            var node = added[n];
            if (node.nodeType !== 1) continue;
            if (node.classList && node.classList.contains('badge')) {
              formatBadge(node);
            } else if (node.querySelectorAll) {
              formatAllBadges(node);
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Jalankan setelah DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
