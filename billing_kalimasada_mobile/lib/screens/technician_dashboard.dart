import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../store/auth_provider.dart';
import '../store/customer_provider.dart';
import '../store/task_provider.dart';
import '../store/notification_provider.dart';
import 'notifications_screen.dart';
import 'technician_profile_screen.dart';
import 'attendance_screen.dart';
import 'network_status_screen.dart';
import 'customer_list_screen.dart';
import 'task_list_screen.dart';
import 'tag_location_screen.dart';

class TechnicianDashboard extends StatefulWidget {
  final void Function(int)? onNavigateToTab;
  
  const TechnicianDashboard({super.key, this.onNavigateToTab});

  @override
  State<TechnicianDashboard> createState() => _TechnicianDashboardState();
}

class _TechnicianDashboardState extends State<TechnicianDashboard> with SingleTickerProviderStateMixin {
  late AnimationController _blinkController;
  late Animation<double> _blinkAnimation;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CustomerProvider>().fetchDashboardStats();
      context.read<TaskProvider>().fetchTasks();
      context.read<NotificationProvider>().fetchNotifications(silent: true);
    });

    _blinkController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);
    _blinkAnimation = Tween<double>(begin: 0.3, end: 1.0).animate(CurvedAnimation(parent: _blinkController, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _blinkController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final provider = context.watch<CustomerProvider>();
    final taskProvider = context.watch<TaskProvider>();
    final stats = provider.stats;
    final activeTasks = taskProvider.tasks.where((t) => t['status'] != 'closed').length;

    // Design Colors from Stitch
    const bgBackground = Color(0xFFF1ECF8);
    const bgSurfaceContainerLowest = Color(0xFFFFFFFF);
    const bgSurfaceContainerLow = Color(0xFFF6F1FF);
    const bgSurfaceVariant = Color(0xFFE4DFFF);
    
    const primaryColor = Color(0xFF070038);
    const primaryContainerColor = Color(0xFF1B0C6B);
    const surfaceTint = Color(0xFF5A53AB);
    const secondaryColor = Color(0xFF7E4990);
    
    const textOnBackground = Color(0xFF19163F);
    const textOnSurfaceVariant = Color(0xFF474551);
    const textOnPrimary = Color(0xFFFFFFFF);
    const inversePrimary = Color(0xFFC5C0FF);
    const errorColor = Color(0xFFBA1A1A);

    return Scaffold(
      backgroundColor: bgBackground,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              padding: const EdgeInsets.only(top: 48, bottom: 32, left: 16, right: 16),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [primaryColor, primaryContainerColor],
                ),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(24),
                  bottomRight: Radius.circular(24),
                ),
              ),
              child: Stack(
                children: [
                  // Decorative elements
                  Positioned(
                    right: -40,
                    top: -40,
                    child: Container(
                      width: 160,
                      height: 160,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: surfaceTint.withValues(alpha: 0.2),
                      ),
                    ),
                  ),
                  Positioned(
                    left: -40,
                    bottom: 0,
                    child: Container(
                      width: 128,
                      height: 128,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: secondaryColor.withValues(alpha: 0.2),
                      ),
                    ),
                  ),
                  
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Hallo, ${auth.user?['name'] ?? 'Teknisi'}',
                                style: const TextStyle(
                                  color: textOnPrimary,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              Text(
                                auth.user?['area_coverage'] ?? 'Indonesia',
                                style: const TextStyle(
                                  color: inversePrimary,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                          Row(
                            children: [
                              Consumer<NotificationProvider>(
                                builder: (context, notif, _) {
                                  final c = notif.unreadCount;
                                  return Stack(
                                    clipBehavior: Clip.none,
                                    children: [
                                      IconButton(
                                        onPressed: () {
                                          final notif = context.read<NotificationProvider>();
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(builder: (context) => const NotificationsScreen()),
                                          ).then((_) {
                                            notif.fetchNotifications(silent: true);
                                          });
                                        },
                                        icon: const Icon(Icons.notifications_outlined, color: textOnPrimary),
                                        style: IconButton.styleFrom(
                                          backgroundColor: Colors.white.withValues(alpha: 0.1),
                                        ),
                                      ),
                                      if (c > 0)
                                        Positioned(
                                          right: 4,
                                          top: 4,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFBA1A1A),
                                              borderRadius: BorderRadius.circular(10),
                                              border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
                                            ),
                                            constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                                            child: Text(
                                              c > 99 ? '99+' : '$c',
                                              textAlign: TextAlign.center,
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 10,
                                                fontWeight: FontWeight.w700,
                                                height: 1.1,
                                              ),
                                            ),
                                          ),
                                        ),
                                    ],
                                  );
                                },
                              ),
                              const SizedBox(width: 8),
                              GestureDetector(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (context) => const TechnicianProfileScreen()),
                                  );
                                },
                                child: Container(
                                  width: 48,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: Colors.white.withValues(alpha: 0.1),
                                    border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                                  ),
                                  child: const Icon(Icons.account_circle, color: textOnPrimary, size: 28),
                                ),
                              ),
                            ],
                          )
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(Icons.update, color: inversePrimary, size: 14),
                          const SizedBox(width: 4),
                          Text(
                            'Last Updated: Today, 09:41 AM',
                            style: TextStyle(
                              color: inversePrimary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          
          SliverToBoxAdapter(
            child: Transform.translate(
              offset: const Offset(0, -16),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Statistics Cards
                    _buildMainStatCard(
                      title: 'Tugas Aktif',
                      value: '$activeTasks',
                      trend: 'Perlu diselesaikan',
                      icon: Icons.assignment_late,
                      surfaceLowest: bgSurfaceContainerLowest,
                      textVariant: errorColor,
                      surfaceTint: errorColor,
                      textOnBackground: errorColor,
                      trendIcon: Icons.warning_amber_rounded,
                      trendColor: Colors.red.shade600,
                      trendBgColor: Colors.red.shade50,
                      isBlinkingIcon: true,
                      onTap: () {
                        if (widget.onNavigateToTab != null) {
                          widget.onNavigateToTab!(2);
                        } else {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => const TaskListScreen(),
                            ),
                          );
                        }
                      },
                    ),
                    const SizedBox(height: 16),
                    _buildMainStatCard(
                      title: 'Total Customers',
                      value: '${stats['total'] ?? 0}',
                      trend: '+12%',
                      icon: Icons.group,
                      surfaceLowest: bgSurfaceContainerLowest,
                      textVariant: textOnSurfaceVariant,
                      surfaceTint: surfaceTint,
                      textOnBackground: textOnBackground,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: _buildSecondaryStatCard(
                            title: 'Aktif',
                            value: '${stats['active'] ?? 0}',
                            icon: Icons.check_circle,
                            surfaceLowest: bgSurfaceContainerLowest,
                            surfaceLow: Colors.green.shade50,
                            textVariant: Colors.green.shade700,
                            surfaceTint: Colors.green.shade600,
                            primaryFixed: Colors.green.shade100,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: _buildSecondaryStatCard(
                            title: 'Gangguan',
                            value: '${stats['isolated'] ?? 0}',
                            icon: Icons.error,
                            surfaceLowest: bgSurfaceContainerLowest,
                            surfaceLow: const Color(0xFFFFDAD6).withValues(alpha: 0.3),
                            textVariant: errorColor,
                            surfaceTint: errorColor,
                            primaryFixed: const Color(0xFFFFDAD6),
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => CustomerListScreen(initialFilter: 'isolated'),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                    
                    const SizedBox(height: 32),
                    
                    // Quick Actions
                    const Text(
                      'QUICK ACTIONS',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: textOnSurfaceVariant,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      width: double.infinity,
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [primaryContainerColor, surfaceTint],
                        ),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const AttendanceScreen()),
                          );
                        },
                        icon: const Icon(Icons.touch_app, color: textOnPrimary, size: 20),
                        label: const Text('absen dulu kakak !', style: TextStyle(color: textOnPrimary, fontWeight: FontWeight.w600)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        if (auth.role != 'technician') ...[
                          Expanded(
                            child: Container(
                              height: 48,
                              decoration: BoxDecoration(
                                color: bgSurfaceContainerLowest,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFC8C4D3).withValues(alpha: 0.6)),
                              ),
                              child: InkWell(
                                onTap: () {},
                                borderRadius: BorderRadius.circular(12),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.add_task, color: surfaceTint, size: 20),
                                    const SizedBox(width: 8),
                                    Text('Create Task', style: TextStyle(color: textOnBackground, fontWeight: FontWeight.w600)),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                        ],
                        Expanded(
                          child: Container(
                            height: 48,
                            decoration: BoxDecoration(
                              color: bgSurfaceContainerLowest,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFC8C4D3).withValues(alpha: 0.6)),
                            ),
                            child: InkWell(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (context) => const NetworkStatusScreen()),
                                );
                              },
                              borderRadius: BorderRadius.circular(12),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.wifi_tethering, color: surfaceTint, size: 20),
                                  const SizedBox(width: 8),
                                  Text('Network', style: TextStyle(color: textOnBackground, fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      height: 48,
                      decoration: BoxDecoration(
                        color: bgSurfaceContainerLowest,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFC8C4D3).withValues(alpha: 0.6)),
                      ),
                      child: InkWell(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const TagLocationScreen()),
                          );
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.qr_code_scanner, color: surfaceTint, size: 20),
                            const SizedBox(width: 8),
                            Text('Tag ODP', style: TextStyle(color: textOnBackground, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    ),
                    
                    const SizedBox(height: 32),
                    
                    // Chart Section Placeholder
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: bgSurfaceContainerLowest,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFC8C4D3).withValues(alpha: 0.4)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Weekly Activations',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                  color: textOnBackground,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: bgSurfaceContainerLow,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: const Color(0xFFC8C4D3).withValues(alpha: 0.5)),
                                ),
                                child: const Row(
                                  children: [
                                    Text(
                                      'THIS WEEK',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: textOnSurfaceVariant,
                                      ),
                                    ),
                                    Icon(Icons.expand_more, size: 16, color: textOnSurfaceVariant),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),
                          SizedBox(
                            height: 150,
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                _buildBarChart(label: 'M', value: 40, max: 100, isCurrent: false, variantColor: bgSurfaceVariant, tintColor: surfaceTint),
                                _buildBarChart(label: 'T', value: 65, max: 100, isCurrent: false, variantColor: bgSurfaceVariant, tintColor: surfaceTint),
                                _buildBarChart(label: 'W', value: 85, max: 100, isCurrent: true, variantColor: bgSurfaceVariant, tintColor: surfaceTint),
                                _buildBarChart(label: 'T', value: 30, max: 100, isCurrent: false, variantColor: bgSurfaceVariant, tintColor: surfaceTint),
                                _buildBarChart(label: 'F', value: 90, max: 100, isCurrent: false, variantColor: bgSurfaceVariant, tintColor: surfaceTint),
                                _buildBarChart(label: 'S', value: 50, max: 100, isCurrent: false, variantColor: bgSurfaceVariant, tintColor: surfaceTint),
                                _buildBarChart(label: 'S', value: 20, max: 100, isCurrent: false, variantColor: bgSurfaceVariant, tintColor: surfaceTint),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMainStatCard({
    required String title,
    required String value,
    required String trend,
    required IconData icon,
    required Color surfaceLowest,
    required Color textVariant,
    required Color surfaceTint,
    required Color textOnBackground,
    IconData? trendIcon,
    Color? trendColor,
    Color? trendBgColor,
    bool isBlinkingIcon = false,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: surfaceLowest,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFC8C4D3).withValues(alpha: 0.5)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
      child: Stack(
        children: [
          Positioned(
            right: -20,
            top: -20,
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: const Color(0xFFE4DFFF).withValues(alpha: 0.3),
                borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(80)),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    title.toUpperCase(),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: textVariant,
                      letterSpacing: 1.2,
                    ),
                  ),
                  isBlinkingIcon
                      ? FadeTransition(
                          opacity: _blinkAnimation,
                          child: Icon(icon, color: surfaceTint),
                        )
                      : Icon(icon, color: surfaceTint),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    value,
                    style: TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      color: textOnBackground,
                      letterSpacing: -1,
                    ),
                  ),
                  isBlinkingIcon
                      ? FadeTransition(
                          opacity: _blinkAnimation,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: trendBgColor ?? Colors.green.shade50,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              children: [
                                Icon(trendIcon ?? Icons.trending_up, size: 16, color: trendColor ?? Colors.green.shade600),
                                const SizedBox(width: 4),
                                Text(
                                  trend,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: trendColor ?? Colors.green.shade700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      : Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: trendBgColor ?? Colors.green.shade50,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            children: [
                              Icon(trendIcon ?? Icons.trending_up, size: 16, color: trendColor ?? Colors.green.shade600),
                              const SizedBox(width: 4),
                              Text(
                                trend,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: trendColor ?? Colors.green.shade700,
                                ),
                              ),
                            ],
                          ),
                        ),
                ],
              ),
              const SizedBox(height: 16),
              // Mini sparkline mockup
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (var height in [0.3, 0.45, 0.4, 0.6, 0.55, 0.8, 1.0])
                    Expanded(
                      child: Container(
                        height: 32 * height,
                        margin: const EdgeInsets.symmetric(horizontal: 2),
                        decoration: BoxDecoration(
                          color: surfaceTint.withValues(alpha: height == 1.0 ? 1.0 : 0.2 + (height * 0.5)),
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

  Widget _buildSecondaryStatCard({
    required String title,
    required String value,
    required IconData icon,
    required Color surfaceLowest,
    required Color surfaceLow,
    required Color textVariant,
    required Color surfaceTint,
    required Color primaryFixed,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [surfaceLowest, surfaceLow],
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFC8C4D3).withValues(alpha: 0.5)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 4,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title.toUpperCase(),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: textVariant,
                ),
              ),
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: primaryFixed.withValues(alpha: 0.5),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: surfaceTint, size: 18),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: surfaceTint,
                ),
              ),
              SizedBox(
                width: 40,
                height: 40,
                child: CircularProgressIndicator(
                  value: 0.88,
                  strokeWidth: 4,
                  backgroundColor: primaryFixed,
                  color: surfaceTint,
                ),
              ),
            ],
          ),
        ],
      ),
    ));
  }

  Widget _buildMiniStatCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
    required Color surfaceLowest,
    required Color textVariant,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: surfaceLowest,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFC8C4D3).withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 4,
                color: color,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title.toUpperCase(),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: textVariant,
                            ),
                          ),
                          Text(
                            value,
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w600,
                              color: color,
                              height: 1.2,
                            ),
                          ),
                        ],
                      ),
                      Icon(icon, color: color.withValues(alpha: 0.5)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBarChart({
    required String label,
    required int value,
    required int max,
    required bool isCurrent,
    required Color variantColor,
    required Color tintColor,
  }) {
    final heightRatio = value / max;
    return Expanded(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              return Stack(
                alignment: Alignment.bottomCenter,
                clipBehavior: Clip.none,
                children: [
                  Container(
                    height: 120 * heightRatio,
                    decoration: BoxDecoration(
                      color: isCurrent ? null : variantColor,
                      gradient: isCurrent
                          ? const LinearGradient(
                              begin: Alignment.bottomCenter,
                              end: Alignment.topCenter,
                              colors: [Color(0xFF1B0C6B), Color(0xFF5A53AB)],
                            )
                          : null,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                      boxShadow: isCurrent
                          ? [
                              BoxShadow(
                                color: const Color(0xFF5A53AB).withValues(alpha: 0.3),
                                blurRadius: 10,
                                offset: const Offset(0, -4),
                              )
                            ]
                          : null,
                    ),
                  ),
                ],
              );
            }
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
              color: isCurrent ? tintColor : const Color(0xFF474551),
            ),
          ),
        ],
      ),
    );
  }
}
