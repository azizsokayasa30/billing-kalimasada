import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../store/collector_provider.dart';
import '../../theme/collector_colors.dart';

String _rupiah(num? v) {
  final n = (v ?? 0).round();
  return 'Rp ${NumberFormat.decimalPattern('id_ID').format(n)}';
}

num? _coerceNum(dynamic v) {
  if (v == null) return null;
  if (v is num) return v;
  if (v is String) return num.tryParse(v);
  return num.tryParse(v.toString());
}

class CollectorHomeTab extends StatelessWidget {
  const CollectorHomeTab({super.key, this.onGoCustomersTab});

  /// Pindah ke tab Pelanggan (filter belum bayar di tab itu).
  final VoidCallback? onGoCustomersTab;

  @override
  Widget build(BuildContext context) {
    final c = context.watch<CollectorProvider>();
    final data = c.overview;
    final field = data != null ? data['fieldUi'] as Map<String, dynamic>? : null;
    final collector = data != null ? data['collector'] as Map<String, dynamic>? : null;

    if (c.overviewLoading && field == null) {
      return const Center(child: CircularProgressIndicator(color: FieldCollectorColors.primaryContainer));
    }
    if (c.overviewError != null && field == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(c.overviewError ?? '', textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => context.read<CollectorProvider>().fetchOverview(),
                child: const Text('Coba lagi'),
              ),
            ],
          ),
        ),
      );
    }

    final name = collector?['name']?.toString() ?? 'Kolektor';
    final initials = name.split(RegExp(r'\s+')).where((e) => e.isNotEmpty).map((e) => e[0]).take(2).join().toUpperCase();
    final area = field?['areaLabel']?.toString() ?? '';
    final displayDate = field?['displayDate']?.toString() ?? '';
    final target = (field?['targetMonth'] as num?)?.toInt() ?? 0;
    final terkumpul = (field?['terkumpul'] as num?)?.toInt() ?? 0;
    final pct = (field?['progressPct'] as num?)?.toInt() ?? 0;
    final sisa = (field?['sisaTarget'] as num?)?.toInt() ?? 0;
    final totalPlg = (field?['totalPelangganAktif'] as num?)?.toInt() ?? 0;
    final blm = (field?['belumBayarCount'] as num?)?.toInt() ?? 0;
    final lunas = (field?['lunasCount'] as num?)?.toInt() ?? 0;
    final isolir = (field?['isolirCount'] as num?)?.toInt() ?? 0;
    final priority = (field?['priorityCustomers'] as List?) ?? [];

    return RefreshIndicator(
      color: FieldCollectorColors.primaryContainer,
      onRefresh: () => context.read<CollectorProvider>().fetchOverview(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          _Card(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: FieldCollectorColors.onSurface,
                          )),
                      const SizedBox(height: 6),
                      _rowIcon(Icons.calendar_today, displayDate, context),
                      const SizedBox(height: 4),
                      _rowIcon(Icons.location_on, area, context),
                    ],
                  ),
                ),
                CircleAvatar(
                  radius: 24,
                  backgroundColor: FieldCollectorColors.primaryContainer,
                  child: Text(
                    initials.isEmpty ? 'K' : initials,
                    style: const TextStyle(
                      color: FieldCollectorColors.onPrimaryContainer,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              color: FieldCollectorColors.primaryContainer,
              borderRadius: BorderRadius.circular(12),
              boxShadow: const [
                BoxShadow(color: Color(0x33000000), blurRadius: 8, offset: Offset(0, 4)),
              ],
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              children: [
                Positioned(
                  right: -40,
                  top: -40,
                  child: Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.08),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'TARGET TAGIHAN BULAN INI',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 0.6,
                                    color: FieldCollectorColors.primaryFixedDim.withValues(alpha: 0.85),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _rupiah(target),
                                  style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w700,
                                    color: FieldCollectorColors.onPrimary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '$pct%',
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w700,
                                  color: FieldCollectorColors.secondaryFixed,
                                ),
                              ),
                              Text(
                                'Progress',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: FieldCollectorColors.primaryFixedDim.withValues(alpha: 0.95),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          value: pct / 100,
                          minHeight: 8,
                          backgroundColor: FieldCollectorColors.onPrimaryContainer.withValues(alpha: 0.35),
                          color: FieldCollectorColors.secondaryFixed,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            _rupiah(terkumpul),
                            style: TextStyle(
                              fontSize: 13,
                              color: FieldCollectorColors.primaryFixedDim.withValues(alpha: 0.95),
                            ),
                          ),
                          Text(
                            'Sisa: ${_rupiah(sisa)}',
                            style: TextStyle(
                              fontSize: 13,
                              color: FieldCollectorColors.primaryFixedDim.withValues(alpha: 0.95),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: FieldCollectorColors.primary,
                    foregroundColor: FieldCollectorColors.onPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  onPressed: () => onGoCustomersTab?.call(),
                  icon: const Icon(Icons.payments),
                  label: const Text('Tagih sekarang'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: FieldCollectorColors.onSurface,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Input pembayaran: gunakan portal /collector/payment di browser untuk sementara.')),
                    );
                  },
                  icon: const Icon(Icons.edit_document),
                  label: const Text('Input bayar'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _summaryGrid(context, totalPlg, blm, lunas, isolir),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Prioritas penagihan',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
              TextButton.icon(
                onPressed: () => onGoCustomersTab?.call(),
                icon: const Icon(Icons.arrow_forward, size: 16),
                label: const Text('Lihat semua'),
              ),
            ],
          ),
          ...priority.map<Widget>((p) {
            if (p == null || p is! Map) return const SizedBox.shrink();
            final m = Map<String, dynamic>.from(p);
            final pid = m['id'];
            final pname = m['name']?.toString() ?? '';
            final addr = m['address']?.toString() ?? '';
            final amt = _coerceNum(m['amount'])?.round() ?? 0;
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _Card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(pname, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                              const SizedBox(height: 4),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.home_work_outlined, size: 16, color: FieldCollectorColors.onSurfaceVariant),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      addr,
                                      style: const TextStyle(fontSize: 13, color: FieldCollectorColors.onSurfaceVariant),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: FieldCollectorColors.errorContainer,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'Belum bayar',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: FieldCollectorColors.onErrorContainer,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(_rupiah(amt), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                        TextButton.icon(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Pelanggan ID $pid — buka /collector/payment?customer_id=$pid di browser')),
                            );
                          },
                          icon: const Icon(Icons.chevron_right, size: 18),
                          label: const Text('Tagih'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _rowIcon(IconData icon, String text, BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: FieldCollectorColors.onSurfaceVariant),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 13, color: FieldCollectorColors.onSurfaceVariant),
          ),
        ),
      ],
    );
  }

  Widget _summaryGrid(BuildContext context, int total, int blm, int lunas, int isolir) {
    return Column(
      children: [
        _Card(
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFD4E3FF),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.group, color: Color(0xFF001C3A)),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text('Total pelanggan', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              ),
              Text('$total', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _Card(
                color: FieldCollectorColors.errorContainer,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.warning_amber, size: 18, color: FieldCollectorColors.onErrorContainer.withValues(alpha: 0.9)),
                        const SizedBox(width: 6),
                        Text(
                          'Belum bayar',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                            color: FieldCollectorColors.onErrorContainer.withValues(alpha: 0.95),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '$blm',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: FieldCollectorColors.onErrorContainer.withValues(alpha: 0.95),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _Card(
                color: FieldCollectorColors.secondaryContainer,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.check_circle, size: 18, color: FieldCollectorColors.onSecondaryContainer.withValues(alpha: 0.95)),
                        const SizedBox(width: 6),
                        Text(
                          'Lunas',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                            color: FieldCollectorColors.onSecondaryContainer.withValues(alpha: 0.95),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '$lunas',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: FieldCollectorColors.onSecondaryContainer.withValues(alpha: 0.95),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        _Card(
          color: FieldCollectorColors.tertiaryFixed,
          child: Row(
            children: [
              Icon(Icons.wifi_off, color: FieldCollectorColors.onTertiaryFixed.withValues(alpha: 0.9)),
              const SizedBox(width: 10),
              const Expanded(
                child: Text('Terisolir', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
              Text(
                '$isolir',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 20,
                  color: FieldCollectorColors.onTertiaryFixed.withValues(alpha: 0.95),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child, this.color});
  final Widget child;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color ?? FieldCollectorColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FieldCollectorColors.outlineVariant),
        boxShadow: color == null
            ? const [BoxShadow(color: Color(0x0A000000), blurRadius: 4, offset: Offset(0, 1))]
            : null,
      ),
      child: child,
    );
  }
}
