import 'package:flutter/material.dart';

/// Marker lokasi pelanggan di peta: pin biru dengan ikon rumah — selaras tampilan web billing.
class CustomerHomeMapMarker extends StatefulWidget {
  const CustomerHomeMapMarker({
    super.key,
    this.size = 28,
    this.enablePulse = true,
  });

  final double size;
  final bool enablePulse;

  @override
  State<CustomerHomeMapMarker> createState() => _CustomerHomeMapMarkerState();
}

class _CustomerHomeMapMarkerState extends State<CustomerHomeMapMarker>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );
    if (widget.enablePulse) {
      _pulseController.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(covariant CustomerHomeMapMarker oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.enablePulse != oldWidget.enablePulse) {
      if (widget.enablePulse) {
        _pulseController.repeat(reverse: true);
      } else {
        _pulseController.stop();
        _pulseController.value = 0.0;
      }
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const fill = Color(0xFF1A73E8);
    const stroke = Color(0xFF1557B0);
    final d = widget.size;

    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        final scale = widget.enablePulse
            ? (1.0 + (_pulseController.value * 0.08))
            : 1.0;
        return Transform.scale(scale: scale, child: child);
      },
      child: SizedBox(
        width: d + 2,
        height: d * 1.28,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.topCenter,
          children: [
            Container(
              width: d,
              height: d,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [fill.withValues(alpha: 0.92), fill],
                ),
                border: Border.all(color: Colors.white, width: 2),
                boxShadow: const [
                  BoxShadow(
                    color: Colors.black26,
                    blurRadius: 6,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              child: Icon(Icons.home_rounded, size: d * 0.52, color: Colors.white),
            ),
            Positioned(
              top: d - 2,
              child: Container(
                width: 0,
                height: 0,
                decoration: BoxDecoration(
                  border: Border(
                    left: BorderSide(
                      color: Colors.transparent,
                      width: d * 0.18,
                    ),
                    right: BorderSide(
                      color: Colors.transparent,
                      width: d * 0.18,
                    ),
                    top: BorderSide(color: fill, width: d * 0.28),
                  ),
                ),
              ),
            ),
            Positioned(
              top: d + (d * 0.10),
              child: Container(
                width: d * 0.16,
                height: d * 0.16,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: stroke,
                  border: Border.all(color: Colors.white70, width: 1),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
