import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../store/auth_provider.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {

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
              Navigator.pop(context); // close settings
              auth.logout();
            },
            child: const Text('Logout', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    
    const bgBackground = Color(0xFFFCF8FF);
    const textOnSurface = Color(0xFF19163F);
    const textOnSurfaceVariant = Color(0xFF474551);
    const primaryColor = Color(0xFF070038);
    const primaryContainer = Color(0xFF1B0C6B);

    return Scaffold(
      backgroundColor: bgBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: primaryContainer),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Settings',
          style: TextStyle(
            color: primaryContainer,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: false,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE2E8F0), height: 1),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Account Section
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF6F1FF), // surface-container-low
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(0xFFC8C4D3).withOpacity(0.3),
                ),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: primaryContainer, width: 2),
                          image: const DecorationImage(
                            image: NetworkImage(
                              'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1976&auto=format&fit=crop',
                            ),
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
                              auth.user?['name'] ?? 'Technician Name',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: textOnSurface,
                              ),
                            ),
                            Text(
                              'ID: ${auth.user?['id'] ?? 'Unknown'}',
                              style: const TextStyle(
                                fontSize: 16,
                                color: textOnSurfaceVariant,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(
                                  0xFFEAE5FF,
                                ), // surface-container-high
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: const [
                                  Icon(
                                    Icons.verified,
                                    size: 16,
                                    color: primaryColor,
                                  ),
                                  SizedBox(width: 4),
                                  Text(
                                    'FIELD TECH II',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: primaryColor,
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
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () => _showLogoutDialog(context, auth),
                    icon: const Icon(Icons.logout, color: Colors.white),
                    label: const Text(
                      'Logout',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFBA1A1A), // error
                      minimumSize: const Size(double.infinity, 48),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // App Preferences
            _buildSectionTitle('APP PREFERENCES'),
            const SizedBox(height: 8),
            _buildSettingsGroup([

              _buildSettingsTile(
                icon: Icons.notifications,
                title: 'Notifications',
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Pengaturan notifikasi sedang dikembangkan.')));
                },
              ),
            ]),
            const SizedBox(height: 32),

            // Technical Settings
            _buildSectionTitle('TECHNICAL'),
            const SizedBox(height: 8),
            _buildSettingsGroup([
              _buildSettingsTile(
                icon: Icons.sync,
                title: 'Sync Offline Data',
                subtitle: 'Last synced: Today, 08:30 AM',
                trailing: const Icon(
                  Icons.cloud_sync,
                  color: textOnSurfaceVariant,
                ),
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Menyinkronkan data offline...')));
                },
              ),
              _buildSettingsTile(
                icon: Icons.system_update,
                title: 'Check for Updates',
                subtitle: 'Version 2.4.1',
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Aplikasi Anda sudah versi terbaru.')));
                },
              ),
            ]),
            const SizedBox(height: 32),

            // Support & Legal
            _buildSectionTitle('SUPPORT & LEGAL'),
            const SizedBox(height: 8),
            _buildSettingsGroup([
              _buildSettingsTile(
                icon: Icons.help_center,
                title: 'Help Center',
                trailing: const Icon(
                  Icons.open_in_new,
                  color: textOnSurfaceVariant,
                ),
                onTap: () => launchUrl(Uri.parse('https://example.com/help')),
              ),
              _buildSettingsTile(
                icon: Icons.description,
                title: 'Terms of Service',
                onTap: () => launchUrl(Uri.parse('https://example.com/terms')),
              ),
              _buildSettingsTile(
                icon: Icons.privacy_tip,
                title: 'Privacy Policy',
                onTap: () => launchUrl(Uri.parse('https://example.com/privacy')),
                isLast: true,
              ),
            ]),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.bold,
          color: Color(0xFF474551),
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildSettingsGroup(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF6F1FF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFC8C4D3).withOpacity(0.3)),
      ),
      child: Column(children: children),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String title,
    String? subtitle,
    Widget? trailing,
    VoidCallback? onTap,
    bool isLast = false,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          border: isLast
              ? null
              : Border(
                  bottom: BorderSide(
                    color: const Color(0xFFC8C4D3).withOpacity(0.2),
                  ),
                ),
        ),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xFF1B0C6B)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 18,
                      color: Color(0xFF19163F),
                    ),
                  ),
                  if (subtitle != null)
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 14,
                        color: Color(0xFF474551),
                      ),
                    ),
                ],
              ),
            ),
            if (trailing != null)
              trailing
            else
              const Icon(Icons.chevron_right, color: Color(0xFF474551)),
          ],
        ),
      ),
    );
  }
}
