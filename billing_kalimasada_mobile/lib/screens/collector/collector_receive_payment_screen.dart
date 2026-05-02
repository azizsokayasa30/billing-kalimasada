import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../services/api_client.dart';
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

/// Terima pembayaran — setara `/collector/payment?customer_id=…` dengan tema Field Collector.
class CollectorReceivePaymentScreen extends StatefulWidget {
  const CollectorReceivePaymentScreen({
    super.key,
    required this.customerId,
    this.customerSnapshot,
  });

  final int customerId;
  final Map<String, dynamic>? customerSnapshot;

  @override
  State<CollectorReceivePaymentScreen> createState() => _CollectorReceivePaymentScreenState();
}

class _CollectorReceivePaymentScreenState extends State<CollectorReceivePaymentScreen> {
  final _amount = TextEditingController();
  final _notes = TextEditingController();
  final _picker = ImagePicker();

  List<Map<String, dynamic>> _invoices = [];
  final Set<int> _selectedIds = {};
  bool _loadingInvoices = true;
  String? _invoiceError;
  String _method = 'cash';
  XFile? _proof;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final col = context.read<CollectorProvider>();
      if (col.me == null) col.fetchMe();
      _loadInvoices();
    });
  }

  @override
  void dispose() {
    _amount.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _loadInvoices() async {
    setState(() {
      _loadingInvoices = true;
      _invoiceError = null;
    });
    try {
      final r = await ApiClient.get(
        '/api/mobile-adapter/collector/customer-invoices/${widget.customerId}',
      );
      final body = ApiClient.decodeJsonObject(r, debugLabel: 'collector/invoices');
      if (r.statusCode == 200 && body['success'] == true) {
        final raw = body['data'];
        final list = <Map<String, dynamic>>[];
        if (raw is List) {
          for (final e in raw) {
            if (e is Map) list.add(Map<String, dynamic>.from(e));
          }
        }
        _selectedIds
          ..clear()
          ..addAll(list.map((m) => _coerceNum(m['id'])?.toInt()).whereType<int>());
        _invoices = list;
        _syncAmountFromSelection();
      } else {
        _invoiceError = body['message']?.toString() ?? 'Gagal memuat tagihan';
        _invoices = [];
      }
    } catch (e) {
      _invoiceError = e.toString();
      _invoices = [];
    } finally {
      if (mounted) setState(() => _loadingInvoices = false);
    }
  }

  void _syncAmountFromSelection() {
    num sum = 0;
    for (final inv in _invoices) {
      final id = _coerceNum(inv['id'])?.toInt();
      if (id == null || !_selectedIds.contains(id)) continue;
      sum += _coerceNum(inv['amount']) ?? 0;
    }
    _amount.text = sum > 0 ? sum.round().toString() : '';
  }

  double _commissionRateFromMe(Map<String, dynamic>? me) {
    final r = _coerceNum(me?['commission_rate']);
    if (r == null) return 5;
    final d = r.toDouble();
    if (d < 0 || d > 100) return 5;
    return d;
  }

  num _commissionPreview(double ratePct) {
    final amt = num.tryParse(_amount.text.trim()) ?? 0;
    return (amt * ratePct) / 100;
  }

  Future<void> _pickProof() async {
    final src = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera),
              title: const Text('Kamera'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Galeri'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (src == null) return;
    final x = await _picker.pickImage(source: src, maxWidth: 1600, imageQuality: 85);
    if (x != null && mounted) setState(() => _proof = x);
  }

  Future<void> _submit() async {
    final amt = num.tryParse(_amount.text.trim());
    if (amt == null || amt <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Isi jumlah pembayaran yang valid.')),
      );
      return;
    }
    if (_method == 'transfer' && _proof == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unggah bukti transfer.')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final idsJson = jsonEncode(_selectedIds.map((e) => e.toString()).toList());
      final fields = <String, String>{
        'customer_id': widget.customerId.toString(),
        'payment_amount': amt.round().toString(),
        'payment_method': _method,
        'notes': _notes.text.trim(),
        'invoice_ids': idsJson,
      };
      final files = <http.MultipartFile>[];
      if (_method == 'transfer' && _proof != null) {
        final p = _proof!;
        files.add(await http.MultipartFile.fromPath('payment_proof', p.path, filename: p.name));
      }
      final resp = await ApiClient.postMultipart(
        '/api/mobile-adapter/collector/payment',
        fields,
        files: files,
      );
      final body = ApiClient.decodeJsonObject(resp, debugLabel: 'collector/payment');
      if (!mounted) return;
      if (resp.statusCode == 200 && body['success'] == true) {
        context.read<CollectorProvider>().bumpCustomersReload();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(body['message']?.toString() ?? 'Pembayaran tersimpan')),
        );
        Navigator.of(context).pop(true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(body['message']?.toString() ?? 'Gagal menyimpan')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<CollectorProvider>().me;
    final ratePct = _commissionRateFromMe(me);
    final snap = widget.customerSnapshot;
    final name = snap?['name']?.toString() ?? 'Pelanggan';
    final phone = snap?['phone']?.toString() ?? '';
    final addr = snap?['address']?.toString() ?? '';
    const bg = FieldCollectorColors.background;

    // Rute push tidak mewarisi Theme dari _CollectorTabs — hanya MaterialApp (dark).
    // Tanpa Theme.light di sini, onSurface putih sehingga teks hilang di kartu/field putih.
    return Theme(
      data: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        scaffoldBackgroundColor: bg,
        colorScheme: ColorScheme.fromSeed(
          seedColor: FieldCollectorColors.primaryContainer,
          brightness: Brightness.light,
        ).copyWith(
          surface: Colors.white,
          onSurface: FieldCollectorColors.onSurface,
          onSurfaceVariant: FieldCollectorColors.onSurfaceVariant,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: FieldCollectorColors.primaryContainer,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          titleTextStyle: TextStyle(
            color: FieldCollectorColors.primaryContainer,
            fontWeight: FontWeight.w800,
            fontSize: 18,
          ),
          iconTheme: IconThemeData(color: FieldCollectorColors.primaryContainer),
        ),
      ),
      child: Scaffold(
        backgroundColor: bg,
        appBar: AppBar(
          title: const Text('Terima pembayaran'),
          bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1)),
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: FieldCollectorColors.outlineVariant),
              boxShadow: const [BoxShadow(color: Color(0x0A000000), blurRadius: 6, offset: Offset(0, 2))],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
                const SizedBox(height: 6),
                Text('ID: ${widget.customerId}', style: const TextStyle(fontSize: 12, color: FieldCollectorColors.onSurfaceVariant)),
                if (phone.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(phone, style: const TextStyle(fontSize: 13, color: FieldCollectorColors.onSurfaceVariant)),
                ],
                if (addr.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.location_on_outlined, size: 16, color: FieldCollectorColors.onSurfaceVariant),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(addr, style: const TextStyle(fontSize: 13, color: FieldCollectorColors.onSurfaceVariant, height: 1.35)),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text('Tagihan belum lunas', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 8),
          if (_loadingInvoices)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator(color: FieldCollectorColors.primaryContainer)),
            )
          else if (_invoiceError != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  Text(_invoiceError!, textAlign: TextAlign.center),
                  TextButton(onPressed: _loadInvoices, child: const Text('Coba lagi')),
                ],
              ),
            )
          else if (_invoices.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: FieldCollectorColors.outlineVariant),
              ),
              child: const Text(
                'Tidak ada tagihan unpaid. Anda tetap bisa mencatat pembayaran di bawah (mis. setoran manual).',
                style: TextStyle(fontSize: 13, color: FieldCollectorColors.onSurfaceVariant, height: 1.35),
              ),
            )
          else
            ..._invoices.map((inv) {
              final id = _coerceNum(inv['id'])?.toInt() ?? 0;
              final invNo = inv['invoice_number']?.toString() ?? 'INV-$id';
              final pkg = inv['package_name']?.toString() ?? '—';
              final amount = _coerceNum(inv['amount'])?.round() ?? 0;
              final sel = _selectedIds.contains(id);
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () {
                      setState(() {
                        if (sel) {
                          _selectedIds.remove(id);
                        } else {
                          _selectedIds.add(id);
                        }
                        _syncAmountFromSelection();
                      });
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: Row(
                        children: [
                          Checkbox(
                            value: sel,
                            activeColor: FieldCollectorColors.primaryContainer,
                            onChanged: (v) {
                              setState(() {
                                if (v == true) {
                                  _selectedIds.add(id);
                                } else {
                                  _selectedIds.remove(id);
                                }
                                _syncAmountFromSelection();
                              });
                            },
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(invNo, style: const TextStyle(fontWeight: FontWeight.w700)),
                                Text(pkg, style: const TextStyle(fontSize: 12, color: FieldCollectorColors.onSurfaceVariant)),
                              ],
                            ),
                          ),
                          Text(_rupiah(amount), style: const TextStyle(fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
          const SizedBox(height: 20),
          TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Jumlah pembayaran',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 8),
          const Text('Metode pembayaran', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 4),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: FieldCollectorColors.outlineVariant),
            ),
            child: Column(
              children: [
                RadioListTile<String>(
                  title: const Text('Tunai'),
                  value: 'cash',
                  groupValue: _method,
                  activeColor: FieldCollectorColors.primaryContainer,
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() {
                      _method = v;
                      _proof = null;
                    });
                  },
                ),
                const Divider(height: 1),
                RadioListTile<String>(
                  title: const Text('Transfer bank'),
                  value: 'transfer',
                  groupValue: _method,
                  activeColor: FieldCollectorColors.primaryContainer,
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _method = v);
                  },
                ),
                const Divider(height: 1),
                RadioListTile<String>(
                  title: const Text('Lainnya'),
                  value: 'other',
                  groupValue: _method,
                  activeColor: FieldCollectorColors.primaryContainer,
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() {
                      _method = v;
                      _proof = null;
                    });
                  },
                ),
              ],
            ),
          ),
          if (_method == 'transfer') ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _pickProof,
              icon: const Icon(Icons.add_a_photo_outlined),
              label: Text(_proof == null ? 'Unggah bukti transfer' : 'Ganti foto: ${_proof!.name}'),
              style: OutlinedButton.styleFrom(
                foregroundColor: FieldCollectorColors.primaryContainer,
                side: const BorderSide(color: FieldCollectorColors.outlineVariant),
                minimumSize: const Size.fromHeight(48),
              ),
            ),
          ],
          const SizedBox(height: 16),
          TextField(
            controller: _notes,
            maxLines: 3,
            decoration: InputDecoration(
              labelText: 'Catatan (opsional)',
              filled: true,
              fillColor: Colors.white,
              alignLabelWithHint: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF8E6),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFFE082)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Estimasi komisi Anda', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                Text(
                  _rupiah(_commissionPreview(ratePct).round()),
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF856404)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            style: FilledButton.styleFrom(
              backgroundColor: FieldCollectorColors.primaryContainer,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _submitting
                ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Simpan pembayaran', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          ),
        ],
      ),
      ),
    );
  }
}
