/// Pesan singkat saat tidak ada cleartext PPPoE dari API (RADIUS kosong / terfilter hash).
const String kTechnicianPppoePasswordEmptyHint =
    '— Refresh daftar (tarik ke bawah). Sandi dari server (Mikrotik atau RADIUS, sama admin); hubungi admin jika kosong.';

/// Sandi PPPoE untuk UI teknisi: jangan tampilkan string yang jelas hash (bcrypt/argon2),
/// misalnya jika radcheck salah isi atau respons lama tersimpan.
bool looksLikePasswordHashForDisplay(String s) {
  final t = s.trim();
  if (t.isEmpty) return false;
  if (RegExp(r'^\$2[aby]\$\d{2}\$').hasMatch(t)) return true;
  if (RegExp(r'^\$argon2', caseSensitive: false).hasMatch(t)) return true;
  if (t.startsWith(r'$5$') || t.startsWith(r'$6$') || t.startsWith(r'$1$')) return true;
  if (RegExp(r'^\{SHA\}', caseSensitive: false).hasMatch(t) ||
      RegExp(r'^\{SSHA', caseSensitive: false).hasMatch(t)) {
    return true;
  }
  return false;
}

/// Nilai untuk ditampilkan / disalin; kosong jika hash atau kosong.
String pppoeCleartextForTechnicianUi(String? raw) {
  if (raw == null) return '';
  final t = raw.trim();
  if (t.isEmpty) return '';
  if (looksLikePasswordHashForDisplay(t)) return '';
  return t;
}
