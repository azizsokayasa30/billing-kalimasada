import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../services/api_client.dart';
import '../theme/colors.dart';

class BillingScreen extends StatefulWidget {
  const BillingScreen({super.key});

  @override
  State<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends State<BillingScreen> {
  bool _loading = true;
  String? _error;
  List<dynamic> _invoices = [];

  @override
  void initState() {
    super.initState();
    _fetchInvoices();
  }

  Future<void> _fetchInvoices() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final response = await ApiClient.get('/api/mobile-adapter/invoices');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          setState(() {
            _invoices = data['data'];
            _loading = false;
          });
        } else {
          setState(() {
            _error = data['message'];
            _loading = false;
          });
        }
      } else {
        setState(() {
          _error = 'Gagal memuat tagihan';
          _loading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Koneksi bermasalah: ${e.toString()}';
        _loading = false;
      });
    }
  }

  Widget _buildSkeleton() {
    return ListView.builder(
      itemCount: 5,
      itemBuilder: (context, index) {
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Shimmer.fromColors(
            baseColor: Colors.grey[800]!,
            highlightColor: Colors.grey[600]!,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(width: 200, height: 16, color: Colors.white),
                const SizedBox(height: 8),
                Container(width: 150, height: 14, color: Colors.white),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Daftar Tagihan'),
        backgroundColor: AppColors.surface,
      ),
      body: _loading
          ? _buildSkeleton()
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: AppColors.error)))
              : _invoices.isEmpty
                  ? const Center(child: Text('Tidak ada tagihan tertunggak.'))
                  : RefreshIndicator(
                      onRefresh: _fetchInvoices,
                      color: AppColors.primary,
                      child: ListView.builder(
                        itemCount: _invoices.length,
                        itemBuilder: (context, index) {
                          final invoice = _invoices[index];
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            color: AppColors.surface,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            child: ListTile(
                              title: Text(
                                invoice['customer_name'] ?? '-',
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Bulan: ${invoice['period_month']}/${invoice['period_year']}'),
                                  Text('Total: Rp ${invoice['amount']}'),
                                ],
                              ),
                              trailing: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.error.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Text(
                                  'Unpaid',
                                  style: TextStyle(
                                    color: AppColors.error,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              onTap: () {
                                // TODO: Handle payment process
                              },
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
