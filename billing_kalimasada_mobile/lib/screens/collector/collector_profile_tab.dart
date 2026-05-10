import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../store/auth_provider.dart';
import '../../store/collector_provider.dart';
import '../../theme/collector_colors.dart';
import 'collector_profile_edit_screen.dart';
import '../app_update_screen.dart';
import '../settings_screen.dart';

String _rupiah(num? v) {
  final n = (v ?? 0).round();
  return 'Rp ${NumberFormat.decimalPattern('id_ID').format(n)}';
}

class CollectorProfileTab extends StatefulWidget {
  const CollectorProfileTab({super.key});

  @override
  State<CollectorProfileTab> createState() => _CollectorProfileTabState();
}

class _CollectorProfileTabState extends State<CollectorProfileTab> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CollectorProvider>().fetchMe();
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final c = context.watch<CollectorProvider>();
    final m = c.me;
    final stats = m != null ? m['profileStats'] as Map<String, dynamic>? : null;
    final name = m?['name']?.toString() ?? 'Kolektor';
    final id = m?['id'];
    final comm = (stats?['monthlyCommission'] as num?)?.toInt() ?? 0;
    final tx = (stats?['totalCollections'] as num?)?.toInt() ?? 0;
    final rate = (stats?['successRate'] as num?)?.toInt() ?? 0;

    if (c.meLoading && m == null) {
      return const Center(child: CircularProgressIndicator(color: FieldCollectorColors.primaryContainer));
    }

    return RefreshIndicator(
      color: FieldCollectorColors.primaryContainer,
      onRefresh: () => context.read<CollectorProvider>().fetchMe(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const SizedBox(height: 8),
          CircleAvatar(
            radius: 48,
            backgroundColor: const Color(0xFFD4E3FF),
            child: const Icon(Icons.person, size: 52, color: Color(0xFF001C3A)),
          ),
          const SizedBox(height: 12),
          Text(name, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFEDEEEF),
                borderRadius: BorderRadius.circular(99),
                border: Border.all(color: FieldCollectorColors.outlineVariant),
              ),
              child: Text('ID: $id', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _infoCard(
                  icon: Icons.account_balance_wallet,
                  label: 'Komisi bulan ini',
                  value: _rupiah(comm),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _infoCard(
                  icon: Icons.trending_up,
                  label: 'Transaksi selesai',
                  value: '$tx',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: FieldCollectorColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: FieldCollectorColors.outlineVariant),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Performa Anda', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const Divider(height: 24),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Pembayaran tercatat', style: TextStyle(fontSize: 11, color: FieldCollectorColors.onSurfaceVariant)),
                          const SizedBox(height: 4),
                          Text('$tx', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text('Rasio lunas/tagihan', style: TextStyle(fontSize: 11, color: FieldCollectorColors.onSurfaceVariant)),
                        const SizedBox(height: 4),
                        Text('$rate%', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22, color: FieldCollectorColors.onSecondaryContainer)),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: rate / 100,
                    minHeight: 8,
                    backgroundColor: const Color(0xFFE1E3E4),
                    color: const Color(0xFF66DF75),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.settings_outlined),
                  title: const Text('Pengaturan akun'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    if (m == null) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Profil belum dimuat. Tarik untuk memuat ulang.')),
                      );
                      return;
                    }
                    Navigator.of(context).push<void>(
                      MaterialPageRoute<void>(builder: (_) => const CollectorProfileEditScreen()),
                    );
                  },
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.system_update_rounded),
                  title: const Text('Update aplikasi'),
                  subtitle: const Text('Cek versi & unduh APK'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.of(context).push<void>(
                      MaterialPageRoute<void>(builder: (_) => const AppUpdateScreen()),
                    );
                  },
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.tune_rounded),
                  title: const Text('Pengaturan aplikasi'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.of(context).push<void>(
                      MaterialPageRoute<void>(builder: (_) => const SettingsScreen()),
                    );
                  },
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.logout, color: Color(0xFFBA1A1A)),
                  title: const Text('Keluar', style: TextStyle(color: Color(0xFFBA1A1A), fontWeight: FontWeight.w600)),
                  onTap: () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Keluar?'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
                          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Keluar')),
                        ],
                      ),
                    );
                    if (ok == true && context.mounted) {
                      await context.read<AuthProvider>().logout();
                    }
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoCard({required IconData icon, required String label, required String value}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: FieldCollectorColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FieldCollectorColors.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: FieldCollectorColors.primary),
              const SizedBox(width: 6),
              Expanded(
                child: Text(label, style: const TextStyle(fontSize: 10, color: FieldCollectorColors.onSurfaceVariant)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        ],
      ),
    );
  }
}
