import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../store/auth_provider.dart';
import 'settings_screen.dart';

class TechnicianProfileScreen extends StatelessWidget {
  const TechnicianProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.read<AuthProvider>();

    // Colors from Stitch design
    const bgBackground = Color(0xFFFCF8FF);
    const bgSurfaceContainerLowest = Color(0xFFFFFFFF);
    const bgSurfaceContainerLow = Color(0xFFF6F1FF);
    const bgSurfaceContainer = Color(0xFFF0EBFF);

    const primaryColor = Color(0xFF070038);
    const secondaryColor = Color(0xFF7E4990);
    const textOnBackground = Color(0xFF19163F);
    const textOnSurfaceVariant = Color(0xFF474551);
    const outlineVariant = Color(0xFFC8C4D3);

    return Scaffold(
      backgroundColor: bgBackground,
      appBar: AppBar(
        backgroundColor: bgSurfaceContainerLowest,
        elevation: 0,
        scrolledUnderElevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            color: outlineVariant.withValues(alpha: 0.5),
            height: 1,
          ),
        ),
        title: const Text(
          'My Profile',
          style: TextStyle(
            color: primaryColor,
            fontSize: 22,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: primaryColor),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SettingsScreen()),
              );
            },
            tooltip: 'Settings',
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.redAccent),
            onPressed: () => _showLogoutDialog(context, auth),
            tooltip: 'Logout',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Profile Hero Card
            Container(
              decoration: BoxDecoration(
                color: bgSurfaceContainerLowest,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: outlineVariant.withValues(alpha: 0.5),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.02),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: const Color(0xFFE4DFFF),
                              width: 2,
                            ),
                            image: const DecorationImage(
                              image: NetworkImage(
                                'https://via.placeholder.com/150',
                              ), // Placeholder avatar
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                auth.user?['name'] ?? 'Technician',
                                style: const TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: textOnBackground,
                                ),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Field Technician',
                                style: TextStyle(
                                  fontSize: 16,
                                  color: textOnSurfaceVariant,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.green.shade50,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: Colors.green.shade200,
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.check_circle,
                                      size: 14,
                                      color: Colors.green.shade700,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Online',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.green.shade800,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Contact Information
            Container(
              decoration: BoxDecoration(
                color: bgSurfaceContainerLowest,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: outlineVariant.withValues(alpha: 0.5),
                ),
              ),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Contact Information',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: textOnBackground,
                    ),
                  ),
                  const Divider(height: 24),
                  _buildContactItem(
                    Icons.smartphone,
                    'Phone Number',
                    auth.user?['phone'] ?? '+62 811-2233-4455',
                    primaryColor,
                    bgSurfaceContainer,
                    onTap: () {
                      final phone = auth.user?['phone'] ?? '+6281122334455';
                      final url = Uri.parse('tel:$phone');
                      launchUrl(url);
                    },
                  ),
                  const SizedBox(height: 16),
                  _buildContactItem(
                    Icons.email,
                    'Email Address',
                    auth.user?['email'] ?? 'technician@kalimasada.net',
                    primaryColor,
                    bgSurfaceContainer,
                    onTap: () {
                      final email = auth.user?['email'] ?? 'technician@kalimasada.net';
                      final url = Uri.parse('mailto:$email');
                      launchUrl(url);
                    },
                  ),
                  const SizedBox(height: 16),
                  _buildContactItem(
                    Icons.location_on,
                    'Current Location',
                    auth.user?['area_coverage'] ?? 'Belum ada area',
                    primaryColor,
                    bgSurfaceContainer,
                    onTap: () {
                      final area = auth.user?['area_coverage'] ?? 'Indonesia';
                      final url = Uri.parse('geo:0,0?q=$area');
                      launchUrl(url);
                    },
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Riwayat Pekerjaan
            Container(
              decoration: BoxDecoration(
                color: bgSurfaceContainerLowest,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: outlineVariant.withValues(alpha: 0.5),
                ),
              ),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.work_history, color: secondaryColor),
                      SizedBox(width: 8),
                      Text(
                        'Riwayat Pekerjaan',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: textOnBackground,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Column(
                    children: [
                      _buildHistoryItem(
                        'Instalasi Pelanggan Baru',
                        '12 April 2026',
                        'Selesai',
                      ),
                      _buildHistoryItem(
                        'Perbaikan ODP Rusak',
                        '10 April 2026',
                        'Selesai',
                      ),
                      _buildHistoryItem(
                        'Maintenance Jaringan',
                        '05 April 2026',
                        'Selesai',
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 48), // Padding for bottom nav bar
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryItem(String title, String date, String status) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF6F1FF),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: const Color(0xFFC8C4D3).withValues(alpha: 0.5),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF19163F),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                date,
                style: const TextStyle(fontSize: 12, color: Color(0xFF474551)),
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: Colors.green.shade200),
            ),
            child: Text(
              status,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: Colors.green.shade700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContactItem(
    IconData icon,
    String label,
    String value,
    Color iconColor,
    Color bgIconColor, {
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4.0),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: bgIconColor, shape: BoxShape.circle),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF474551),
                      letterSpacing: 1.1,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF19163F),
                    ),
                  ),
                ],
              ),
            ),
            if (onTap != null)
              const Icon(Icons.chevron_right, color: Color(0xFFC8C4D3), size: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildChip(String label, Color bgColor, Color outlineColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: outlineColor.withValues(alpha: 0.5)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: Color(0xFF19163F),
        ),
      ),
    );
  }

  void _showLogoutDialog(BuildContext context, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              auth.logout();
            },
            child: const Text('Logout', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
