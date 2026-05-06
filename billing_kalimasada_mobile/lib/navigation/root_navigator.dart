import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/colors.dart';
import '../store/auth_provider.dart';
import '../store/notification_provider.dart';
import '../store/customer_provider.dart';
import '../store/task_provider.dart';
import '../screens/login_screen.dart';
import '../screens/technician_dashboard.dart';
import '../screens/collector/collector_home_tab.dart';
import '../screens/collector/collector_settlement_tab.dart';
import '../screens/collector/collector_profile_tab.dart';
import '../store/collector_provider.dart';
import '../store/collector_notification_provider.dart';
import '../screens/collector/collector_notifications_screen.dart';
import '../screens/attendance_screen.dart';
import '../screens/customer_list_screen.dart';
import '../screens/collector/collector_customers_screen.dart';

import '../screens/technician_profile_screen.dart';
import '../screens/task_list_screen.dart';
import '../screens/network_map_screen.dart';

class RootNavigator extends StatelessWidget {
  const RootNavigator({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (!auth.isInitialized) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    if (auth.token == null) {
      return const LoginScreen();
    }

    if (auth.role == 'technician') {
      return const _TechnicianTabs();
    } else if (auth.role == 'collector') {
      return const _CollectorTabs();
    } else {
      return const _AdminTabs();
    }
  }
}

class _TechnicianTabs extends StatefulWidget {
  const _TechnicianTabs();

  @override
  State<_TechnicianTabs> createState() => _TechnicianTabsState();
}

class _TechnicianTabsState extends State<_TechnicianTabs> {
  int _currentIndex = 0;
  /// Dipakai saat buka tab Tugas (mis. filter Tiket dari dashboard); `null` = Semua.
  String? _taskListInitialFilter;
  NotificationProvider? _notificationProvider;
  Set<int> _seenUnreadTroubleNotifIds = <int>{};

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_notificationProvider == null) {
      _notificationProvider = context.read<NotificationProvider>();
      _notificationProvider!.addListener(_onNotificationProviderChanged);
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final n = context.read<NotificationProvider>();
      n.ensurePolling();
      n.fetchNotifications(silent: true);
    });
  }

  @override
  void dispose() {
    _notificationProvider?.removeListener(_onNotificationProviderChanged);
    _notificationProvider?.stopPolling();
    super.dispose();
  }

  void _onNotificationProviderChanged() {
    final notif = _notificationProvider;
    if (notif == null || !mounted) return;

    final unreadTroubleIds = <int>{};
    for (final item in notif.items) {
      final kind = (item['kind'] ?? '').toString().toUpperCase();
      final unread = item['unread'] == true;
      if (kind != 'TR' || !unread) continue;
      final rawId = item['id'];
      final id = rawId is int ? rawId : int.tryParse(rawId?.toString() ?? '');
      if (id != null) unreadTroubleIds.add(id);
    }

    final hasNewTroubleNotif = unreadTroubleIds.any(
      (id) => !_seenUnreadTroubleNotifIds.contains(id),
    );
    _seenUnreadTroubleNotifIds = unreadTroubleIds;
    if (!hasNewTroubleNotif) return;

    // Saat tiket gangguan baru masuk, sinkronkan data agar badge/status pelanggan
    // dan angka pelanggan aktif di dashboard langsung ikut berubah.
    context.read<TaskProvider>().fetchTasks(refresh: true);
    context.read<CustomerProvider>().fetchDashboardStats();
  }

  void _navigateToTab(int index, {String? taskListFilter}) {
    setState(() {
      _currentIndex = index;
      if (index == 2) {
        _taskListInitialFilter = taskListFilter;
      } else {
        _taskListInitialFilter = null;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> screens = [
      TechnicianDashboard(onNavigateToTab: _navigateToTab),
      const CustomerListScreen(),
      TaskListScreen(
        key: ValueKey('tasks_${_taskListInitialFilter ?? 'all'}'),
        onNavigateToTab: _navigateToTab,
        initialTaskTypeFilter: _taskListInitialFilter,
      ),
      const NetworkMapScreen(),
      const TechnicianProfileScreen(),
    ];

    return Scaffold(
      body: screens[_currentIndex],
      // We will implement the custom bottom nav bar matching Stitch design inside the Scaffold's bottomNavigationBar
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFF9F8FC).withValues(alpha: 0.9),
          border: const Border(top: BorderSide(color: Color(0x4DC8C4D3))),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0D000000),
              offset: Offset(0, -10),
              blurRadius: 20,
              spreadRadius: -5,
            )
          ],
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildNavItem(0, Icons.home, 'Dashboard'),
                _buildNavItem(1, Icons.group, 'Pelanggan'),
                _buildNavItem(2, Icons.assignment, 'Tugas'),
                _buildNavItem(3, Icons.wifi, 'Jaringan'),
                _buildNavItem(4, Icons.account_circle, 'Profil'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, String label) {
    final isSelected = _currentIndex == index;
    final activeColor = const Color(0xFF5A53AB);
    final inactiveColor = const Color(0xFF594E97);
    
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _navigateToTab(index),
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.topCenter,
        children: [
          if (isSelected)
            Positioned(
              top: -8,
              child: Container(
                width: 32,
                height: 4,
                decoration: BoxDecoration(
                  color: activeColor,
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(4)),
                ),
              ),
            ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 48,
                height: 32,
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFFE4DFFF).withValues(alpha: 0.4) : Colors.transparent,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  icon,
                  color: isSelected ? activeColor : inactiveColor,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  color: isSelected ? activeColor : inactiveColor,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CollectorTabs extends StatefulWidget {
  const _CollectorTabs();

  @override
  State<_CollectorTabs> createState() => _CollectorTabsState();
}

class _CollectorTabsState extends State<_CollectorTabs> {
  int _currentIndex = 0;
  CollectorNotificationProvider? _collectorNotif;

  Future<void> _syncAll() async {
    final col = context.read<CollectorProvider>();
    await Future.wait([
      col.fetchOverview(),
      col.fetchSettlement(),
      col.fetchMe(),
      col.fetchCustomers(status: '', q: ''),
    ]);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _collectorNotif ??= context.read<CollectorNotificationProvider>();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _syncAll();
      final n = _collectorNotif ?? context.read<CollectorNotificationProvider>();
      n.ensurePolling();
      n.fetchNotifications(silent: true);
    });
  }

  @override
  void dispose() {
    _collectorNotif?.stopPolling();
    super.dispose();
  }

  void _goCustomersTab() {
    setState(() => _currentIndex = 1);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CollectorProvider>().fetchCustomers(status: '', q: '');
    });
  }

  void _onNavTap(int i) {
    setState(() => _currentIndex = i);
    final col = context.read<CollectorProvider>();
    if (i == 0) col.fetchOverview();
    if (i == 1) col.fetchCustomers(status: '', q: '');
    if (i == 2) col.fetchSettlement();
    if (i == 3) col.fetchMe();
  }

  @override
  Widget build(BuildContext context) {
    const bg = Color(0xFFF8F9FA);
    final titles = ['Field Collector', 'Pelanggan', 'Setoran', 'Profil'];
    final notif = context.watch<CollectorNotificationProvider>();
    final unread = notif.unreadCount;

    final body = IndexedStack(
      index: _currentIndex,
      children: [
        CollectorHomeTab(onGoCustomersTab: _goCustomersTab),
        CollectorCustomersScreen(
          onOpenMenu: () {
            setState(() => _currentIndex = 3);
            context.read<CollectorProvider>().fetchMe();
          },
          onSync: _syncAll,
        ),
        const CollectorSettlementTab(),
        const CollectorProfileTab(),
      ],
    );

    // ThemeData lengkap (bukan hanya colorScheme) agar FilterChip/M3 tidak null di runtime.
    return Theme(
      data: ThemeData.light(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: bg,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF001F3F), brightness: Brightness.light),
      ),
      child: Scaffold(
        backgroundColor: bg,
        // Tab Pelanggan = layar penuh seperti teknisi (CustomerListScreen punya AppBar sendiri).
        appBar: _currentIndex == 1
            ? null
            : AppBar(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF001F3F),
                elevation: 0,
                surfaceTintColor: Colors.transparent,
                title: Text(
                  titles[_currentIndex],
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                ),
                leading: IconButton(
                  icon: const Icon(Icons.menu),
                  onPressed: () {
                    setState(() => _currentIndex = 3);
                    context.read<CollectorProvider>().fetchMe();
                  },
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
        body: body,
        bottomNavigationBar: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Colors.grey.shade200)),
            boxShadow: const [BoxShadow(color: Color(0x0D000000), blurRadius: 10, offset: Offset(0, -2))],
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _collectorNavItem(0, Icons.dashboard, 'Dashboard'),
                  _collectorNavItem(1, Icons.group, 'Pelanggan'),
                  _collectorNavItem(2, Icons.payments, 'Setoran'),
                  _collectorNavItem(3, Icons.account_circle, 'Profil'),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _collectorNavItem(int index, IconData icon, String label) {
    final sel = _currentIndex == index;
    const active = Color(0xFF001F3F);
    const inactive = Color(0xFF94A3B8);
    return InkWell(
      onTap: () => _onNavTap(index),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: sel ? const Color(0xFFF1F5F9) : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: sel ? active : inactive, size: 24),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.4,
                color: sel ? active : inactive,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AdminTabs extends StatefulWidget {
  const _AdminTabs();

  @override
  State<_AdminTabs> createState() => _AdminTabsState();
}

class _AdminTabsState extends State<_AdminTabs> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const Scaffold(
      backgroundColor: AppColors.background,
      body: Center(
        child: Text('Admin Dashboard', style: TextStyle(color: AppColors.text)),
      ),
    ),
    const AttendanceScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textSecondary,
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.admin_panel_settings),
            label: 'Admin',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.fingerprint),
            label: 'Absensi',
          ),
        ],
      ),
    );
  }
}
