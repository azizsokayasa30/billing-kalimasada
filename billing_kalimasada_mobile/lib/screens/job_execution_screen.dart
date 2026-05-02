import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../store/task_provider.dart';
import 'execution_notes_screen.dart';

class JobExecutionScreen extends StatelessWidget {
  final Map<String, dynamic> task;

  const JobExecutionScreen({super.key, required this.task});

  @override
  Widget build(BuildContext context) {
    const bgBackground = Color(0xFFFCF8FF);
    const textOnSurface = Color(0xFF19163F);
    const textOnSurfaceVariant = Color(0xFF474551);
    
    return Scaffold(
      backgroundColor: bgBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF070038)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Eksekusi Tugas #${task['id']}',
          style: const TextStyle(
            color: Color(0xFF1B0C6B),
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert, color: Color(0xFF070038)),
            onPressed: () {},
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFC8C4D3).withValues(alpha: 0.5), height: 1),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Active Status Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFFF0EBFF),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFC8C4D3)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 12,
                        height: 12,
                        decoration: const BoxDecoration(
                          color: Color(0xFF7E4990),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'STATUS: IN PROGRESS',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: textOnSurface,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    '00:45:12',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1B0C6B),
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Job Summary Section
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFC8C4D3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Job Summary',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: textOnSurface,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Divider(color: Color(0xFFC8C4D3)),
                  const SizedBox(height: 12),
                  
                  _buildSummaryItem(Icons.business, 'PELANGGAN', task['customer']?.toString() ?? 'PT. Alpha Networks'),
                  const SizedBox(height: 12),
                  _buildSummaryItem(Icons.build, 'LAYANAN', task['type'] == 'TR' ? 'Troubleshooting' : 'Pemasangan Baru'),
                  const SizedBox(height: 12),
                  _buildSummaryItem(Icons.location_on, 'ALAMAT', task['address']?.toString() ?? '142 Jalan Sudirman, Kav 45, Jakarta Selatan'),
                ],
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Network Health Section
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFC8C4D3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Network Health',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: textOnSurface,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Divider(color: Color(0xFFC8C4D3)),
                  const SizedBox(height: 12),
                  
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF6F1FF), // surface-container-low
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFC8C4D3)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: const [
                                  Icon(Icons.signal_cellular_alt, size: 16, color: Color(0xFF1B0C6B)),
                                  SizedBox(width: 4),
                                  Text(
                                    'SIGNAL STRENGTH',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF1B0C6B),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                '-18.5 dBm',
                                style: TextStyle(
                                  fontSize: 18,
                                  color: textOnSurface,
                                ),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Healthy',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1B0C6B),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF6F1FF),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFC8C4D3)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: const [
                                  Icon(Icons.router, size: 16, color: Color(0xFF1B0C6B)),
                                  SizedBox(width: 4),
                                  Text(
                                    'CONNECTION',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF1B0C6B),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Online',
                                style: TextStyle(
                                  fontSize: 18,
                                  color: textOnSurface,
                                ),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Stable',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1B0C6B),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Mini Line Chart Placeholder
                  Container(
                    height: 100,
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0EBFF),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFC8C4D3)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: List.generate(12, (index) {
                        // Generate somewhat random heights for the bars
                        final heights = [0.75, 0.8, 1.0, 0.85, 1.0, 0.8, 1.0, 1.0, 0.9, 1.0, 1.0, 1.0];
                        return Container(
                          width: 15,
                          height: 90 * heights[index],
                          decoration: const BoxDecoration(
                            color: Color(0xFFC5C0FF), // primary-fixed-dim
                            borderRadius: BorderRadius.vertical(top: Radius.circular(4)),
                          ),
                        );
                      }),
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Primary Actions
            ElevatedButton(
              onPressed: () async {
                final id = task['id']?.toString();
                final type = task['type']?.toString();
                if (id != null && type != null) {
                  final success = await context.read<TaskProvider>().updateTaskStatus(id, type, 'selesai');
                  if (context.mounted) {
                    if (success) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tugas berhasil diselesaikan')));
                      Navigator.popUntil(context, (route) => route.isFirst);
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Gagal menyelesaikan tugas')));
                    }
                  }
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Data tugas tidak valid')));
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1B0C6B),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Selesai (Complete Job)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ),
            
            const SizedBox(height: 12),
            
            OutlinedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => ExecutionNotesScreen(jobId: task['id']?.toString() ?? '')),
                );
              },
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFF1B0C6B), width: 2),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Add Execution Notes', style: TextStyle(color: Color(0xFF1B0C6B), fontSize: 16, fontWeight: FontWeight.bold)),
            ),
            
            const SizedBox(height: 24),
            
            ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.warning, color: Colors.white),
              label: const Text('Report Issue / Escalation', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFBA1A1A),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            
            const SizedBox(height: 48), // Bottom padding
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryItem(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: const Color(0xFF787582)),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF787582),
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 16,
                  color: Color(0xFF19163F),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
