import 'package:flutter/material.dart';

/// Marker ODP mengikuti style web: pin kuning dengan icon ODP.
class OdpMapMarker extends StatefulWidget {
  const OdpMapMarker({
    super.key,
    this.status = 'active',
    this.size = 28,
    this.enablePulse = true,
  });

  final String status;
  final double size;
  final bool enablePulse;

  @override
  State<OdpMapMarker> createState() => _OdpMapMarkerState();
}

class _OdpMapMarkerState extends State<OdpMapMarker>
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
  void didUpdateWidget(covariant OdpMapMarker oldWidget) {
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
    final s = widget.status.toLowerCase();
    final inactive = s == 'inactive';
    final maintenance = s == 'maintenance';

    final Color fill = inactive
        ? const Color(0xFFC4C4C4)
        : maintenance
            ? const Color(0xFFFFCA28)
            : const Color(0xFFFFC107);
    final Color stroke = inactive
        ? const Color(0xFF9E9E9E)
        : maintenance
            ? const Color(0xFFFF9800)
            : const Color(0xFFF9A825);
    final d = widget.size;
    final icon = maintenance
        ? Icons.settings_input_component_rounded
        : Icons.settings_input_antenna_rounded;

    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        final scale = widget.enablePulse ? (1.0 + (_pulseController.value * 0.08)) : 1.0;
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
              child: Icon(
                icon,
                size: d * 0.48,
                color: Colors.white,
              ),
            ),
            Positioned(
              top: d - 2,
              child: Container(
                width: 0,
                height: 0,
                decoration: BoxDecoration(
                  border: Border(
                    left: BorderSide(color: Colors.transparent, width: d * 0.18),
                    right: BorderSide(color: Colors.transparent, width: d * 0.18),
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
