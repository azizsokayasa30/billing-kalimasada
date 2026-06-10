import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../store/admin_provider.dart';
import '../../store/auth_provider.dart';
import '../../store/collector_provider.dart';
import '../../store/task_provider.dart';
import '../add_new_customer_screen.dart';
import '../network_status_screen.dart';
import '../new_task_screen.dart';
import '../tag_customer_location_screen.dart';
import '../tag_location_screen.dart';
import '../task_list_screen.dart';

class AdminDashboard extends StatefulWidget {
  final void Function(int index, {String? taskListFilter, String? customerStatus})?
      onNavigateToTab;

  const AdminDashboard({super.key, this.onNavigateToTab});

  @override
  State<AdminDashboard> createState() => _AdminDashboardState();
}

class _AdminDashboardState extends State<AdminDashboard> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
  }

  Future<void> _refresh() async {
    if (!mounted) return;
    await Future.wait<void>([
      context.read<AdminProvider>().fetchOverview(refresh: true),
      context.read<TaskProvider>().fetchTasks(refresh: true),
      context.read<CollectorProvider>().fetchOverview(),
    ]);
  }

  String _rupiah(num? v) {
    final n = (v ?? 0).round();
    return 'Rp ${NumberFormat.decimalPattern('id_ID').format(n)}';
  }

  void _goTab(int index, {String? taskFilter, String? customerStatus}) {
    if (widget.onNavigateToTab != null) {
      widget.onNavigateToTab!(
        index,
        taskListFilter: taskFilter,
        customerStatus: customerStatus,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final admin = context.watch<AdminProvider>();
    final data = admin.overview;
    final numFmt = NumberFormat.decimalPattern('id_ID');

    const bg = Color(0xFFF1ECF8);
    const primary = Color(0xFF070038);
    const primaryContainer = Color(0xFF1B0C6B);
    const surfaceTint = Color(0xFF5A53AB);
    const textOnPrimary = Color(0xFFFFFFFF);
    const inversePrimary = Color(0xFFC5C0FF);
    const textOnBackground = Color(0xFF19163F);
    const textMuted = Color(0xFF474551);
    const errorColor = Color(0xFFBA1A1A);

    final totalPlg = (data?['totalPelanggan'] as num?)?.toInt() ?? 0;
    final totalTagihan = (data?['totalTagihan'] as num?)?.toInt() ?? 0;
    final lunas = (data?['lunas'] as num?)?.toInt() ?? 0;
    final blmLunas = (data?['belumLunas'] as num?)?.toInt() ?? 0;
    final totalTugas = (data?['totalTugas'] as num?)?.toInt() ?? 0;
    final totalGangguan = (data?['totalGangguan'] as num?)?.toInt() ?? 0;
    final network = data?['networkStatus'] as Map<String, dynamic>?;
    final networkSummary = (network?['summary'] ?? 'unknown').toString();
    final activeSessions = (network?['activeSessions'] as num?)?.toInt() ?? 0;
    final routersOnline = (network?['routersOnline'] as num?)?.toInt() ?? 0;
    final routersTotal = (network?['routersTotal'] as num?)?.toInt() ?? 0;

    String networkLabel;
    Color networkColor;
    IconData networkIcon;
    switch (networkSummary) {
      case 'online':
        networkLabel = 'Jaringan normal · $activeSessions sesi aktif';
        networkColor = const Color(0xFF2E7D32);
        networkIcon = Icons.wifi;
        break;
      case 'partial':
        networkLabel = 'Sebagian router offline ($routersOnline/$routersTotal)';
        networkColor = const Color(0xFFF57C00);
        networkIcon = Icons.wifi_tethering_error_rounded;
        break;
      case 'offline':
        networkLabel = 'Semua router offline';
        networkColor = errorColor;
        networkIcon = Icons.wifi_off;
        break;
      default:
        networkLabel = 'Status jaringan belum tersedia';
        networkColor = textMuted;
        networkIcon = Icons.help_outline;
    }

    return Scaffold(
      backgroundColor: bg,
      body: RefreshIndicator(
        color: surfaceTint,
        onRefresh: _refresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 48, 16, 28),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [primary, primaryContainer],
                  ),
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(24),
                    bottomRight: Radius.circular(24),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Halo, ${auth.user?['name'] ?? auth.user?['username'] ?? 'Admin'}',
                      style: const TextStyle(
                        color: textOnPrimary,
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Panel Admin · Semua wilayah',
                      style: TextStyle(color: inversePrimary, fontSize: 14),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(Icons.admin_panel_settings, color: inversePrimary, size: 14),
                        const SizedBox(width: 4),
                        Text(
                          'Diperbarui ${DateFormat('HH:mm', 'id_ID').format(DateTime.now())}',
                          style: TextStyle(color: inversePrimary, fontSize: 12),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            if (admin.loading && data == null)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator(color: surfaceTint)),
              )
            else if (admin.error != null && data == null)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(admin.error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        FilledButton(onPressed: _refresh, child: const Text('Coba lagi')),
                      ],
                    ),
                  ),
                ),
              )
            else
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'RINGKASAN',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1,
                          color: textMuted,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: _statCard(
                              icon: Icons.groups_2_rounded,
                              label: 'Total pelanggan',
                              value: numFmt.format(totalPlg),
                              color: const Color(0xFF1565C0),
                              onTap: () => _goTab(1),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _statCard(
                              icon: Icons.receipt_long_rounded,
                              label: 'Total tagihan',
                              value: _rupiah(totalTagihan),
                              color: const Color(0xFF6A1B9A),
                              compactValue: true,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: _statCard(
                              icon: Icons.verified_rounded,
                              label: 'Lunas',
                              value: numFmt.format(lunas),
                              color: const Color(0xFF2E7D32),
                              onTap: () => _goTab(1, customerStatus: 'paid'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _statCard(
                              icon: Icons.pending_actions_rounded,
                              label: 'Belum lunas',
                              value: numFmt.format(blmLunas),
                              color: const Color(0xFFE65100),
                              onTap: () => _goTab(1, customerStatus: 'unpaid'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: _statCard(
                              icon: Icons.assignment_rounded,
                              label: 'Total tugas',
                              value: numFmt.format(totalTugas),
                              color: surfaceTint,
                              onTap: () => _goTab(2),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _statCard(
                              icon: Icons.warning_amber_rounded,
                              label: 'Gangguan',
                              value: numFmt.format(totalGangguan),
                              color: errorColor,
                              onTap: () => _goTab(2, taskFilter: 'Tiket'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const NetworkStatusScreen(),
                              ),
                            );
                          },
                          borderRadius: BorderRadius.circular(14),
                          child: Ink(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: networkColor.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: networkColor.withValues(alpha: 0.35)),
                            ),
                            child: Row(
                              children: [
                                Icon(networkIcon, color: networkColor, size: 28),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Status jaringan',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                          color: networkColor,
                                          fontSize: 13,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        networkLabel,
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: textOnBackground.withValues(alpha: 0.85),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Icon(Icons.chevron_right, color: networkColor),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),
                      const Text(
                        'AKSI CEPAT',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1,
                          color: textMuted,
                        ),
                      ),
                      const SizedBox(height: 10),
                      _quickAction(
                        icon: Icons.payments_rounded,
                        label: 'Input pembayaran',
                        filled: true,
                        onTap: () => _goTab(1, customerStatus: 'unpaid'),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: _quickAction(
                              icon: Icons.person_add_rounded,
                              label: 'Tambah pelanggan',
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => const AddNewCustomerScreen(),
                                  ),
                                );
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _quickAction(
                              icon: Icons.home_repair_service_rounded,
                              label: 'Tambah pemasangan',
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => const NewTaskScreen(),
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: _quickAction(
                              icon: Icons.report_problem_rounded,
                              label: 'Tambah gangguan',
                              onTap: () {
                                if (widget.onNavigateToTab != null) {
                                  _goTab(2, taskFilter: 'Tiket');
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => const NewTaskScreen(),
                                    ),
                                  );
                                } else {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => const TaskListScreen(
                                        initialTaskTypeFilter: 'Tiket',
                                      ),
                                    ),
                                  );
                                }
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _quickAction(
                              icon: Icons.qr_code_scanner,
                              label: 'Tag ODP',
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => const TagLocationScreen(),
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      _quickAction(
                        icon: Icons.person_pin_circle_outlined,
                        label: 'Tag pelanggan',
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const TagCustomerLocationScreen(),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _statCard({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
    VoidCallback? onTap,
    bool compactValue = false,
  }) {
    final card = Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE0E2E6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 10),
          Text(
            value,
            maxLines: compactValue ? 2 : 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: compactValue ? 15 : 22,
              fontWeight: FontWeight.w800,
              height: 1.1,
              color: const Color(0xFF191C1D),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
              color: Color(0xFF5F6368),
            ),
          ),
        ],
      ),
    );
    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(14), child: card),
    );
  }

  Widget _quickAction({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool filled = false,
  }) {
    const primary = Color(0xFF070038);
    const surfaceTint = Color(0xFF5A53AB);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Ink(
          height: 48,
          decoration: BoxDecoration(
            gradient: filled
                ? const LinearGradient(colors: [Color(0xFF1B0C6B), surfaceTint])
                : null,
            color: filled ? null : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: filled ? null : Border.all(color: const Color(0xFFC8C4D3).withValues(alpha: 0.6)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 20, color: filled ? Colors.white : primary),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: filled ? Colors.white : const Color(0xFF19163F),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
