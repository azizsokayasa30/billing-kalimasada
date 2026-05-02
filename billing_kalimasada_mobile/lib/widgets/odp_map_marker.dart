import 'package:flutter/material.dart';

/// Marker ODP kecil di peta: pin kuning sederhana, ujung (titik lokasi) jelas.
class OdpMapMarker extends StatelessWidget {
  const OdpMapMarker({
    super.key,
    this.status = 'active',
    this.size = 28,
  });

  final String status;
  final double size;

  @override
  Widget build(BuildContext context) {
    final s = status.toLowerCase();
    final inactive = s == 'inactive';
    final maintenance = s == 'maintenance';

    final Color top = inactive
        ? const Color(0xFFE8E8E8)
        : maintenance
            ? const Color(0xFFFFE082)
            : const Color(0xFFFFF59D);
    final Color bottom = inactive
        ? const Color(0xFFC4C4C4)
        : maintenance
            ? const Color(0xFFFFCA28)
            : const Color(0xFFFFC107);
    final Color ring = inactive
        ? const Color(0xFF9E9E9E)
        : maintenance
            ? const Color(0xFFFF9800)
            : const Color(0xFFF9A825);
    final Color tip = inactive
        ? const Color(0xFF424242)
        : const Color(0xFFE65100);

    final d = size;
    return SizedBox(
      width: d,
      height: d * 1.18,
      child: CustomPaint(
        painter: _OdpPinPainter(
          top: top,
          bottom: bottom,
          ring: ring,
          tip: tip,
          maintenanceRing: maintenance && !inactive,
        ),
      ),
    );
  }
}

class _OdpPinPainter extends CustomPainter {
  _OdpPinPainter({
    required this.top,
    required this.bottom,
    required this.ring,
    required this.tip,
    required this.maintenanceRing,
  });

  final Color top;
  final Color bottom;
  final Color ring;
  final Color tip;
  final bool maintenanceRing;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final cx = w / 2;
    final headR = w * 0.36;
    final headCy = headR + w * 0.04;
    final tipY = h - 1.0;

    final shadowPath = Path()
      ..addOval(Rect.fromCircle(center: Offset(cx, headCy + 0.8), radius: headR * 0.75));
    canvas.drawShadow(shadowPath, Colors.black38, 1.8, false);

    final ringPaint = Paint()
      ..color = ring
      ..style = PaintingStyle.stroke
      ..strokeWidth = maintenanceRing ? 1.8 : 1.2;
    canvas.drawCircle(Offset(cx, headCy), headR + 0.8, ringPaint);

    final body = Path()
      ..moveTo(cx, tipY)
      ..quadraticBezierTo(cx - headR * 0.9, headCy + headR * 0.42, cx - headR * 0.88, headCy)
      ..arcToPoint(
        Offset(cx + headR * 0.88, headCy),
        radius: Radius.circular(headR),
        clockwise: false,
      )
      ..quadraticBezierTo(cx + headR * 0.9, headCy + headR * 0.42, cx, tipY)
      ..close();

    final grad = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [top, bottom],
      ).createShader(Rect.fromLTWH(0, 0, w, h));
    canvas.drawPath(body, grad);

    final edge = Paint()
      ..color = Colors.white.withValues(alpha: 0.55)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.9;
    canvas.drawPath(body, edge);

    // Titik lokasi: bulat gelap di ujung — mudah terlihat di citra satelit
    final tipR = (w * 0.11).clamp(2.2, 3.4);
    canvas.drawCircle(
      Offset(cx, tipY - tipR * 0.35),
      tipR,
      Paint()..color = tip,
    );
    canvas.drawCircle(
      Offset(cx, tipY - tipR * 0.35),
      tipR * 0.45,
      Paint()..color = Colors.white.withValues(alpha: 0.75),
    );
  }

  @override
  bool shouldRepaint(covariant _OdpPinPainter oldDelegate) {
    return oldDelegate.top != top ||
        oldDelegate.bottom != bottom ||
        oldDelegate.ring != ring ||
        oldDelegate.tip != tip ||
        oldDelegate.maintenanceRing != maintenanceRing;
  }
}
