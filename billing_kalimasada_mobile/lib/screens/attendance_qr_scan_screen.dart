import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

/// Layar pemindaian QR untuk mode absensi "Scan QR".
class AttendanceQrScanScreen extends StatefulWidget {
  const AttendanceQrScanScreen({super.key});

  @override
  State<AttendanceQrScanScreen> createState() => _AttendanceQrScanScreenState();
}

class _AttendanceQrScanScreenState extends State<AttendanceQrScanScreen>
    with WidgetsBindingObserver {
  final MobileScannerController _controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    facing: CameraFacing.back,
  );

  bool _handled = false;
  bool _loadingPermission = true;
  bool _cameraDenied = false;
  bool _showScanner = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_prepareCamera());
  }

  Future<void> _prepareCamera() async {
    if (kIsWeb) {
      if (!mounted) return;
      setState(() {
        _loadingPermission = false;
        _showScanner = true;
        _cameraDenied = false;
      });
      return;
    }

    if (!Platform.isAndroid && !Platform.isIOS) {
      if (!mounted) return;
      setState(() {
        _loadingPermission = false;
        _showScanner = true;
        _cameraDenied = false;
      });
      return;
    }

    var status = await Permission.camera.status;
    if (!status.isGranted) {
      status = await Permission.camera.request();
    }

    if (!mounted) return;

    if (status.isGranted || status.isLimited) {
      setState(() {
        _loadingPermission = false;
        _cameraDenied = false;
        _showScanner = true;
      });
      return;
    }

    setState(() {
      _loadingPermission = false;
      _cameraDenied = true;
      _showScanner = false;
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed || !mounted || _handled) return;
    if (_cameraDenied) {
      unawaited(_prepareCamera());
    } else if (_showScanner) {
      unawaited(_controller.start());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_handled || !mounted) return;
    for (final b in capture.barcodes) {
      final v = b.rawValue;
      if (v != null && v.trim().isNotEmpty) {
        _handled = true;
        try {
          await _controller.stop();
        } catch (_) {}
        if (!mounted) return;
        await Future<void>.delayed(const Duration(milliseconds: 100));
        if (!mounted) return;
        Navigator.of(context).pop<String>(v.trim());
        return;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Scan QR absensi'),
        backgroundColor: const Color(0xFF070038),
        foregroundColor: Colors.white,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loadingPermission) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: Colors.white),
            SizedBox(height: 16),
            Text(
              'Meminta izin kamera…',
              style: TextStyle(color: Colors.white70, fontSize: 15),
            ),
          ],
        ),
      );
    }

    if (_cameraDenied) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.videocam_off, color: Colors.white54, size: 56),
              const SizedBox(height: 20),
              const Text(
                'Izin kamera diperlukan untuk memindai QR.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 16),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () async {
                  await openAppSettings();
                },
                child: const Text('Buka pengaturan'),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () {
                  setState(() {
                    _loadingPermission = true;
                    _cameraDenied = false;
                  });
                  unawaited(_prepareCamera());
                },
                style: OutlinedButton.styleFrom(foregroundColor: Colors.white),
                child: const Text('Coba lagi'),
              ),
            ],
          ),
        ),
      );
    }

    if (!_showScanner) {
      return const SizedBox.shrink();
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            fit: BoxFit.cover,
            tapToFocus: true,
            placeholderBuilder: (_) => const ColoredBox(
              color: Colors.black,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: Colors.white),
                    SizedBox(height: 16),
                    Text(
                      'Menyiapkan kamera…',
                      style: TextStyle(color: Colors.white70, fontSize: 14),
                    ),
                  ],
                ),
              ),
            ),
            errorBuilder: (context, error) {
              return ColoredBox(
                color: Colors.black,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, color: Colors.white, size: 48),
                        const SizedBox(height: 16),
                        Text(
                          _errorMessage(error),
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white, fontSize: 15),
                        ),
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: () async {
                            try {
                              await _controller.start();
                            } catch (_) {}
                            if (mounted) setState(() {});
                          },
                          child: const Text('Coba lagi'),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 32,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.black54,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'Arahkan kamera ke QR di lokasi kerja. GPS tetap dicatat saat masuk.',
              style: TextStyle(color: Colors.white, fontSize: 13),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ],
    );
  }

  String _errorMessage(MobileScannerException error) {
    final code = error.errorCode;
    if (code == MobileScannerErrorCode.permissionDenied) {
      return 'Izin kamera ditolak. Aktifkan di pengaturan lalu ketuk Coba lagi.';
    }
    final details = error.errorDetails?.message;
    if (details != null && details.isNotEmpty) return details;
    return code.message;
  }
}
