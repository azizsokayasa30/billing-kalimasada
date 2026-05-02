import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/colors.dart';
import '../store/auth_provider.dart';
import '../screens/login_screen.dart';
import '../screens/technician_dashboard.dart';
import '../screens/collector_dashboard.dart';
import '../screens/attendance_screen.dart';
import '../screens/customer_list_screen.dart';

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

  final List<Widget> _screens = [
    const CollectorDashboard(),
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
            icon: Icon(Icons.people),
            label: 'Pelanggan',
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
