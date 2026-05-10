import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../store/collector_provider.dart';
import '../../theme/collector_colors.dart';
import 'collector_invoice_receipt_screen.dart';
import 'collector_receive_payment_screen.dart';

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

String? _waLaunchUri(String raw) {
  final digits = raw.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return null;
  var n = digits;
  if (n.startsWith('0')) {
    n = '62${n.substring(1)}';
  } else if (!n.startsWith('62')) {
    n = '62$n';
  }
  return 'https://wa.me/$n';
}

Uri? _mapsUri(double? lat, double? lng) {
  if (lat == null || lng == null) return null;
  if (lat == 0 && lng == 0) return null;
  return Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
}

Future<void> showCollectorCustomerDetailSheet(
  BuildContext context, {
  required Map<String, dynamic> row,
  Future<void> Function()? onRefreshCustomers,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: FieldCollectorColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetCtx) {
      final h = MediaQuery.sizeOf(sheetCtx).height;
      return SizedBox(
        height: h * 0.9,
        child: _CollectorCustomerDetailPanel(
          row: row,
          parentContext: context,
          onRefreshCustomers: onRefreshCustomers,
        ),
      );
    },
  );
}

class _CollectorCustomerDetailPanel extends StatefulWidget {
  const _CollectorCustomerDetailPanel({
    required this.row,
    required this.parentContext,
    this.onRefreshCustomers,
  });

  final Map<String, dynamic> row;
  final BuildContext parentContext;
  final Future<void> Function()? onRefreshCustomers;

  @override
  State<_CollectorCustomerDetailPanel> createState() => _CollectorCustomerDetailPanelState();
}

class _CollectorCustomerDetailPanelState extends State<_CollectorCustomerDetailPanel> {
  List<Map<String, dynamic>> _history = [];
  Map<String, dynamic> _pppSession = {};
  bool _loadingDetail = true;
  String? _detailError;
  bool _isolirLoading = false;

  int? get _customerId => int.tryParse(widget.row['id']?.toString() ?? '');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadDetail());
  }

  Future<void> _loadDetail() async {
    final id = _customerId;
    if (id == null) {
      setState(() {
        _loadingDetail = false;
        _detailError = 'ID pelanggan tidak valid';
      });
      return;
    }
    setState(() {
      _loadingDetail = true;
      _detailError = null;
    });
    try {
      final col = context.read<CollectorProvider>();
      final hist = await col.fetchCustomerInvoiceHistory(id);
      final ppp = await col.fetchCustomerPppSession(id);
      if (!mounted) return;
      setState(() {
        _history = hist;
        _pppSession = ppp;
        _loadingDetail = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _loadingDetail = false;
          _detailError = e.toString();
        });
      }
    }
  }

  Future<void> _promptIsolir() async {
    final cid = _customerId;
    if (cid == null) return;
    final reasonCtrl = TextEditingController(text: 'Peringatan penagihan kolektor');
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Isolir pelanggan?'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Layanan internet akan ditangguhkan (status isolir). Gunakan untuk peringatan penagihan sesuai kebijakan perusahaan.',
                style: TextStyle(fontSize: 14, height: 1.35),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: reasonCtrl,
                decoration: const InputDecoration(
                  labelText: 'Alasan / catatan',
                  border: OutlineInputBorder(),
                ),
                maxLines: 2,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF93000A)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Isolir'),
          ),
        ],
      ),
    );
    final reasonText = reasonCtrl.text.trim();
    reasonCtrl.dispose();
    if (confirm != true || !mounted) return;

    setState(() => _isolirLoading = true);
    final err = await context.read<CollectorProvider>().collectorIsolirCustomer(
          cid,
          reason: reasonText.isNotEmpty ? reasonText : 'Isolir manual oleh kolektor (peringatan)',
        );
    if (!mounted) return;
    setState(() => _isolirLoading = false);
    if (err != null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
      }
      return;
    }
    if (!mounted) return;
    Navigator.pop(context);
    final parentCtx = widget.parentContext;
    final refresh = widget.onRefreshCustomers;
    if (refresh != null) {
      unawaited(refresh());
    }
    if (parentCtx.mounted) {
      ScaffoldMessenger.of(parentCtx).showSnackBar(
        const SnackBar(content: Text('Status isolir disimpan. Daftar pelanggan diperbarui.')),
      );
    }
  }

  /// Tanpa mengandalkan [canLaunchUrl] saja (Android 11+ sering false tanpa &lt;queries&gt;).
  Future<void> _launchExternal(Uri uri) async {
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Tidak ada aplikasi untuk membuka: ${uri.scheme}://${uri.host}${uri.path}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal membuka tautan: $e')));
      }
    }
  }

  String _authModeLabel(String? m) {
    switch (m) {
      case 'radius':
        return 'RADIUS';
      case 'mikrotik':
        return 'Mikrotik';
      default:
        return '—';
    }
  }

  @override
  Widget build(BuildContext context) {
    final row = widget.row;
    final name = row['name']?.toString() ?? '';
    final phone = row['phone']?.toString().trim() ?? '';
    final addr = row['address']?.toString() ?? '';
    final ps = row['payment_status']?.toString() ?? '';
    final st = row['status']?.toString().toLowerCase() ?? '';
    final price = _coerceNum(row['package_price'])?.round() ?? 0;
    final pkg = row['package_name']?.toString() ?? '';
    final custId = row['customer_id']?.toString();
    final username = row['username']?.toString() ?? '';
    final idLine = custId != null && custId.isNotEmpty
        ? 'ID: $custId'
        : (username.isNotEmpty ? 'User: $username' : 'ID: ${row['id']}');

    final lat = _coerceNum(row['latitude'])?.toDouble();
    final lng = _coerceNum(row['longitude'])?.toDouble();
    final mapUri = _mapsUri(lat, lng);
    final waUri = phone.isNotEmpty ? _waLaunchUri(phone) : null;

    final pppoeRaw = row['pppoe_username']?.toString().trim() ?? '';
    final pppUser = pppoeRaw.isNotEmpty ? pppoeRaw : username;
    final pppProfile = row['pppoe_profile']?.toString().trim() ?? '';
    final routerName = row['router_name']?.toString().trim() ?? '';
    final loginChecked = _pppSession['login_checked']?.toString() ?? '';
    final pppOnline = _pppSession['online'] == true;
    final pppAuth = _pppSession['auth_mode']?.toString();

    final cid = _customerId;
    final isIsolir = st == 'suspended';
    final isPaid = ps == 'paid';
    final isUnpaidLike = ps == 'unpaid' || ps == 'overdue' || ps == 'no_invoice';
    final hasUnpaidInvoiceInHistory = !_loadingDetail &&
        _history.any((inv) {
          final s = (inv['status']?.toString() ?? '').toLowerCase();
          return s.isNotEmpty && s != 'paid';
        });
    // Terisolir tetap bisa ditagih bila ada tunggakan (ringkasan atau riwayat faktur).
    final showTagih = cid != null &&
        !isPaid &&
        (isUnpaidLike || (isIsolir && hasUnpaidInvoiceInHistory));
    final showResi = !isIsolir && isPaid;

    late String badge;
    late Color badgeBg;
    late Color badgeFg;
    if (isIsolir) {
      badge = 'Isolir';
      badgeBg = FieldCollectorColors.errorContainer;
      badgeFg = FieldCollectorColors.onErrorContainer;
    } else if (isPaid) {
      badge = 'Lunas';
      badgeBg = const Color(0xFFD3F5D6);
      badgeFg = const Color(0xFF0D5A16);
    } else if (ps == 'no_invoice') {
      badge = 'Baru';
      badgeBg = const Color(0xFFD4E3FF);
      badgeFg = const Color(0xFF001C3A);
    } else {
      badge = 'Belum bayar';
      badgeBg = const Color(0xFFFFDAD6);
      badgeFg = const Color(0xFF93000A);
    }

    final parent = widget.parentContext;
    final tahunBerjalan = DateTime.now().year;

    return Column(
      children: [
        const SizedBox(height: 10),
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
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
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
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: FieldCollectorColors.onSurface,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(idLine, style: const TextStyle(color: FieldCollectorColors.onSurfaceVariant, fontSize: 13)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(8)),
                    child: Text(badge, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: badgeFg)),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (phone.isNotEmpty)
                _linkTile(
                  context,
                  icon: Icons.chat_outlined,
                  title: 'WhatsApp',
                  subtitle: phone,
                  enabled: waUri != null,
                  onTap: waUri == null ? null : () => _launchExternal(Uri.parse(waUri)),
                ),
              if (phone.isNotEmpty) const SizedBox(height: 8),
              if (addr.isNotEmpty) ...[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.home_work_outlined, size: 20, color: FieldCollectorColors.onSurfaceVariant),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        addr,
                        style: const TextStyle(fontSize: 14, height: 1.35, color: FieldCollectorColors.onSurface),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],
              _linkTile(
                context,
                icon: Icons.map_outlined,
                title: 'Peta',
                subtitle: mapUri != null ? 'Buka lokasi di Google Maps' : 'Koordinat belum diisi',
                enabled: mapUri != null,
                onTap: mapUri == null
                    ? null
                    : () {
                        _launchExternal(mapUri);
                      },
              ),
              const SizedBox(height: 16),
              _sectionCard(
                context,
                title: 'Status PPP (sesi)',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_loadingDetail)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Center(
                          child: SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2, color: FieldCollectorColors.primaryContainer),
                          ),
                        ),
                      )
                    else if (!_pppSession.containsKey('online'))
                      const Text(
                        'Status sesi tidak dapat dimuat dari server.',
                        style: TextStyle(fontSize: 12, color: FieldCollectorColors.onSurfaceVariant, height: 1.35),
                      )
                    else if (loginChecked.isEmpty)
                      const Text(
                        'Login PPPoE belum diatur — tidak dapat mengecek sesi seperti di admin Mikrotik.',
                        style: TextStyle(fontSize: 12, color: FieldCollectorColors.onSurfaceVariant, height: 1.35),
                      )
                    else ...[
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: pppOnline ? const Color(0xFFD3F5D6) : const Color(0xFFE7E8E9),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              pppOnline ? 'Online' : 'Offline',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: pppOnline ? const Color(0xFF0D5A16) : FieldCollectorColors.onSurfaceVariant,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Sama dengan indikator sesi di /admin/mikrotik (${_authModeLabel(pppAuth)}).',
                              style: const TextStyle(fontSize: 11, color: FieldCollectorColors.onSurfaceVariant, height: 1.3),
                            ),
                          ),
                        ],
                      ),
                      if (isIsolir)
                        const Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Text(
                            'Akun billing: terisolir (suspensi).',
                            style: TextStyle(fontSize: 11, color: Color(0xFF93000A), fontWeight: FontWeight.w600),
                          ),
                        ),
                      const SizedBox(height: 10),
                      _kv('Login PPPoE', pppUser.isEmpty ? '—' : pppUser),
                      if (loginChecked.isNotEmpty && loginChecked != pppUser) _kv('Dicek ke Mikrotik', loginChecked),
                      if (pppProfile.isNotEmpty) _kv('Profil', pppProfile),
                      if (routerName.isNotEmpty) _kv('Router / NAS', routerName),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _sectionCard(
                context,
                title: 'Ringkasan tagihan',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _kv('Paket', pkg.isEmpty ? '—' : pkg),
                    _kv('Estimasi / tagihan bulanan', _rupiah(price)),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Riwayat tagihan (tahun $tahunBerjalan)',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: FieldCollectorColors.onSurface,
                    ),
              ),
              const SizedBox(height: 8),
              if (_loadingDetail)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator(color: FieldCollectorColors.primaryContainer)),
                )
              else if (_detailError != null)
                Text(_detailError!, style: const TextStyle(color: FieldCollectorColors.onErrorContainer))
              else if (_history.isEmpty)
                Text(
                  'Belum ada faktur tercatat pada tahun $tahunBerjalan.',
                  style: const TextStyle(color: FieldCollectorColors.onSurfaceVariant, height: 1.35),
                )
              else
                ..._history.map((inv) => _historyInvoiceTile(context, inv)),
            ],
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(20, 8, 20, MediaQuery.paddingOf(context).bottom + 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (showTagih)
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: FieldCollectorColors.primaryContainer,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () async {
                    Navigator.pop(context);
                    await Future<void>.delayed(Duration.zero);
                    if (!parent.mounted) return;
                    final done = await Navigator.of(parent).push<bool>(
                      MaterialPageRoute<bool>(
                        builder: (_) => CollectorReceivePaymentScreen(
                          customerId: cid,
                          customerSnapshot: Map<String, dynamic>.from(row),
                        ),
                      ),
                    );
                    if (done == true) {
                      await widget.onRefreshCustomers?.call();
                    }
                  },
                  icon: const Icon(Icons.payments_outlined),
                  label: Text(isIsolir ? 'Bayar / aktifkan' : 'Tagih'),
                ),
              if (showResi && cid != null) ...[
                if (showTagih) const SizedBox(height: 8),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: FieldCollectorColors.onSurface,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: FieldCollectorColors.outlineVariant),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () async {
                    Navigator.pop(context);
                    await Future<void>.delayed(Duration.zero);
                    if (!parent.mounted) return;
                    await Navigator.of(parent).push<void>(
                      MaterialPageRoute<void>(
                        builder: (_) => CollectorInvoiceReceiptScreen(customerId: cid),
                      ),
                    );
                  },
                  icon: const Icon(Icons.receipt_long_outlined),
                  label: const Text('Resi'),
                ),
              ],
              if (!isIsolir && cid != null) ...[
                if (showTagih || showResi) const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _isolirLoading ? null : _promptIsolir,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF93000A),
                    side: const BorderSide(color: Color(0xFFC62828)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: _isolirLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF93000A)),
                        )
                      : const Icon(Icons.portable_wifi_off_outlined),
                  label: Text(_isolirLoading ? 'Memproses…' : 'Isolir (peringatan)'),
                ),
              ],
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: _isolirLoading ? null : () => Navigator.pop(context),
                style: OutlinedButton.styleFrom(
                  foregroundColor: FieldCollectorColors.onSurfaceVariant,
                  side: const BorderSide(color: FieldCollectorColors.outlineVariant),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Batal'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(k, style: const TextStyle(fontSize: 12, color: FieldCollectorColors.onSurfaceVariant)),
          ),
          Expanded(
            child: Text(v, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: FieldCollectorColors.onSurface)),
          ),
        ],
      ),
    );
  }

  Widget _sectionCard(BuildContext context, {required String title, required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: FieldCollectorColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FieldCollectorColors.outlineVariant),
        boxShadow: const [BoxShadow(color: Color(0x0A000000), blurRadius: 4, offset: Offset(0, 1))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
              color: FieldCollectorColors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Widget _linkTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required bool enabled,
    required VoidCallback? onTap,
  }) {
    return Material(
      color: const Color(0xFFF3F4F6),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            children: [
              Icon(icon, color: enabled ? FieldCollectorColors.primaryContainer : FieldCollectorColors.onSurfaceVariant),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 13,
                        color: enabled ? FieldCollectorColors.primaryContainer : FieldCollectorColors.onSurfaceVariant,
                        decoration: enabled ? TextDecoration.underline : null,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.open_in_new, size: 18, color: FieldCollectorColors.onSurfaceVariant.withValues(alpha: enabled ? 1 : 0.4)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _historyInvoiceTile(BuildContext context, Map<String, dynamic> inv) {
    final numStr = inv['invoice_number']?.toString() ?? '#${inv['id']}';
    final amt = _coerceNum(inv['amount'])?.round() ?? 0;
    final due = inv['due_date']?.toString() ?? '';
    final created = inv['created_at']?.toString() ?? '';
    final pkgName = inv['package_name']?.toString() ?? inv['description']?.toString() ?? '';
    final stInv = (inv['status']?.toString() ?? '').toLowerCase();
    final isPaidInv = stInv == 'paid';

    String dueLabel = due;
    if (due.isNotEmpty) {
      try {
        final d = DateTime.tryParse(due);
        if (d != null) {
          dueLabel = DateFormat.yMMMd('id_ID').format(d);
        }
      } catch (_) {}
    }
    String createdLabel = created;
    if (created.isNotEmpty) {
      try {
        final d = DateTime.tryParse(created);
        if (d != null) {
          createdLabel = DateFormat.yMMMd('id_ID').format(d);
        }
      } catch (_) {}
    }

    final amtColor = isPaidInv ? const Color(0xFF1B5E20) : const Color(0xFFBA1A1A);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: FieldCollectorColors.outlineVariant),
        color: Colors.white,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(numStr, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: isPaidInv ? const Color(0xFFD3F5D6) : const Color(0xFFFFDAD6),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  isPaidInv ? 'Lunas' : 'Belum lunas',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: isPaidInv ? const Color(0xFF0D5A16) : const Color(0xFF93000A),
                  ),
                ),
              ),
            ],
          ),
          if (pkgName.isNotEmpty) Text(pkgName, style: const TextStyle(fontSize: 12, color: FieldCollectorColors.onSurfaceVariant)),
          const SizedBox(height: 6),
          Text('Terbit: $createdLabel', style: const TextStyle(fontSize: 11, color: FieldCollectorColors.onSurfaceVariant)),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Jatuh tempo: $dueLabel', style: const TextStyle(fontSize: 11, color: FieldCollectorColors.onSurfaceVariant)),
              Text(_rupiah(amt), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: amtColor)),
            ],
          ),
        ],
      ),
    );
  }
}
