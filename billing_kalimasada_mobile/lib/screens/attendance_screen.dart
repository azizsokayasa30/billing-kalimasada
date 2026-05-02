import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_client.dart';
import 'settings_screen.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  bool _isLoading = true;
  bool _isActionLoading = false;
  String _status = 'awaiting'; // 'awaiting', 'checked_in', 'checked_out'
  Map<String, dynamic>? _attendanceData;
  Timer? _timer;
  DateTime _currentTime = DateTime.now();

  // Stitch Design System Colors
  static const Color bgColor = Color(0xFFFCF8FF);
  static const Color surfaceColor = Colors.white;
  static const Color primaryDark = Color(0xFF070038);
  static const Color textMain = Color(0xFF19163F);
  static const Color textSecondary = Color(0xFF474551);
  static const Color borderColor = Color(0xFFE4DFFF);
  static const Color mutedPurple = Color(0xFFEAE5FF);
  static const Color iconColor = Color(0xFF5A53AB);

  @override
  void initState() {
    super.initState();
    _fetchStatus();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          _currentTime = DateTime.now();
        });
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _fetchStatus() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiClient.get('/api/mobile/attendance/status');
      if (res.statusCode == 200) {
        final response = jsonDecode(res.body);
        if (response['success'] == true) {
          final data = response['data'];
          if (data == null) {
            _status = 'awaiting';
            _attendanceData = null;
          } else if (data['check_out'] != null) {
            _status = 'checked_out';
            _attendanceData = data;
          } else if (data['check_in'] != null) {
            _status = 'checked_in';
            _attendanceData = data;
          }
        }
      }
    } catch (e) {
      debugPrint('Error fetching attendance status: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal memuat status absensi: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<Position?> _determinePosition() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Layanan lokasi dinonaktifkan. Harap nyalakan GPS.'),
          ),
        );
      }
      return null;
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Izin lokasi ditolak.')));
        }
        return null;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Izin lokasi ditolak permanen, harap izinkan di pengaturan.',
            ),
          ),
        );
      }
      return null;
    }

    return await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
  }

  Future<void> _performAction(String type) async {
    if (_status == 'checked_out' && type != 'check_out') return; // If already fully checked out today

    setState(() => _isActionLoading = true);

    try {
      final position = await _determinePosition();
      if (position == null) {
        setState(() => _isActionLoading = false);
        return;
      }

      String? photoBase64;
      if (type == 'check_in') {
        final picker = ImagePicker();
        final XFile? photo = await picker.pickImage(
          source: ImageSource.camera,
          preferredCameraDevice: CameraDevice.front,
          imageQuality: 50,
          maxWidth: 800,
        );

        if (photo == null) {
          // User cancelled the camera
          setState(() => _isActionLoading = false);
          return;
        }

        final bytes = await photo.readAsBytes();
        photoBase64 = base64Encode(bytes);
      }

      final res = await ApiClient.post('/api/mobile/attendance', {
        'type': type,
        'location': {
          'latitude': position.latitude,
          'longitude': position.longitude,
        },
        'photo_base64': ?photoBase64,
      });

      if (res.statusCode == 200) {
        final response = jsonDecode(res.body);
        if (response['success'] == true) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(response['message'] ?? 'Berhasil!'),
                backgroundColor: Colors.green,
              ),
            );
          }
          await _fetchStatus();
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(response['message'] ?? 'Gagal melakukan aksi'),
                backgroundColor: Colors.red,
              ),
            );
          }
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Terjadi kesalahan server'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      debugPrint('Error performing attendance action: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isActionLoading = false);
      }
    }
  }

  String _formatTime(DateTime time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}:${time.second.toString().padLeft(2, '0')}';
  }

  String _formatShortTime(String? dateStr) {
    if (dateStr == null) return '--:--';
    try {
      final dt = DateTime.parse(dateStr).toLocal();
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      final month = monthNames[dt.month - 1];
      final day = dt.day.toString().padLeft(2, '0');
      final hour = dt.hour.toString().padLeft(2, '0');
      final minute = dt.minute.toString().padLeft(2, '0');
      return '$month $day, $hour:$minute';
    } catch (_) {
      return '--:--';
    }
  }

  void _showLeaveRequestForm(BuildContext context) {
    final dateController = TextEditingController();
    final reasonController = TextEditingController();
    final durationController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: bgColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
            left: 24,
            right: 24,
            top: 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Formulir Izin/Cuti',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: primaryDark,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              // Tanggal
              TextField(
                controller: dateController,
                style: const TextStyle(color: textMain),
                readOnly: true,
                onTap: () async {
                  final date = await showDatePicker(
                    context: context,
                    initialDate: DateTime.now(),
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (date != null) {
                    dateController.text = "${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}";
                  }
                },
                decoration: InputDecoration(
                  labelText: 'Hari/Tanggal',
                  labelStyle: const TextStyle(color: textSecondary),
                  prefixIcon: const Icon(Icons.calendar_today, color: iconColor),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: primaryDark, width: 2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // Alasan
              TextField(
                controller: reasonController,
                style: const TextStyle(color: textMain),
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Alasan Libur',
                  labelStyle: const TextStyle(color: textSecondary),
                  alignLabelWithHint: true,
                  prefixIcon: const Padding(
                    padding: EdgeInsets.only(bottom: 48.0),
                    child: Icon(Icons.edit_document, color: iconColor),
                  ),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: primaryDark, width: 2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // Lama Libur
              TextField(
                controller: durationController,
                style: const TextStyle(color: textMain),
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Lama Libur (Hari)',
                  labelStyle: const TextStyle(color: textSecondary),
                  prefixIcon: const Icon(Icons.access_time, color: iconColor),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: primaryDark, width: 2),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () {
                  if (dateController.text.isEmpty || reasonController.text.isEmpty || durationController.text.isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Harap lengkapi semua field terlebih dahulu.'),
                        backgroundColor: Colors.red,
                      ),
                    );
                    return;
                  }
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Permintaan izin telah dikirim untuk persetujuan.'),
                      backgroundColor: Colors.green,
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryDark,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Minta Persetujuan',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final statusText = _status == 'awaiting'
        ? 'Awaiting Check-in'
        : _status == 'checked_in'
        ? 'Active Shift'
        : 'Shift Completed';

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Attendance',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 20,
            color: primaryDark,
          ),
        ),
        centerTitle: false,
        backgroundColor: bgColor,
        elevation: 0,
        iconTheme: const IconThemeData(color: primaryDark),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16.0),
            child: GestureDetector(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const SettingsScreen(),
                  ),
                );
              },
              child: CircleAvatar(
                backgroundColor: mutedPurple,
                radius: 16,
                child: const Icon(Icons.person, color: textSecondary, size: 20),
              ),
            ),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: primaryDark))
          : RefreshIndicator(
              onRefresh: _fetchStatus,
              color: primaryDark,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Timer Section
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 32),
                      decoration: BoxDecoration(
                        color: surfaceColor,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: borderColor),
                      ),
                      child: Column(
                        children: [
                          const Text(
                            'CURRENT SHIFT STATUS',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.2,
                              color: textSecondary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _formatTime(_currentTime),
                            style: const TextStyle(
                              fontSize: 40,
                              fontWeight: FontWeight.w800,
                              color: primaryDark,
                              fontFamily: 'Inter',
                            ),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: mutedPurple,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: borderColor),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(
                                    color: textSecondary,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  statusText,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Action Area Buttons
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: (_status == 'awaiting' && !_isActionLoading)
                                ? () => _performAction('check_in')
                                : null,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green.shade600,
                              disabledBackgroundColor: borderColor,
                              padding: const EdgeInsets.symmetric(vertical: 20),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                              elevation: 0,
                            ),
                            child: _isActionLoading && _status == 'awaiting'
                                ? const SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.login, color: Colors.white),
                                      SizedBox(width: 8),
                                      Text(
                                        'Check-In',
                                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
                                      ),
                                    ],
                                  ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: (_status == 'checked_in' && !_isActionLoading)
                                ? () => _performAction('check_out')
                                : null,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.red.shade600,
                              disabledBackgroundColor: borderColor,
                              padding: const EdgeInsets.symmetric(vertical: 20),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                              elevation: 0,
                            ),
                            child: _isActionLoading && _status == 'checked_in'
                                ? const SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.logout, color: Colors.white),
                                      SizedBox(width: 8),
                                      Text(
                                        'Check-Out',
                                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
                                      ),
                                    ],
                                  ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton.icon(
                      onPressed: () => _showLeaveRequestForm(context),
                      icon: const Icon(Icons.event_busy, color: primaryDark),
                      label: const Text(
                        'Ajukan Izin/Cuti',
                        style: TextStyle(
                          color: primaryDark,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: primaryDark, width: 1.5),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Requirements Card
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: surfaceColor,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: borderColor),
                      ),
                      child: Column(
                        children: [
                          const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.verified_user_outlined,
                                color: primaryDark,
                                size: 22,
                              ),
                              SizedBox(width: 8),
                              Text(
                                'Check-in Requirements',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 16,
                                  color: primaryDark,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [
                              _buildRequirement(
                                Icons.camera_alt_outlined,
                                'SELFIE',
                              ),
                              _buildRequirement(
                                Icons.location_on_outlined,
                                'GPS',
                              ),
                              _buildRequirement(
                                Icons.qr_code_scanner,
                                'QR SCAN',
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Logs
                    const Text(
                      'Recent Logs',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: primaryDark,
                      ),
                    ),
                    const SizedBox(height: 16),
                    if (_attendanceData == null)
                      const Text(
                        'Belum ada log absensi hari ini.',
                        style: TextStyle(color: textSecondary),
                      )
                    else
                      Container(
                        decoration: BoxDecoration(
                          color: surfaceColor,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: borderColor),
                        ),
                        child: Column(
                          children: [
                            if (_attendanceData!['check_out'] != null)
                              _buildLogItem(
                                'System Check-Out',
                                _formatShortTime(_attendanceData!['check_out']),
                                Icons.logout,
                              ),
                            if (_attendanceData!['check_out'] != null)
                              const Divider(height: 1, color: borderColor),
                            if (_attendanceData!['check_in'] != null)
                              _buildLogItem(
                                'System Check-In',
                                _formatShortTime(_attendanceData!['check_in']),
                                Icons.login,
                              ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildRequirement(IconData icon, String label) {
    return Column(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: mutedPurple.withValues(alpha: 0.5),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: primaryDark, size: 28),
        ),
        const SizedBox(height: 12),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
            color: textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildLogItem(String title, String time, IconData icon) {
    return Padding(
      padding: const EdgeInsets.all(20.0),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(
              color: mutedPurple,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: textMain, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                    color: primaryDark,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  time,
                  style: const TextStyle(color: textSecondary, fontSize: 14),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFF0EBFF),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Text(
              'SITE B',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: textSecondary,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
