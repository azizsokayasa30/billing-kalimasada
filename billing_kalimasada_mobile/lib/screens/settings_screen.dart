import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:convert';
import 'dart:io';
import '../services/api_client.dart';
import '../store/auth_provider.dart';
import 'technician_profile_edit_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  static const String _githubRepoOwner = 'azizsokayasa30';
  static const String _githubRepoName = 'billing-kalimasada';

  String _currentVersion = '-';
  String _latestVersion = '-';
  String _latestReleaseNotes = '-';
  String? _latestApkUrl;
  String? _latestReleasePageUrl;
  bool _checkingUpdate = false;
  bool _installingUpdate = false;
  double? _downloadProgress; // 0.0 - 1.0
  /// `server` = manifest di API billing; `github` = release GitHub; `none` = belum ada data.
  String _updateSource = 'none';

  @override
  void initState() {
    super.initState();
    _loadVersionInfo();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      if (auth.role == 'technician') {
        auth.refreshTechnicianProfile();
      }
    });
  }

  Future<void> _loadVersionInfo() async {
    try {
      final info = await PackageInfo.fromPlatform();
      final current = '${info.version}+${info.buildNumber}';
      if (!mounted) return;
      setState(() {
        _currentVersion = current;
      });
    } catch (_) {}
    await _fetchLatestRelease(silent: true);
  }

  int _compareVersionLike(String a, String b) {
    List<int> parseParts(String v) {
      final cleaned = v.replaceFirst(RegExp(r'^[vV]'), '');
      final nums = RegExp(r'\d+').allMatches(cleaned).map((m) => int.parse(m.group(0)!)).toList();
      if (nums.isEmpty) return [0];
      return nums;
    }

    final pa = parseParts(a);
    final pb = parseParts(b);
    final maxLen = pa.length > pb.length ? pa.length : pb.length;
    for (var i = 0; i < maxLen; i++) {
      final va = i < pa.length ? pa[i] : 0;
      final vb = i < pb.length ? pb[i] : 0;
      if (va != vb) return va.compareTo(vb);
    }
    return 0;
  }

  bool get _hasNewVersion {
    if (_currentVersion == '-' || _latestVersion == '-') return false;
    return _compareVersionLike(_latestVersion, _currentVersion) > 0;
  }

  String get _updateSourceLabel {
    switch (_updateSource) {
      case 'server':
        return 'Server billing';
      case 'github':
        return 'GitHub';
      default:
        return '—';
    }
  }

  /// URL unduhan APK absolut (path relatif di-resolve ke [ApiClient.apiOrigin]).
  String? _absoluteApkUrl(String raw) {
    final t = raw.trim();
    if (t.isEmpty) return null;
    if (t.startsWith('http://') || t.startsWith('https://')) {
      return Uri.tryParse(t)?.toString();
    }
    final origin = ApiClient.apiOrigin;
    final p = t.startsWith('/') ? t : '/$t';
    return Uri.tryParse('$origin$p')?.toString();
  }

  Future<bool> _tryFetchManifestFromBillingServer() async {
    try {
      final uri = Uri.parse(
        '${ApiClient.apiOrigin}/api/mobile-adapter/app-update/manifest',
      );
      final res = await http
          .get(uri, headers: const {'Accept': 'application/json'})
          .timeout(const Duration(seconds: 25));
      if (res.statusCode != 200) return false;
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (!ApiClient.jsonSuccess(data['success'])) return false;
      final inner = data['data'];
      if (inner is! Map) return false;
      final m = Map<String, dynamic>.from(inner);
      if (m['configured'] != true) return false;
      final v = (m['version'] ?? '').toString().trim();
      final rawApk = (m['apk_url'] ?? '').toString().trim();
      if (v.isEmpty || rawApk.isEmpty) return false;
      final bn = m['build_number'];
      final buildNum = bn is int ? bn : int.tryParse(bn?.toString() ?? '') ?? 0;
      final notes = (m['release_notes'] ?? '').toString().trim();
      final apkAbs = _absoluteApkUrl(rawApk);
      if (apkAbs == null) return false;
      if (!mounted) return true;
      setState(() {
        _updateSource = 'server';
        _latestVersion = '$v+$buildNum';
        _latestReleaseNotes =
            notes.isNotEmpty ? notes : 'Pembaruan aplikasi mobile.';
        _latestApkUrl = apkAbs;
        _latestReleasePageUrl = null;
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _fetchLatestReleaseFromGithub({bool silent = false}) async {
    try {
      final uri = Uri.parse(
        'https://api.github.com/repos/$_githubRepoOwner/$_githubRepoName/releases/latest',
      );
      final res = await http
          .get(uri, headers: const {'Accept': 'application/vnd.github+json'})
          .timeout(const Duration(seconds: 25));
      if (res.statusCode != 200) {
        if (!silent && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Gagal cek update (HTTP ${res.statusCode})')),
          );
        }
        return;
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final tag = (data['tag_name']?.toString() ?? '').trim();
      final releaseUrl = (data['html_url']?.toString() ?? '').trim();
      final notes = (data['body']?.toString() ?? '').trim();
      String? apkUrl;
      final assets = data['assets'];
      if (assets is List) {
        for (final item in assets) {
          if (item is! Map) continue;
          final name = item['name']?.toString().toLowerCase() ?? '';
          final dl = item['browser_download_url']?.toString();
          if (dl != null && dl.isNotEmpty && name.endsWith('.apk')) {
            apkUrl = dl;
            break;
          }
        }
      }
      if (!mounted) return;
      setState(() {
        _updateSource = 'github';
        _latestVersion = tag.isNotEmpty ? tag : '-';
        _latestReleaseNotes =
            notes.isNotEmpty ? notes : 'Tidak ada catatan pembaruan.';
        _latestApkUrl = apkUrl;
        _latestReleasePageUrl = releaseUrl.isNotEmpty ? releaseUrl : null;
      });
      if (!silent && mounted) {
        final text = _hasNewVersion
            ? 'Update tersedia: $_latestVersion'
            : 'Aplikasi sudah versi terbaru ($_currentVersion)';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
      }
    } catch (e) {
      if (!silent && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal cek update: $e')),
        );
      }
    }
  }

  Future<void> _fetchLatestRelease({bool silent = false}) async {
    if (_checkingUpdate) return;
    if (mounted) {
      setState(() => _checkingUpdate = true);
    }
    try {
      if (await _tryFetchManifestFromBillingServer()) {
        if (!silent && mounted) {
          final text = _hasNewVersion
              ? 'Update tersedia: $_latestVersion (dari server billing)'
              : 'Aplikasi sudah versi terbaru ($_currentVersion)';
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
        }
        return;
      }
      await _fetchLatestReleaseFromGithub(silent: silent);
    } finally {
      if (mounted) {
        setState(() => _checkingUpdate = false);
      }
    }
  }

  Future<void> _downloadLatestUpdate() async {
    if (_installingUpdate) return;
    final target = _latestApkUrl ?? _latestReleasePageUrl;
    if (target == null || target.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Tidak ada URL APK. Admin: set manifest di server (public/mobile-app/manifest.json) atau lampirkan APK di release GitHub.',
            ),
          ),
        );
      }
      return;
    }

    // Android: unduh APK lalu langsung buka installer.
    if (Platform.isAndroid && _latestApkUrl != null && _latestApkUrl!.isNotEmpty) {
      final messenger = ScaffoldMessenger.of(context);
      try {
        if (mounted) {
          setState(() {
            _installingUpdate = true;
            _downloadProgress = 0;
          });
          messenger.showSnackBar(
            const SnackBar(content: Text('Mengunduh update APK...')),
          );
        }

        final client = http.Client();
        final dir = await getTemporaryDirectory();
        final filePath = '${dir.path}/kalimasada-update-${DateTime.now().millisecondsSinceEpoch}.apk';
        final file = File(filePath);
        try {
          final request = http.Request('GET', Uri.parse(_latestApkUrl!));
          final streamed = await client.send(request);
          if (streamed.statusCode != 200) {
            throw Exception('HTTP ${streamed.statusCode}');
          }

          final sink = file.openWrite();
          final totalBytes = streamed.contentLength ?? -1;
          var downloadedBytes = 0;
          await for (final chunk in streamed.stream) {
            sink.add(chunk);
            downloadedBytes += chunk.length;
            if (!mounted) continue;
            if (totalBytes > 0) {
              final p = (downloadedBytes / totalBytes).clamp(0.0, 1.0);
              setState(() => _downloadProgress = p);
            }
          }
          await sink.flush();
          await sink.close();
        } finally {
          client.close();
        }

        if (!mounted) return;
        messenger.showSnackBar(
          const SnackBar(content: Text('Unduhan selesai, membuka installer...')),
        );
        final result = await OpenFilex.open(
          file.path,
          type: 'application/vnd.android.package-archive',
        );
        if (result.type != ResultType.done && mounted) {
          messenger.showSnackBar(
            SnackBar(content: Text('Gagal membuka installer: ${result.message}')),
          );
        }
      } catch (e) {
        if (mounted) {
          messenger.showSnackBar(
            SnackBar(content: Text('Gagal unduh/instal update: $e')),
          );
        }
      } finally {
        if (mounted) {
          setState(() {
            _installingUpdate = false;
            _downloadProgress = null;
          });
        }
      }
      return;
    }

    // Fallback platform lain: buka halaman release.
    final uri = Uri.parse(target);
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tidak dapat membuka link update.')),
      );
    }
  }

  String _positionLabel(String? position) {
    switch ((position ?? 'technician').toLowerCase()) {
      case 'field_officer':
        return 'Petugas Lapangan';
      case 'collector':
        return 'Kolektor';
      case 'technician':
      default:
        return 'Teknisi Lapangan';
    }
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
    final u = auth.user;
    final photoUrl = (u?['photo_url']?.toString() ?? '').trim();
    final hasPhoto = photoUrl.isNotEmpty;
    final String roleChipLabel;
    if (auth.role == 'technician') {
      roleChipLabel = _positionLabel(u?['position']?.toString());
    } else if (auth.role == 'collector') {
      roleChipLabel = 'Kolektor';
    } else if (auth.role == 'agent') {
      roleChipLabel = 'Agen';
    } else if (auth.role == 'admin') {
      roleChipLabel = 'Admin';
    } else {
      roleChipLabel = 'Akun';
    }

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
                  color: const Color(0xFFC8C4D3).withValues(alpha: 0.3),
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
                          color: const Color(0xFFF0EBFF),
                          border: Border.all(color: primaryContainer, width: 2),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: hasPhoto
                            ? Image.network(
                                photoUrl,
                                width: 80,
                                height: 80,
                                fit: BoxFit.cover,
                                gaplessPlayback: true,
                                errorBuilder: (_, _, _) => Icon(
                                  Icons.person,
                                  size: 40,
                                  color: primaryContainer,
                                ),
                                loadingBuilder:
                                    (context, child, loadingProgress) {
                                      if (loadingProgress == null) return child;
                                      return Center(
                                        child: SizedBox(
                                          width: 28,
                                          height: 28,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: primaryContainer,
                                            value:
                                                loadingProgress
                                                        .expectedTotalBytes !=
                                                    null
                                                ? loadingProgress
                                                          .cumulativeBytesLoaded /
                                                      loadingProgress
                                                          .expectedTotalBytes!
                                                : null,
                                          ),
                                        ),
                                      );
                                    },
                              )
                            : Icon(
                                Icons.person,
                                size: 40,
                                color: primaryContainer,
                              ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              u?['name']?.toString() ?? 'Pengguna',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: textOnSurface,
                              ),
                            ),
                            Text(
                              'ID: ${u?['id'] ?? '-'}',
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
                                children: [
                                  const Icon(
                                    Icons.verified,
                                    size: 16,
                                    color: primaryColor,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    roleChipLabel.toUpperCase(),
                                    style: const TextStyle(
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

            if (auth.role == 'technician') ...[
              _buildSectionTitle('AKUN'),
              const SizedBox(height: 8),
              _buildSettingsGroup([
                _buildSettingsTile(
                  icon: Icons.manage_accounts,
                  title: 'Pengaturan akun',
                  subtitle: 'Ubah nama, alamat, email, dan nomor HP',
                  onTap: () {
                    Navigator.of(context).push<void>(
                      MaterialPageRoute<void>(
                        builder: (_) => const TechnicianProfileEditScreen(),
                      ),
                    );
                  },
                  isLast: true,
                ),
              ]),
              const SizedBox(height: 32),
            ],

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
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Menyinkronkan data offline...'),
                    ),
                  );
                },
              ),
              _buildSettingsTile(
                icon: Icons.system_update,
                title: 'Pembaruan aplikasi',
                subtitle: _checkingUpdate
                    ? 'Memeriksa update...'
                    : 'Versi: $_currentVersion → $_latestVersion · $_updateSourceLabel',
                trailing: _checkingUpdate
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        _hasNewVersion ? Icons.download_rounded : Icons.chevron_right,
                        color: textOnSurfaceVariant,
                      ),
                onTap: () async {
                  await _fetchLatestRelease();
                  if (!context.mounted) return;
                  final doUpdate = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: Text(_hasNewVersion ? 'Update tersedia' : 'Informasi versi'),
                      content: SizedBox(
                        width: 420,
                        child: SingleChildScrollView(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('Versi saat ini: $_currentVersion'),
                              Text('Versi terbaru: $_latestVersion'),
                              Text('Sumber: $_updateSourceLabel'),
                              const SizedBox(height: 12),
                              const Text(
                                'Detail pembaruan:',
                                style: TextStyle(fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                _latestReleaseNotes,
                                style: const TextStyle(fontSize: 13),
                              ),
                              if (_installingUpdate) ...[
                                const SizedBox(height: 14),
                                Text(
                                  _downloadProgress != null
                                      ? 'Progress unduhan: ${(_downloadProgress! * 100).toStringAsFixed(0)}%'
                                      : 'Menyiapkan unduhan...',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                LinearProgressIndicator(
                                  minHeight: 8,
                                  value: _downloadProgress,
                                  borderRadius: BorderRadius.circular(99),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Tutup'),
                        ),
                        if (_hasNewVersion)
                          FilledButton.icon(
                            onPressed: _installingUpdate
                                ? null
                                : () => Navigator.pop(ctx, true),
                            icon: _installingUpdate
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Icon(Icons.system_update_alt_rounded),
                            label: Text(
                              _installingUpdate
                                  ? (_downloadProgress != null
                                        ? 'Mengunduh ${(_downloadProgress! * 100).toStringAsFixed(0)}%'
                                        : 'Menyiapkan...')
                                  : 'Unduh & Instal',
                            ),
                          ),
                      ],
                    ),
                  );
                  if (doUpdate == true && context.mounted) {
                    await _downloadLatestUpdate();
                  }
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
                onTap: () =>
                    launchUrl(Uri.parse('https://example.com/privacy')),
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
        border: Border.all(color: const Color(0xFFC8C4D3).withValues(alpha: 0.3)),
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
                    color: const Color(0xFFC8C4D3).withValues(alpha: 0.2),
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
