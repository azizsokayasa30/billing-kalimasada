import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:provider/provider.dart';
import '../store/task_provider.dart';
import 'job_execution_screen.dart';

class TaskDetailScreen extends StatelessWidget {
  final Map<String, dynamic> task;

  const TaskDetailScreen({super.key, required this.task});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFCF8FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF070038), // primary
        elevation: 0,
        shape: const Border(
          bottom: BorderSide(color: Color(0xFFC8C4D3), width: 1), // outline-variant
        ),
        title: const Text(
          'Eksekusi Tugas',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w600,
            color: Color(0xFF070038),
          ),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert),
            onPressed: () {},
          ),
        ],
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 140), // extra bottom padding for buttons
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Timer & Status Section
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1B0C6B), // primary-container
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'DURASI',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                              color: Color(0xCC857ED9), // on-primary-container with opacity
                            ),
                          ),
                          Text(
                            '00:45:12',
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 2,
                              color: Colors.white, // on-primary
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF5A53AB).withValues(alpha: 0.2), // surface-tint/20
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(Icons.sync, size: 14, color: Color(0xFFE4DFFF)), // surface-variant
                            SizedBox(width: 8),
                            Text(
                              'Dalam Proses',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFFE4DFFF),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                
                // Customer Details Section
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFC8C4D3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.person, size: 20, color: Color(0xFF787582)),
                          SizedBox(width: 8),
                          Text(
                            'Detail Pelanggan',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF19163F), // on-surface
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      const Divider(color: Color(0xFFC8C4D3)),
                      const SizedBox(height: 8),
                      
                      _buildDetailRow('Nama', task['customer']?.toString() ?? 'Budi Santoso'),
                      const SizedBox(height: 8),
                      _buildDetailRow('ID Pelanggan', task['id']?.toString() ?? 'CST-882910'),
                      const SizedBox(height: 8),
                      _buildDetailRow('Alamat', task['address']?.toString() ?? 'Jl. Merdeka No. 45, Kebayoran Baru, Jakarta Selatan'),
                      const SizedBox(height: 16),
                      
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () async {
                                final phone = task['phone']?.toString();
                                if (phone != null && phone.isNotEmpty) {
                                  final uri = Uri.parse('tel:$phone');
                                  if (await canLaunchUrl(uri)) {
                                    await launchUrl(uri);
                                  } else {
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tidak dapat membuka aplikasi telepon')));
                                    }
                                  }
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Nomor telepon tidak tersedia')));
                                }
                              },
                              icon: const Icon(Icons.call, size: 18),
                              label: const Text('Hubungi'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFF19163F),
                                backgroundColor: const Color(0xFFEAE5FF), // surface-container-high
                                side: const BorderSide(color: Color(0xFFC8C4D3)),
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () async {
                                final address = task['address']?.toString();
                                if (address != null && address.isNotEmpty) {
                                  final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address)}');
                                  if (await canLaunchUrl(uri)) {
                                    await launchUrl(uri, mode: LaunchMode.externalApplication);
                                  } else {
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tidak dapat membuka peta')));
                                    }
                                  }
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Alamat tidak tersedia')));
                                }
                              },
                              icon: const Icon(Icons.map, size: 18),
                              label: const Text('Peta'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFF19163F),
                                backgroundColor: const Color(0xFFEAE5FF), // surface-container-high
                                side: const BorderSide(color: Color(0xFFC8C4D3)),
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                
                // Technical Status Section
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFC8C4D3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.build, size: 20, color: Color(0xFF787582)),
                          SizedBox(width: 8),
                          Text(
                            'Status Teknis',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF19163F),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      const Divider(color: Color(0xFFC8C4D3)),
                      const SizedBox(height: 8),
                      
                      Row(
                        children: [
                          Expanded(
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0EBFF), // surface-container
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Tipe Gangguan',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 0.5,
                                      color: Color(0xFF474551),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    task['title']?.toString() ?? 'Koneksi Putus',
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w500,
                                      color: Color(0xFF19163F),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0EBFF), // surface-container
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Prioritas',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 0.5,
                                      color: Color(0xFF474551),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      const Icon(Icons.priority_high, size: 16, color: Color(0xFFBA1A1A)),
                                      const SizedBox(width: 4),
                                      Text(
                                        task['priority']?.toString() ?? 'Tinggi',
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w500,
                                          color: Color(0xFFBA1A1A), // error
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      
                      const Text(
                        'Catatan Diagnosa',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: Color(0xFF474551),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0EBFF), // surface-container
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          task['description']?.toString() ?? 'Kabel optik di tiang utama terindikasi putus akibat cuaca buruk. Membutuhkan penggantian segmen sepanjang 15 meter.',
                          style: const TextStyle(
                            fontSize: 14,
                            color: Color(0xFF19163F),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          // Action Buttons (Bottom Stack)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: Color(0xFFC8C4D3))),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: () async {
                        final id = task['id']?.toString();
                        final type = task['type']?.toString();
                        if (id != null && type != null) {
                          // Update status to 'mulai' in background, don't wait for it
                          context.read<TaskProvider>().updateTaskStatus(id, type, 'mulai');
                          
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => JobExecutionScreen(task: task),
                            ),
                          );
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('ID Tugas tidak valid')));
                        }
                      },
                      icon: const Icon(Icons.play_arrow, size: 20),
                      label: const Text('Kerjakan'),
                      style: ElevatedButton.styleFrom(
                        foregroundColor: Colors.white,
                        backgroundColor: const Color(0xFF14532D), // success
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: () async {
                        final id = task['id']?.toString();
                        final type = task['type']?.toString();
                        if (id != null && type != null) {
                          final success = await context.read<TaskProvider>().updateTaskStatus(id, type, 'pending');
                          if (context.mounted) {
                            if (success) {
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tugas berhasil ditandai sebagai pending')));
                              Navigator.pop(context);
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Gagal memperbarui status tugas')));
                            }
                          }
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Data tugas tidak valid')));
                        }
                      },
                      icon: const Icon(Icons.pause, size: 18),
                      label: const Text('Pending'),
                      style: ElevatedButton.styleFrom(
                        foregroundColor: Colors.white,
                        backgroundColor: const Color(0xFF9A3412), // warning
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
            color: Color(0xFF474551), // on-surface-variant
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: Color(0xFF19163F), // on-surface
          ),
        ),
      ],
    );
  }
}
