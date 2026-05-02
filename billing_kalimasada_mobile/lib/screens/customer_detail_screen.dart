import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../store/customer_provider.dart';
import '../store/auth_provider.dart';

class CustomerDetailScreen extends StatefulWidget {
  final Map<String, dynamic> customer;

  const CustomerDetailScreen({super.key, required this.customer});

  @override
  State<CustomerDetailScreen> createState() => _CustomerDetailScreenState();
}

class _CustomerDetailScreenState extends State<CustomerDetailScreen> {
  late Map<String, dynamic> customer;

  @override
  void initState() {
    super.initState();
    customer = Map<String, dynamic>.from(widget.customer);
  }

  @override
  Widget build(BuildContext context) {
    final isTechnician = context.watch<AuthProvider>().role == 'technician';
    final status = customer['status']?.toString().toLowerCase() ?? 'active';

    // Default to active colors
    Color statusColor = const Color(0xFF0D5930); // Dark Green text
    Color statusBgColor = const Color(0xFFD3F5E4); // Light green bg
    Color statusBorderColor = const Color(0xFFB2E9CD);
    String statusLabel = 'Active / Stable';
    IconData statusIcon = Icons.check_circle;

    if (status == 'suspended') {
      statusColor = const Color(0xFF7E4990); // secondary
      statusBgColor = const Color(
        0xFFEBAEFD,
      ).withValues(alpha: 0.3); // secondary-container
      statusBorderColor = const Color(0xFFEBAEFD);
      statusLabel = 'Suspended / Isolir';
      statusIcon = Icons.block;
    } else if (status == 'isolated') {
      statusColor = const Color(0xFF93000A); // on-error-container
      statusBgColor = const Color(0xFFFFDAD6); // error-container
      statusBorderColor = const Color(0xFFFFB4AB);
      statusLabel = 'Isolated / Gangguan';
      statusIcon = Icons.error;
    }

    // Colors from Stitch design
    const bgBackground = Color(0xFFFCF8FF);
    const bgSurfaceContainerLowest = Color(0xFFFFFFFF);
    const bgSurfaceContainer = Color(0xFFF0EBFF);
    const bgSurfaceContainerHigh = Color(0xFFEAE5FF);

    const primaryColor = Color(0xFF070038);
    const errorColor = Color(0xFFBA1A1A);
    const errorContainerColor = Color(0xFFFFDAD6);
    const textOnErrorContainer = Color(0xFF93000A);

    const textOnBackground = Color(0xFF19163F);
    const textOnSurfaceVariant = Color(0xFF474551);
    const textOnPrimary = Color(0xFFFFFFFF);
    const outlineVariant = Color(0xFFC8C4D3);
    const outline = Color(0xFF787582);
    const surfaceTint = Color(0xFF5A53AB);

    return Scaffold(
      backgroundColor: bgBackground,
      appBar: AppBar(
        backgroundColor: bgSurfaceContainerLowest,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: primaryColor),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Customer Detail',
          style: TextStyle(
            color: primaryColor,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert, color: primaryColor),
            onPressed: () {},
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            color: outlineVariant.withValues(alpha: 0.5),
            height: 1,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Profile Header Area
            Container(
              decoration: BoxDecoration(
                color: bgSurfaceContainer,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: outlineVariant),
              ),
              child: Stack(
                children: [
                  Container(
                    height: 80,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          surfaceTint.withValues(alpha: 0.1),
                          Colors.transparent,
                        ],
                      ),
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(12),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        Container(
                          width: 96,
                          height: 96,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: bgSurfaceContainerLowest,
                              width: 4,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.05),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                            image: const DecorationImage(
                              image: NetworkImage(
                                'https://via.placeholder.com/150',
                              ), // Placeholder avatar
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          customer['name'] ?? 'Unknown Customer',
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w600,
                            color: textOnBackground,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'ID: ${customer['customer_id'] ?? '-'}',
                          style: const TextStyle(
                            fontSize: 16,
                            color: textOnSurfaceVariant,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          alignment: WrapAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: statusBgColor,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: statusBorderColor),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    statusIcon,
                                    size: 14,
                                    color: statusColor,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    statusLabel,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: statusColor,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: bgSurfaceContainerHigh,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: outlineVariant),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.network_ping,
                                    size: 14,
                                    color: textOnSurfaceVariant,
                                  ),
                                  SizedBox(width: 4),
                                  Text(
                                    'Ping: 14ms', // Placeholder
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: textOnSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Primary Actions
            Row(
              children: [
                if (!isTechnician) ...[
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {},
                      icon: const Icon(
                        Icons.power_settings_new,
                        color: textOnPrimary,
                        size: 20,
                      ),
                      label: const Text(
                        'Activate',
                        style: TextStyle(
                          color: textOnPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryColor,
                        foregroundColor: textOnPrimary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        elevation: 1,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final success = await context
                          .read<CustomerProvider>()
                          .restartConnection(customer['id'].toString());
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              success
                                  ? 'Koneksi berhasil di-restart'
                                  : 'Gagal me-restart koneksi',
                            ),
                            backgroundColor: success
                                ? Colors.green
                                : errorColor,
                          ),
                        );
                      }
                    },
                    icon: const Icon(
                      Icons.restart_alt,
                      color: textOnBackground,
                      size: 20,
                    ),
                    label: const Text(
                      'Reboot',
                      style: TextStyle(
                        color: textOnBackground,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      backgroundColor: bgSurfaceContainerLowest,
                      side: const BorderSide(color: primaryColor, width: 2),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
                if (!isTechnician) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {},
                      icon: const Icon(
                        Icons.block,
                        color: textOnErrorContainer,
                        size: 20,
                      ),
                      label: const Text(
                        'Isolate',
                        style: TextStyle(
                          color: textOnErrorContainer,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: errorContainerColor,
                        foregroundColor: textOnErrorContainer,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        elevation: 1,
                        side: const BorderSide(color: Color(0xFFFFB4AB)),
                      ),
                    ),
                  ),
                ],
              ],
            ),

            const SizedBox(height: 24),

            // Contact Info
            Container(
              decoration: BoxDecoration(
                color: bgSurfaceContainerLowest,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: outlineVariant),
              ),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.contact_mail, color: surfaceTint),
                          SizedBox(width: 8),
                          Text(
                            'Contact Info',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                              color: textOnBackground,
                            ),
                          ),
                        ],
                      ),
                      if (!isTechnician)
                        IconButton(
                          icon: const Icon(
                            Icons.edit,
                            color: textOnSurfaceVariant,
                          ),
                          onPressed: () {},
                          style: IconButton.styleFrom(
                            backgroundColor: bgSurfaceContainer,
                          ),
                        ),
                    ],
                  ),
                  const Divider(height: 24, color: outlineVariant),
                  _buildInfoRow(
                    Icons.call,
                    'PRIMARY PHONE',
                    customer['phone'] ?? '-',
                    textOnBackground,
                    textOnSurfaceVariant,
                    outline,
                  ),
                  const SizedBox(height: 16),
                  _buildInfoRow(
                    Icons.mail,
                    'EMAIL ADDRESS',
                    '${customer['customer_id']?.toString().toLowerCase() ?? 'user'}@example.com',
                    textOnBackground,
                    textOnSurfaceVariant,
                    outline,
                  ),
                  const SizedBox(height: 16),
                  _buildInfoRow(
                    Icons.location_on,
                    'SERVICE ADDRESS',
                    customer['address'] ?? '-',
                    textOnBackground,
                    textOnSurfaceVariant,
                    outline,
                  ),

                  const SizedBox(height: 16),
                  if (customer['latitude'] != null && customer['longitude'] != null)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text('LOKASI PELANGGAN', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: textOnSurfaceVariant, letterSpacing: 1.1)),
                        const SizedBox(height: 8),
                        Container(
                          height: 150,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: outlineVariant),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: FlutterMap(
                            options: MapOptions(
                              initialCenter: LatLng(customer['latitude'] as double, customer['longitude'] as double),
                              initialZoom: 16.0,
                              interactionOptions: const InteractionOptions(flags: InteractiveFlag.none),
                            ),
                            children: [
                              TileLayer(
                                urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                                userAgentPackageName: 'com.example.billing_kalimasada_mobile',
                              ),
                              MarkerLayer(
                                markers: [
                                  Marker(
                                    point: LatLng(customer['latitude'] as double, customer['longitude'] as double),
                                    width: 36,
                                    height: 36,
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(10),
                                        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 2))],
                                      ),
                                      child: const Center(
                                        child: Icon(Icons.wifi, color: Colors.green, size: 22),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                    ),
                  OutlinedButton.icon(
                    onPressed: () async {
                      final updatedLocation = await showDialog<LatLng>(
                        context: context,
                        builder: (context) => _TagLocationDialog(customer: customer),
                      );
                      if (updatedLocation != null) {
                        setState(() {
                          customer['latitude'] = updatedLocation.latitude;
                          customer['longitude'] = updatedLocation.longitude;
                        });
                      }
                    },
                    icon: Icon(
                      customer['latitude'] != null ? Icons.edit_location : Icons.my_location,
                      color: surfaceTint,
                      size: 20,
                    ),
                    label: Text(
                      customer['latitude'] != null ? 'Update Lokasi Pelanggan' : 'Tambahkan Lokasi Pelanggan',
                      style: const TextStyle(
                        color: textOnBackground,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      side: const BorderSide(color: outlineVariant),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      minimumSize: const Size.fromHeight(48),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Network & Hardware
            Container(
              decoration: BoxDecoration(
                color: bgSurfaceContainerLowest,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: outlineVariant),
              ),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.router, color: surfaceTint),
                          SizedBox(width: 8),
                          Text(
                            'Network & Hardware',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                              color: textOnBackground,
                            ),
                          ),
                        ],
                      ),
                      if (!isTechnician)
                        IconButton(
                          icon: const Icon(
                            Icons.edit,
                            color: textOnSurfaceVariant,
                          ),
                          onPressed: () {},
                          style: IconButton.styleFrom(
                            backgroundColor: bgSurfaceContainer,
                          ),
                        ),
                    ],
                  ),
                  const Divider(height: 24, color: outlineVariant),

                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: bgSurfaceContainer,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: outlineVariant),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.speed, color: surfaceTint),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'SERVICE PLAN',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: textOnSurfaceVariant,
                                letterSpacing: 1.1,
                              ),
                            ),
                            Text(
                              customer['profile'] ?? 'Standard Package',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: textOnBackground,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'ASSIGNED IP',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: textOnSurfaceVariant,
                                letterSpacing: 1.1,
                              ),
                            ),
                            Text(
                              customer['ip_address'] ?? 'DHCP/Dynamic',
                              style: const TextStyle(
                                fontSize: 16,
                                color: textOnBackground,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'MAC ADDRESS',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: textOnSurfaceVariant,
                                letterSpacing: 1.1,
                              ),
                            ),
                            Text(
                              '00:1A:2B:3C:4D:5E', // Placeholder
                              style: TextStyle(
                                fontSize: 16,
                                color: textOnBackground,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  Row(
                    children: [
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'ONT SERIAL',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: textOnSurfaceVariant,
                                letterSpacing: 1.1,
                              ),
                            ),
                            Text(
                              'ONT-992-KXL-1', // Placeholder
                              style: TextStyle(
                                fontSize: 16,
                                color: textOnBackground,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'PORT STATUS',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: textOnSurfaceVariant,
                                letterSpacing: 1.1,
                              ),
                            ),
                            Text(
                              status == 'active'
                                  ? 'UP (1000FDX)'
                                  : 'DOWN', // Placeholder
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: status == 'active'
                                    ? const Color(0xFF0D5930)
                                    : errorColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 48), // Padding
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(
    IconData icon,
    String label,
    String value,
    Color textColor,
    Color labelColor,
    Color iconColor,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(icon, color: iconColor, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: labelColor,
                  letterSpacing: 1.1,
                ),
              ),
              const SizedBox(height: 2),
              Text(value, style: TextStyle(fontSize: 16, color: textColor)),
            ],
          ),
        ),
      ],
    );
  }
}

class _TagLocationDialog extends StatefulWidget {
  final Map<String, dynamic> customer;
  const _TagLocationDialog({required this.customer});

  @override
  State<_TagLocationDialog> createState() => _TagLocationDialogState();
}

class _TagLocationDialogState extends State<_TagLocationDialog> {
  LatLng? _selectedLocation;
  final MapController _mapController = MapController();
  late LatLng _defaultLocation;

  @override
  void initState() {
    super.initState();
    if (widget.customer['latitude'] != null && widget.customer['longitude'] != null) {
      _defaultLocation = LatLng(widget.customer['latitude'] as double, widget.customer['longitude'] as double);
      _selectedLocation = _defaultLocation;
    } else {
      _defaultLocation = const LatLng(-7.404620, 109.724536);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFFFCF8FF),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Tambahkan Lokasi Pelanggan', style: TextStyle(color: Color(0xFF070038), fontSize: 16, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
            const SizedBox(height: 16),
            Container(
              height: 300,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFC8C4D3)),
              ),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                children: [
                  FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: _defaultLocation,
                      initialZoom: 15.0,
                      onTap: (tapPosition, point) {
                        setState(() {
                          _selectedLocation = point;
                        });
                      },
                    ),
                    children: [
                      TileLayer(
                        urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                        userAgentPackageName: 'com.example.billing_kalimasada_mobile',
                      ),
                      if (_selectedLocation != null)
                        MarkerLayer(
                          markers: [
                            Marker(
                              point: _selectedLocation!,
                              width: 36,
                              height: 36,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(10),
                                  boxShadow: const [
                                    BoxShadow(
                                      color: Colors.black26,
                                      blurRadius: 4,
                                      offset: Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: const Center(
                                  child: Icon(Icons.wifi, color: Colors.green, size: 22),
                                ),
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _selectedLocation == null ? null : () async {
                showDialog(
                  context: context,
                  barrierDismissible: false,
                  builder: (context) => const Center(child: CircularProgressIndicator()),
                );
                
                final success = await context.read<CustomerProvider>().updateLocation(
                  widget.customer['id'].toString(),
                  _selectedLocation!.latitude,
                  _selectedLocation!.longitude,
                );
                
                if (context.mounted) Navigator.pop(context); // Close loading dialog
                
                if (success && context.mounted) {
                  Navigator.pop(context, _selectedLocation); // Close tag dialog and return new location
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Lokasi Pelanggan Berhasil Disimpan'), backgroundColor: Colors.green));
                } else if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Gagal menyimpan lokasi'), backgroundColor: Colors.red));
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF070038),
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(48),
              ),
              child: const Text('Simpan Lokasi Pelanggan', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Batal', style: TextStyle(color: Color(0xFF070038))),
            )
          ],
        ),
      ),
    );
  }
}

