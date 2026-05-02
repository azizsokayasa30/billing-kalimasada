import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/colors.dart';
import '../store/auth_provider.dart';
import '../store/notification_provider.dart';
import '../screens/login_screen.dart';
import '../screens/technician_dashboard.dart';
import '../screens/collector/collector_home_tab.dart';
import '../screens/collector/collector_settlement_tab.dart';
import '../screens/collector/collector_profile_tab.dart';
import '../store/collector_provider.dart';
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
  NotificationProvider? _notificationProvider;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _notificationProvider ??= context.read<NotificationProvider>();
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
    _notificationProvider?.stopPolling();
    super.dispose();
  }

  void _navigateToTab(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> screens = [
      TechnicianDashboard(onNavigateToTab: _navigateToTab),
      const CustomerListScreen(),
      TaskListScreen(onNavigateToTab: _navigateToTab),
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
      onTap: () {
        setState(() {
          _currentIndex = index;
        });
      },
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
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _syncAll();
    });
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
                    icon: const Icon(Icons.sync),
                    onPressed: () => _syncAll(),
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
            label: 'Absen',
          ),
        ],
      ),
    );
  }
}
