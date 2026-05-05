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

const _kMonthShortId = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

class CollectorHomeTab extends StatefulWidget {
  const CollectorHomeTab({super.key, this.onGoCustomersTab});

  /// Pindah ke tab Pelanggan (filter belum bayar di tab itu).
  final VoidCallback? onGoCustomersTab;

  @override
  State<CollectorHomeTab> createState() => _CollectorHomeTabState();
}

class _CollectorHomeTabState extends State<CollectorHomeTab> {
  late int _month;
  late int _year;
  bool _syncedDropdownFromProvider = false;

  @override
  void initState() {
    super.initState();
    final n = DateTime.now();
    _month = n.month;
    _year = n.year;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_syncedDropdownFromProvider) return;
    final p = context.read<CollectorProvider>();
    if (p.overviewMonth != null && p.overviewYear != null) {
      _month = p.overviewMonth!;
      _year = p.overviewYear!;
    }
    _syncedDropdownFromProvider = true;
  }

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
                onPressed: () => context.read<CollectorProvider>().fetchOverview(month: _month, year: _year),
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
      onRefresh: () => context.read<CollectorProvider>().fetchOverview(month: _month, year: _year),
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
          _Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Periode target',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: FieldCollectorColors.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 10),
                LayoutBuilder(
                  builder: (context, constraints) {
                    const controlH = 48.0;
                    final labelStyle = Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: FieldCollectorColors.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        );
                    final narrow = constraints.maxWidth < 340;
                    final yearMin = DateTime.now().year - 2;
                    final yearMax = DateTime.now().year + 1;
                    final yearItems = [
                      for (var y = yearMin; y <= yearMax; y++) DropdownMenuItem<int>(value: y, child: Text('$y')),
                    ];

                    BoxDecoration fieldDeco() => BoxDecoration(
                          color: FieldCollectorColors.surface,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: FieldCollectorColors.outlineVariant),
                        );

                    Widget dropdownBox({required Widget child}) {
                      return SizedBox(
                        height: controlH,
                        child: DecoratedBox(
                          decoration: fieldDeco(),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            child: DropdownButtonHideUnderline(
                              child: Align(alignment: Alignment.centerLeft, child: child),
                            ),
                          ),
                        ),
                      );
                    }

                    final monthCtrl = dropdownBox(
                      child: DropdownButton<int>(
                        value: _month,
                        isExpanded: true,
                        isDense: true,
                        menuMaxHeight: 280,
                        icon: const Icon(Icons.arrow_drop_down, size: 22),
                        style: Theme.of(context).textTheme.bodyLarge,
                        items: [
                          for (var m = 1; m <= 12; m++)
                            DropdownMenuItem<int>(value: m, child: Text(_kMonthShortId[m - 1])),
                        ],
                        onChanged: (v) {
                          if (v != null) setState(() => _month = v);
                        },
                      ),
                    );
                    final yearCtrl = dropdownBox(
                      child: DropdownButton<int>(
                        value: _year,
                        isExpanded: true,
                        isDense: true,
                        menuMaxHeight: 280,
                        icon: const Icon(Icons.arrow_drop_down, size: 22),
                        style: Theme.of(context).textTheme.bodyLarge,
                        items: yearItems,
                        onChanged: (v) {
                          if (v != null) setState(() => _year = v);
                        },
                      ),
                    );
                    final applyStyle = FilledButton.styleFrom(
                      backgroundColor: FieldCollectorColors.periodApplyBackground,
                      foregroundColor: FieldCollectorColors.periodApplyForeground,
                      elevation: 0,
                      shadowColor: Colors.transparent,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      minimumSize: const Size(0, controlH),
                      maximumSize: const Size(double.infinity, controlH),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    );
                    final applyBtn = SizedBox(
                      height: controlH,
                      child: FilledButton(
                        style: applyStyle,
                        onPressed: () async {
                          await context.read<CollectorProvider>().fetchOverview(month: _month, year: _year);
                        },
                        child: const Text('Terapkan'),
                      ),
                    );

                    Widget labeledColumn(String label, Widget control) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(label, style: labelStyle),
                          const SizedBox(height: 6),
                          control,
                        ],
                      );
                    }

                    if (narrow) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          labeledColumn('Bulan', monthCtrl),
                          const SizedBox(height: 10),
                          labeledColumn('Tahun', yearCtrl),
                          const SizedBox(height: 10),
                          applyBtn,
                        ],
                      );
                    }
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Expanded(flex: 2, child: Text('Bulan', style: labelStyle)),
                            const SizedBox(width: 8),
                            Expanded(flex: 2, child: Text('Tahun', style: labelStyle)),
                            const SizedBox(width: 8),
                            SizedBox(
                              width: 102,
                              child: Text('\u00A0', style: labelStyle),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(flex: 2, child: monthCtrl),
                            const SizedBox(width: 8),
                            Expanded(flex: 2, child: yearCtrl),
                            const SizedBox(width: 8),
                            SizedBox(width: 102, child: applyBtn),
                          ],
                        ),
                      ],
                    );
                  },
                ),
              ],
            ),
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
                onPressed: () => widget.onGoCustomersTab?.call(),
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
    const statInnerH = 48.0;
    const statCardPad = EdgeInsets.symmetric(horizontal: 12, vertical: 8);
    const totalNumStyle = TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: FieldCollectorColors.onSurface);
    const belumTextStyle = TextStyle(
      fontWeight: FontWeight.w700,
      fontSize: 14,
      height: 1.1,
      color: FieldCollectorColors.summaryOverdue,
      letterSpacing: -0.2,
    );
    const belumNumStyle = TextStyle(
      fontWeight: FontWeight.w800,
      fontSize: 18,
      height: 1.0,
      color: FieldCollectorColors.summaryOverdue,
      letterSpacing: -0.3,
    );
    const lunasTextStyle = TextStyle(
      fontWeight: FontWeight.w700,
      fontSize: 14,
      height: 1.1,
      color: FieldCollectorColors.summaryPaid,
      letterSpacing: -0.2,
    );
    const lunasNumStyle = TextStyle(
      fontWeight: FontWeight.w800,
      fontSize: 18,
      height: 1.0,
      color: FieldCollectorColors.summaryPaid,
      letterSpacing: -0.3,
    );

    return Column(
      children: [
        _Card(
          padding: statCardPad,
          child: SizedBox(
            height: statInnerH,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
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
                  child: Text(
                    'Total pelanggan',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15, height: 1.15),
                  ),
                ),
                Text('$total', style: totalNumStyle),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _Card(
                padding: statCardPad,
                child: SizedBox(
                  height: statInnerH,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Icon(Icons.warning_amber_rounded, size: 20, color: FieldCollectorColors.summaryOverdue),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text('Belum bayar', maxLines: 2, overflow: TextOverflow.ellipsis, style: belumTextStyle),
                      ),
                      Text('$blm', style: belumNumStyle),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _Card(
                padding: statCardPad,
                child: SizedBox(
                  height: statInnerH,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Icon(Icons.check_circle_rounded, size: 20, color: FieldCollectorColors.summaryPaid),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text('Lunas', maxLines: 2, overflow: TextOverflow.ellipsis, style: lunasTextStyle),
                      ),
                      Text('$lunas', style: lunasNumStyle),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        _Card(
          padding: statCardPad,
          color: FieldCollectorColors.tertiaryFixed,
          child: SizedBox(
            height: statInnerH,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Icon(Icons.wifi_off, color: FieldCollectorColors.onTertiaryFixed.withValues(alpha: 0.9)),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text('Terisolir', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15, height: 1.15)),
                ),
                Text(
                  '$isolir',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                    height: 1.0,
                    color: FieldCollectorColors.onTertiaryFixed.withValues(alpha: 0.95),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child, this.color, this.padding});
  final Widget child;
  final Color? color;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final bg = color ?? FieldCollectorColors.surface;
    final subtleShadow = bg == FieldCollectorColors.surface;
    return Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FieldCollectorColors.outlineVariant),
        boxShadow: subtleShadow
            ? const [BoxShadow(color: Color(0x0A000000), blurRadius: 4, offset: Offset(0, 1))]
            : null,
      ),
      child: child,
    );
  }
}
