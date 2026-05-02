import 'package:flutter/material.dart';
import '../theme/colors.dart';

class CollectorDashboard extends StatelessWidget {
  const CollectorDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Dashboard Kolektor'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.text,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.payment, size: 64, color: AppColors.secondary),
            SizedBox(height: 16),
            Text(
              'Halaman Daftar Pelanggan (Tagihan)',
              style: TextStyle(color: AppColors.text, fontSize: 18),
            ),
          ],
        ),
      ),
    );
  }
}
