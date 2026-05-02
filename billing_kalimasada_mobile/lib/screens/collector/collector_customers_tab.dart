import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../store/collector_provider.dart';
import '../../theme/collector_colors.dart';

String _rupiah(num? v) {
  final n = (v ?? 0).round();
  return 'Rp ${NumberFormat.decimalPattern('id_ID').format(n)}';
}

/// JSON API kadang kirim int/double/String; hindari cast [num?] yang melempar.
num? _coerceNum(dynamic v) {
  if (v == null) return null;
  if (v is num) return v;
  if (v is String) return num.tryParse(v);
  return num.tryParse(v.toString());
}

class CollectorCustomersTab extends StatefulWidget {
  const CollectorCustomersTab({super.key, this.initialStatus = '', this.syncStamp = 0});

  final String initialStatus;
  /// Naikkan nilai dari parent (mis. dari tombol "Tagih") agar filter & fetch diselaraskan.
  final int syncStamp;

  @override
  State<CollectorCustomersTab> createState() => _CollectorCustomersTabState();
}

class _CollectorCustomersTabState extends State<CollectorCustomersTab> with AutomaticKeepAliveClientMixin {
  final _search = TextEditingController();
  String _status = '';
  late final CollectorProvider _collectorProvider;
  late final VoidCallback _providerListener;
  int _lastReloadNonce = 0;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _status = widget.initialStatus;
    _collectorProvider = context.read<CollectorProvider>();
    _lastReloadNonce = _collectorProvider.customersReloadNonce;
    _providerListener = () {
      final n = _collectorProvider.customersReloadNonce;
      if (n != _lastReloadNonce) {
        _lastReloadNonce = n;
        _collectorProvider.fetchCustomers(status: _status, q: _search.text);
      }
    };
    _collectorProvider.addListener(_providerListener);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CollectorProvider>().fetchCustomers(status: _status, q: _search.text);
    });
  }

  @override
  void dispose() {
    _collectorProvider.removeListener(_providerListener);
    _search.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant CollectorCustomersTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.syncStamp != widget.syncStamp) {
      _status = widget.initialStatus;
      context.read<CollectorProvider>().fetchCustomers(status: _status, q: _search.text);
    }
  }

  Future<void> _reload() =>
      context.read<CollectorProvider>().fetchCustomers(status: _status, q: _search.text);

  void _setFilter(String s) {
    setState(() => _status = s);
    context.read<CollectorProvider>().fetchCustomers(status: s, q: _search.text);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final c = context.watch<CollectorProvider>();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _search,
                  decoration: InputDecoration(
                    hintText: 'Cari nama atau ID…',
                    prefixIcon: const Icon(Icons.search, color: FieldCollectorColors.onSurfaceVariant),
                    filled: true,
                    fillColor: const Color(0xFFE7E8E9),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(999)),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(999),
                      borderSide: const BorderSide(color: FieldCollectorColors.outlineVariant),
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  onSubmitted: (_) => _reload(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                style: IconButton.styleFrom(backgroundColor: FieldCollectorColors.primaryContainer),
                onPressed: _reload,
                icon: const Icon(Icons.search, color: Colors.white),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 40,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            children: [
              _chip('Semua', '', _status, _setFilter),
              _chip('Belum bayar', 'unpaid', _status, _setFilter),
              _chip('Lunas', 'paid', _status, _setFilter),
              _chip('Isolir', 'isolir', _status, _setFilter),
              _chip('Baru', 'baru', _status, _setFilter),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: c.customersLoading && c.customers.isEmpty
              ? const Center(child: CircularProgressIndicator(color: FieldCollectorColors.primaryContainer))
                  : c.customersError != null && c.customers.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(c.customersError ?? '', textAlign: TextAlign.center),
                            TextButton(onPressed: _reload, child: const Text('Coba lagi')),
                          ],
                        ),
                      ),
                    )
                  : !c.customersLoading && c.customers.isEmpty && c.customersError == null
                      ? RefreshIndicator(
                          color: FieldCollectorColors.primaryContainer,
                          onRefresh: _reload,
                          child: SingleChildScrollView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            child: SizedBox(
                              height: MediaQuery.sizeOf(context).height * 0.45,
                              child: Center(
                                child: Padding(
                                  padding: const EdgeInsets.all(24),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.group_outlined, size: 48, color: Colors.grey.shade400),
                                      const SizedBox(height: 12),
                                      Text(
                                        'Belum ada pelanggan di wilayah Anda\natau filter saat ini kosong.',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(color: Colors.grey.shade700, height: 1.35),
                                      ),
                                      const SizedBox(height: 8),
                                      TextButton.icon(
                                        onPressed: _reload,
                                        icon: const Icon(Icons.refresh),
                                        label: const Text('Muat ulang'),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        )
                      : RefreshIndicator(
                          color: FieldCollectorColors.primaryContainer,
                          onRefresh: _reload,
                          child: ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.all(16),
                            itemCount: c.customers.length,
                            itemBuilder: (context, i) {
                              final raw = c.customers[i];
                              if (raw is! Map) {
                                return const ListTile(
                                  title: Text('Baris data tidak valid'),
                                  leading: Icon(Icons.error_outline),
                                );
                              }
                              final row = Map<String, dynamic>.from(raw);
                              return _CustomerTile(row: row, onTap: () => _openSheet(context, row));
                            },
                          ),
                        ),
        ),
      ],
    );
  }

  /// Chip filter tanpa [FilterChip] M3 (hindari bug internal "Null check operator used on a null value").
  Widget _chip(String label, String value, String current, void Function(String) onTap) {
    final sel = current == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: sel ? FieldCollectorColors.primaryContainer : const Color(0xFFE7E8E9),
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          onTap: () => onTap(value),
          borderRadius: BorderRadius.circular(999),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Text(
              label,
              style: TextStyle(
                color: sel ? Colors.white : FieldCollectorColors.onSurface,
                fontWeight: FontWeight.w600,
                fontSize: 11,
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _openSheet(BuildContext context, Map<String, dynamic> row) {
    final name = row['name']?.toString() ?? '';
    final id = row['id'];
    final addr = row['address']?.toString() ?? '';
    final phone = row['phone']?.toString() ?? '';
    final ps = row['payment_status']?.toString() ?? '';
    final price = _coerceNum(row['package_price'])?.round() ?? 0;
    final pkg = row['package_name']?.toString() ?? '';

    String badge = 'Belum bayar';
    Color badgeBg = FieldCollectorColors.errorContainer;
    Color badgeFg = FieldCollectorColors.onErrorContainer;
    if (row['status'] == 'suspended') {
      badge = 'Isolir';
      badgeBg = FieldCollectorColors.tertiaryFixed;
      badgeFg = FieldCollectorColors.onTertiaryFixed;
    } else if (ps == 'paid') {
      badge = 'Lunas';
      badgeBg = FieldCollectorColors.secondaryContainer;
      badgeFg = FieldCollectorColors.onSecondaryContainer;
    } else if (ps == 'no_invoice') {
      badge = 'Baru';
      badgeBg = const Color(0xFFD4E3FF);
      badgeFg = const Color(0xFF001C3A);
    }

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: FieldCollectorColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 12, bottom: MediaQuery.paddingOf(ctx).bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: FieldCollectorColors.outlineVariant,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: Theme.of(ctx).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                      Text('ID: $id', style: const TextStyle(color: FieldCollectorColors.onSurfaceVariant)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(99)),
                  child: Text(badge, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: badgeFg)),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border.all(color: FieldCollectorColors.outlineVariant),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.home_work_outlined, color: FieldCollectorColors.onSurfaceVariant),
                      const SizedBox(width: 8),
                      Expanded(child: Text(addr)),
                    ],
                  ),
                  const Divider(height: 24),
                  const Text('TAGIHAN (PAKET)', style: TextStyle(fontSize: 10, color: FieldCollectorColors.onSurfaceVariant)),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(child: Text(pkg.isEmpty ? '—' : pkg)),
                      Text(_rupiah(price)),
                    ],
                  ),
                  const Divider(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total', style: TextStyle(fontWeight: FontWeight.w700)),
                      Text(_rupiah(price), style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFBA1A1A))),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: FieldCollectorColors.primary,
                foregroundColor: FieldCollectorColors.onPrimary,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              onPressed: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Pembayaran: buka /collector/payment?customer_id=$id di browser')),
                );
              },
              icon: const Icon(Icons.payments),
              label: const Text('Terima pembayaran'),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: phone.isEmpty
                        ? null
                        : () {
                            /* url_launcher optional */
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Hubungi: $phone')));
                          },
                    icon: const Icon(Icons.call),
                    label: const Text('Hubungi'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: null,
                    icon: const Icon(Icons.block),
                    label: const Text('Isolir'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CustomerTile extends StatelessWidget {
  const _CustomerTile({required this.row, required this.onTap});
  final Map<String, dynamic> row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final name = row['name']?.toString() ?? '';
    final addr = row['address']?.toString() ?? '';
    final ps = row['payment_status']?.toString() ?? '';
    final st = row['status']?.toString() ?? '';
    final price = _coerceNum(row['package_price'])?.round() ?? 0;

    Color stripe = const Color(0xFFBA1A1A);
    String badge = 'Belum bayar';
    Color badgeBg = FieldCollectorColors.errorContainer;
    Color badgeFg = FieldCollectorColors.onErrorContainer;
    if (st == 'suspended') {
      stripe = const Color(0xFFFDB69A);
      badge = 'Isolir';
      badgeBg = FieldCollectorColors.tertiaryFixed;
      badgeFg = FieldCollectorColors.onTertiaryFixed;
    } else if (ps == 'paid') {
      stripe = FieldCollectorColors.onSecondaryContainer;
      badge = 'Lunas';
      badgeBg = FieldCollectorColors.secondaryContainer;
      badgeFg = FieldCollectorColors.onSecondaryContainer;
    } else if (ps == 'no_invoice') {
      stripe = FieldCollectorColors.primaryFixedDim;
      badge = 'Baru';
      badgeBg = const Color(0xFFD4E3FF);
      badgeFg = const Color(0xFF001C3A);
    }

    final labelTag = ps == 'overdue' ? 'Tunggakan' : (ps == 'no_invoice' ? 'Estimasi' : 'Tagihan');

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: FieldCollectorColors.surface,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: FieldCollectorColors.outlineVariant),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(width: 4, decoration: BoxDecoration(color: stripe, borderRadius: const BorderRadius.horizontal(left: Radius.circular(11)))),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(99)),
                              child: Text(
                                badge,
                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: badgeFg),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(Icons.home_work_outlined, size: 18, color: FieldCollectorColors.onSurfaceVariant),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                addr,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 13, color: FieldCollectorColors.onSurfaceVariant),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  labelTag.toUpperCase(),
                                  style: const TextStyle(fontSize: 10, color: FieldCollectorColors.onSurfaceVariant),
                                ),
                                Text(
                                  _rupiah(price),
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 16,
                                    color: ps == 'overdue' ? const Color(0xFFBA1A1A) : FieldCollectorColors.onSurface,
                                  ),
                                ),
                              ],
                            ),
                            const CircleAvatar(
                              radius: 18,
                              backgroundColor: Color(0xFFE7E8E9),
                              child: Icon(Icons.chevron_right),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
