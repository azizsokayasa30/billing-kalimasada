import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/api_client.dart';

class NetworkStatusScreen extends StatefulWidget {
  const NetworkStatusScreen({super.key});

  @override
  State<NetworkStatusScreen> createState() => _NetworkStatusScreenState();
}

class _NetworkStatusScreenState extends State<NetworkStatusScreen> {
  Timer? _timer;
  String _rxMbps = "0.0";
  String _txMbps = "0.0";
  String _totalMbps = "0.0";

  @override
  void initState() {
    super.initState();
    _fetchTraffic();
    _timer = Timer.periodic(const Duration(seconds: 3), (_) => _fetchTraffic());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _fetchTraffic() async {
    try {
      final response = await ApiClient.get('/api/dashboard/traffic');
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true) {
          final rxBits = int.tryParse(data['rx'].toString()) ?? 0;
          final txBits = int.tryParse(data['tx'].toString()) ?? 0;
          if (mounted) {
            setState(() {
              final rxM = (rxBits / 1000000);
              final txM = (txBits / 1000000);
              _rxMbps = rxM.toStringAsFixed(2);
              _txMbps = txM.toStringAsFixed(2);
              _totalMbps = (rxM + txM).toStringAsFixed(2);
            });
          }
        }
      }
    } catch (e) {
      debugPrint('Error fetching traffic: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    const bgBackground = Color(0xFFFCF8FF);
    const textOnSurface = Color(0xFF19163F);
    const textOnSurfaceVariant = Color(0xFF474551);
    const primaryColor = Color(0xFF070038);
    const surfaceTint = Color(0xFF5A53AB);

    return Scaffold(
      backgroundColor: bgBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1B0C6B)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Network Status',
          style: TextStyle(
            color: Color(0xFF1B0C6B),
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
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Bandwidth Usage Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: const [
                Text(
                  'Bandwidth Usage',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: primaryColor),
                ),
                Text(
                  'LIVE TRAFFIC (Mbps)',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: surfaceTint),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Live Signal Graph Placeholder
            Container(
              height: 192,
              decoration: BoxDecoration(
                color: const Color(0xFFF0EBFF),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFC8C4D3)),
              ),
              child: Stack(
                children: [
                  // Graph illustration
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      height: 120,
                      decoration: const BoxDecoration(
                        image: DecorationImage(
                          image: NetworkImage(
                              'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop'), // Placeholder for graph
                          fit: BoxFit.cover,
                          opacity: 0.3,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 16,
                    left: 16,
                    child: Row(
                      children: [
                        Row(
                          children: [
                            Container(width: 12, height: 2, color: primaryColor),
                            const SizedBox(width: 6),
                            Text('DOWNLOAD: $_rxMbps Mbps', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: textOnSurfaceVariant)),
                          ],
                        ),
                        const SizedBox(width: 16),
                        Row(
                          children: [
                            Container(width: 12, height: 2, color: const Color(0xFFEBAEFD)),
                            const SizedBox(width: 6),
                            Text('UPLOAD: $_txMbps Mbps', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: textOnSurfaceVariant)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Positioned(
                    top: 16,
                    right: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: bgBackground,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFC8C4D3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle)),
                          const SizedBox(width: 8),
                          Text('$_totalMbps Mbps', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: textOnSurface)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Key Metrics Cards
            Row(
              children: [
                Expanded(child: _buildMetricCard(icon: Icons.signal_cellular_alt, title: 'Rx Power', value: '-18.5', unit: 'dBm', status: 'Healthy')),
                const SizedBox(width: 16),
                Expanded(child: _buildMetricCard(icon: Icons.device_thermostat, title: 'Temperature', value: '42', unit: '°C', status: 'Normal')),
              ],
            ),
            const SizedBox(height: 16),
            _buildMetricCard(icon: Icons.bolt, title: 'Voltage', value: '3.3', unit: 'V', status: 'Stable', isWide: true),
            const SizedBox(height: 24),

            // Equipment Path (Topology)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: bgBackground,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFC8C4D3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Equipment Path',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: primaryColor),
                  ),
                  const SizedBox(height: 16),
                  _buildPathStep(title: 'OLT Hub', subtitle: 'Central Office Node A', status: 'Online', isLast: false, isConnected: true),
                  _buildPathStep(title: 'ODP-JBG-01', subtitle: 'Distribution Point 01', status: 'Active', isLast: false, isConnected: true),
                  _buildPathStep(title: 'Customer ONT', subtitle: 'Target Device', status: 'Connected', isLast: true, isConnected: true),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Diagnostic Tools
            ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.troubleshoot, color: Colors.white),
              label: const Text('Run Full Diagnostic', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1B0C6B), // primary-container
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF6F1FF),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFC8C4D3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: const BoxDecoration(
                      color: bgBackground,
                      border: Border(bottom: BorderSide(color: Color(0xFFC8C4D3))),
                    ),
                    child: const Text('Recent Logs', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: primaryColor)),
                  ),
                  _buildLogItem('10:42', 'Ping test successful (Avg: 12ms)'),
                  _buildLogItem('10:40', 'Authentication verified on ODP-JBG-01'),
                  _buildLogItem('10:38', 'Optical link established (-18.5 dBm)', isLast: true),
                ],
              ),
            ),
            
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard({required IconData icon, required String title, required String value, required String unit, required String status, bool isWide = false}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF0EBFF),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFC8C4D3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: const Color(0xFF5A53AB)),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF5A53AB))),
            ],
          ),
          const SizedBox(height: 8),
          RichText(
            text: TextSpan(
              text: value,
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF070038)),
              children: [
                TextSpan(text: ' $unit', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.normal, color: Color(0xFF474551))),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: const Color(0xFFC8C4D3).withOpacity(0.3)))),
            child: Row(
              children: [
                const Icon(Icons.check_circle, size: 16, color: Color(0xFF10B981)),
                const SizedBox(width: 4),
                Text(status, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF474551))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPathStep({required String title, required String subtitle, required String status, required bool isLast, required bool isConnected}) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 24,
            child: Stack(
              alignment: Alignment.topCenter,
              children: [
                if (!isLast)
                  Positioned(
                    top: 12,
                    bottom: -24, // overlap next step
                    child: Container(width: 2, color: const Color(0xFFC8C4D3)),
                  ),
                Container(
                  width: 20,
                  height: 20,
                  margin: const EdgeInsets.only(top: 2),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: isConnected ? const Color(0xFF10B981) : const Color(0xFF5A53AB), width: 2),
                  ),
                  child: Center(
                    child: isLast
                        ? const Icon(Icons.check, size: 14, color: Color(0xFF10B981))
                        : Container(width: 10, height: 10, decoration: const BoxDecoration(color: Color(0xFF5A53AB), shape: BoxShape.circle)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF070038))),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0xFFE6F4EA), borderRadius: BorderRadius.circular(4)),
                        child: Text(status, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF137333), letterSpacing: 0.5)),
                      ),
                    ],
                  ),
                  Text(subtitle, style: const TextStyle(fontSize: 14, color: Color(0xFF474551))),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogItem(String time, String message, {bool isLast = false}) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: isLast ? null : Border(bottom: BorderSide(color: const Color(0xFFC8C4D3).withOpacity(0.5))),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 48, child: Text(time, style: const TextStyle(color: Color(0xFF474551), fontSize: 14))),
          Expanded(child: Text(message, style: const TextStyle(color: Color(0xFF19163F), fontSize: 14))),
        ],
      ),
    );
  }
}
