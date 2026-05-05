import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../store/collector_provider.dart';
import '../../store/collector_notification_provider.dart';
import '../../theme/collector_colors.dart';
import 'collector_notifications_screen.dart';
import 'collector_customer_detail_sheet.dart';

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

/// Halaman Pelanggan kolektor (Field Collector) — layout mengikuti desain Stitch.
class CollectorCustomersScreen extends StatefulWidget {
  const CollectorCustomersScreen({
    super.key,
    required this.onOpenMenu,
    required this.onSync,
  });

  final VoidCallback onOpenMenu;
  final Future<void> Function() onSync;

  @override
  State<CollectorCustomersScreen> createState() => _CollectorCustomersScreenState();
}

class _CollectorCustomersScreenState extends State<CollectorCustomersScreen> {
  final _search = TextEditingController();
  String _status = '';
  bool _syncing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CollectorProvider>().fetchCustomers(status: _status, q: _search.text);
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    await context.read<CollectorProvider>().fetchCustomers(status: _status, q: _search.text);
  }

  void _setFilter(String s) {
    setState(() => _status = s);
    context.read<CollectorProvider>().fetchCustomers(status: s, q: _search.text);
  }

  Future<void> _doSync() async {
    if (_syncing) return;
    setState(() => _syncing = true);
    try {
      await widget.onSync();
      await _reload();
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.watch<CollectorProvider>();
    final unread = context.watch<CollectorNotificationProvider>().unreadCount;
    const bg = Color(0xFFF8F9FA);

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF001F3F),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: true,
        title: const Text(
          'Field Collector',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        leading: IconButton(
          icon: const Icon(Icons.menu),
          onPressed: widget.onOpenMenu,
        ),
        actions: [
          IconButton(
            tooltip: 'Notifikasi',
            iconSize: 32,
            padding: const EdgeInsets.all(10),
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            onPressed: () async {
              final nav = Navigator.of(context);
              final notifProv = context.read<CollectorNotificationProvider>();
              await nav.push<void>(
                MaterialPageRoute<void>(
                  builder: (_) => const CollectorNotificationsScreen(),
                ),
              );
              await notifProv.fetchNotifications(silent: true);
            },
            icon: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                const Icon(Icons.notifications_outlined, size: 32),
                if (unread > 0)
                  Positioned(
                    right: 0,
                    top: -1,
                    child: Container(
                      width: 11,
                      height: 11,
                      decoration: const BoxDecoration(
                        color: Color(0xFFFF1744),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1)),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
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
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(999),
                        borderSide: const BorderSide(color: Color(0xFF001F3F), width: 1.5),
                      ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                    ),
                    onSubmitted: (_) => _reload(),
                  ),
                ),
                const SizedBox(width: 8),
                Material(
                  color: FieldCollectorColors.primaryContainer,
                  borderRadius: BorderRadius.circular(999),
                  child: InkWell(
                    onTap: _reload,
                    borderRadius: BorderRadius.circular(999),
                    child: const Padding(
                      padding: EdgeInsets.all(12),
                      child: Icon(Icons.search, color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                _FilterChip(label: 'Semua', value: '', current: _status, onTap: _setFilter),
                _FilterChip(label: 'Belum Bayar', value: 'unpaid', current: _status, onTap: _setFilter),
                _FilterChip(label: 'Lunas', value: 'paid', current: _status, onTap: _setFilter),
                _FilterChip(label: 'Isolir', value: 'isolir', current: _status, onTap: _setFilter),
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
                    : RefreshIndicator(
                        color: FieldCollectorColors.primaryContainer,
                        onRefresh: _doSync,
                        child: !c.customersLoading && c.customers.isEmpty && c.customersError == null
                            ? ListView(
                                physics: const AlwaysScrollableScrollPhysics(),
                                children: [
                                  SizedBox(
                                    height: MediaQuery.sizeOf(context).height * 0.35,
                                    child: Center(
                                      child: Text(
                                        'Belum ada pelanggan untuk filter ini.',
                                        style: TextStyle(color: Colors.grey.shade700),
                                      ),
                                    ),
                                  ),
                                ],
                              )
                            : ListView.builder(
                                physics: const AlwaysScrollableScrollPhysics(),
                                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                                itemCount: c.customers.length,
                                itemBuilder: (context, i) {
                                  final raw = c.customers[i];
                                  if (raw is! Map) return const SizedBox.shrink();
                                  final row = Map<String, dynamic>.from(raw);
                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: 12),
                                    child: _CustomerCard(
                                      row: row,
                                      onOpenDetail: () => showCollectorCustomerDetailSheet(
                                        context,
                                        row: row,
                                        onRefreshCustomers: _reload,
                                      ),
                                    ),
                                  );
                                },
                              ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.value,
    required this.current,
    required this.onTap,
  });

  final String label;
  final String value;
  final String current;
  final void Function(String) onTap;

  @override
  Widget build(BuildContext context) {
    final sel = current == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: sel ? FieldCollectorColors.primaryContainer : Colors.white,
        elevation: sel ? 0 : 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(999),
          side: BorderSide(color: sel ? FieldCollectorColors.primaryContainer : FieldCollectorColors.outlineVariant),
        ),
        child: InkWell(
          onTap: () => onTap(value),
          borderRadius: BorderRadius.circular(999),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              label,
              style: TextStyle(
                color: sel ? Colors.white : FieldCollectorColors.onSurface,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  const _CustomerCard({
    required this.row,
    required this.onOpenDetail,
  });

  final Map<String, dynamic> row;
  final VoidCallback onOpenDetail;

  @override
  Widget build(BuildContext context) {
    final name = row['name']?.toString() ?? '';
    final addr = row['address']?.toString() ?? '';
    final ps = row['payment_status']?.toString() ?? '';
    final st = row['status']?.toString().toLowerCase() ?? '';
    final price = _coerceNum(row['package_price'])?.round() ?? 0;
    final custId = row['customer_id']?.toString();
    final username = row['username']?.toString() ?? '';
    final idLine = custId != null && custId.isNotEmpty
        ? 'ID: $custId'
        : (username.isNotEmpty ? 'ID: $username' : 'ID: ${row['id']}');

    final isIsolir = st == 'suspended';
    final isPaid = ps == 'paid';

    late String badgeLabel;
    late Color badgeBg;
    late Color badgeFg;
    late IconData badgeIcon;

    if (isIsolir) {
      badgeLabel = 'ISOLIR';
      badgeBg = const Color(0xFFE7E8E9);
      badgeFg = FieldCollectorColors.onSurfaceVariant;
      badgeIcon = Icons.block;
    } else if (isPaid) {
      badgeLabel = 'LUNAS';
      badgeBg = const Color(0xFFD3F5D6);
      badgeFg = const Color(0xFF0D5A16);
      badgeIcon = Icons.check_circle_outline;
    } else {
      badgeLabel = 'BELUM BAYAR';
      badgeBg = const Color(0xFFFFDAD6);
      badgeFg = const Color(0xFF93000A);
      badgeIcon = Icons.schedule;
    }

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      elevation: 0,
      child: InkWell(
        onTap: onOpenDetail,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: FieldCollectorColors.outlineVariant),
            boxShadow: const [BoxShadow(color: Color(0x0A000000), blurRadius: 6, offset: Offset(0, 2))],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17, color: FieldCollectorColors.onSurface),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            idLine,
                            style: const TextStyle(fontSize: 12, color: FieldCollectorColors.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: badgeBg,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(badgeIcon, size: 14, color: badgeFg),
                          const SizedBox(width: 4),
                          Text(
                            badgeLabel,
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: badgeFg, letterSpacing: 0.3),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.location_on_outlined, size: 18, color: FieldCollectorColors.onSurfaceVariant),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        addr.isEmpty ? '—' : addr,
                        style: const TextStyle(fontSize: 13, color: FieldCollectorColors.onSurfaceVariant, height: 1.35),
                      ),
                    ),
                  ],
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Divider(height: 1),
                ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            ps == 'overdue' ? 'TOTAL TAGIHAN (TUNGGAKAN)' : 'TOTAL TAGIHAN',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.4,
                              color: ps == 'overdue' ? const Color(0xFFBA1A1A) : FieldCollectorColors.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _rupiah(price),
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 18,
                              color: isPaid ? FieldCollectorColors.onSurfaceVariant : FieldCollectorColors.onSurface,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: FieldCollectorColors.onSurfaceVariant),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
