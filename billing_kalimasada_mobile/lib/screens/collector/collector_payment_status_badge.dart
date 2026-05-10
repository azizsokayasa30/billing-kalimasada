import 'package:flutter/material.dart';

import '../../theme/collector_colors.dart';

/// Gaya pill status pembayaran — dipakai bersama oleh kartu pelanggan & prioritas dashboard.
class CollectorPaymentStatusBadgeStyle {
  const CollectorPaymentStatusBadgeStyle({
    required this.label,
    required this.background,
    required this.foreground,
    required this.border,
  });

  final String label;
  final Color background;
  final Color foreground;
  final Color border;

  Widget buildPill({double fontSize = 11}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: fontSize,
          fontWeight: FontWeight.w800,
          color: foreground,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

/// `isIsolirAccount`: status akun suspended — tampil sebagai Isolir.
CollectorPaymentStatusBadgeStyle collectorPaymentBadgeFor({
  required bool isIsolirAccount,
  required String paymentStatus,
}) {
  final ps = paymentStatus.toLowerCase();
  if (isIsolirAccount) {
    return CollectorPaymentStatusBadgeStyle(
      label: 'Isolir',
      background: FieldCollectorColors.errorContainer,
      foreground: FieldCollectorColors.onErrorContainer,
      border: FieldCollectorColors.onErrorContainer.withValues(alpha: 0.38),
    );
  }
  if (ps == 'paid') {
    return CollectorPaymentStatusBadgeStyle(
      label: 'Lunas',
      background: FieldCollectorColors.statLunasBg,
      foreground: FieldCollectorColors.statLunasIcon,
      border: FieldCollectorColors.statLunasIcon.withValues(alpha: 0.35),
    );
  }
  if (ps == 'no_invoice') {
    return CollectorPaymentStatusBadgeStyle(
      label: 'Baru',
      background: FieldCollectorColors.statTotalBg,
      foreground: FieldCollectorColors.statTotalIcon,
      border: FieldCollectorColors.statTotalIcon.withValues(alpha: 0.35),
    );
  }
  return CollectorPaymentStatusBadgeStyle(
    label: 'Belum bayar',
    background: FieldCollectorColors.statBelumBg,
    foreground: FieldCollectorColors.statBelumIcon,
    border: FieldCollectorColors.statBelumIcon.withValues(alpha: 0.35),
  );
}

/// Warna nominal besar di kartu (sama logika di pelanggan & prioritas).
Color collectorPaymentAmountHeadlineColor({
  required bool isIsolirAccount,
  required String paymentStatus,
}) {
  if (isIsolirAccount) return FieldCollectorColors.onSurface;
  final ps = paymentStatus.toLowerCase();
  if (ps == 'paid') return FieldCollectorColors.onSurfaceVariant;
  if (ps == 'overdue') return FieldCollectorColors.summaryOverdue;
  return FieldCollectorColors.onSurface;
}
