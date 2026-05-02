import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../services/api_client.dart';

class TagLocationScreen extends StatefulWidget {
  const TagLocationScreen({super.key});

  @override
  State<TagLocationScreen> createState() => _TagLocationScreenState();
}

class _TagLocationScreenState extends State<TagLocationScreen> {
  final MapController _mapController = MapController();
  final TextEditingController _odpCodeController = TextEditingController();
  final TextEditingController _capacityController = TextEditingController(text: '8'); // Default 8 port
  final TextEditingController _notesController = TextEditingController();
  
  LatLng? _selectedLocation;
  bool _isLoading = false;

  final LatLng _defaultLocation = const LatLng(-7.404620, 109.724536);

  @override
  void dispose() {
    _odpCodeController.dispose();
    _capacityController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _onMapTap(TapPosition tapPosition, LatLng point) {
    setState(() {
      _selectedLocation = point;
    });
  }

  void _moveToCurrentLocation() {
    // We could use Geolocator here, but for now we just snap to default or existing
    _mapController.move(_selectedLocation ?? _defaultLocation, 16.0);
  }

  Future<void> _saveLocation() async {
    final code = _odpCodeController.text.trim();
    if (code.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kode ODP tidak boleh kosong', style: TextStyle(color: Colors.white)), backgroundColor: Colors.red),
      );
      return;
    }

    if (_selectedLocation == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tandai lokasi di peta terlebih dahulu', style: TextStyle(color: Colors.white)), backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final response = await ApiClient.put(
        '/api/mobile-adapter/odps/$code/location',
        {
          'latitude': _selectedLocation!.latitude,
          'longitude': _selectedLocation!.longitude,
          'capacity': int.tryParse(_capacityController.text.trim()) ?? 8,
          'notes': _notesController.text,
        },
      );

      final responseData = jsonDecode(response.body);

      if (responseData['success'] == true) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lokasi berhasil disimpan', style: TextStyle(color: Colors.white)), backgroundColor: Colors.green),
        );
        Navigator.pop(context, true); // Return true to indicate success
      } else {
        throw Exception(responseData['message'] ?? 'Gagal menyimpan lokasi');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString(), style: const TextStyle(color: Colors.white)), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

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
        title: const Text(
          'Tag Location',
          style: TextStyle(
            color: Color(0xFF070038),
            fontSize: 22,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE4DFFF), height: 1), // surface-variant
        ),
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Map Preview
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
                          onTap: _onMapTap,
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
                                  width: 48,
                                  height: 48,
                                  child: Image.asset('assets/images/odp_icon.png', width: 48, height: 48),
                                ),
                              ],
                            ),
                        ],
                      ),
                      Positioned(
                        bottom: 16,
                        right: 16,
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFFC8C4D3)),
                            boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))],
                          ),
                          child: IconButton(
                            icon: const Icon(Icons.my_location, color: Color(0xFF070038)),
                            onPressed: _moveToCurrentLocation,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 8),
                Center(
                  child: Text(
                    _selectedLocation == null ? '⚠️ KLIK DULU MAPNYA YA GAESS !' : '✅ Pastikan titiknya akurat',
                    style: TextStyle(
                      color: _selectedLocation == null ? const Color(0xFFBA1A1A) : Colors.green.shade700, // error color or green
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                
                // ODP Code Section
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFCF8FF),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFC8C4D3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'KODE ODP',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: textOnSurfaceVariant,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Divider(color: Color(0xFFC8C4D3)),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _odpCodeController,
                        style: const TextStyle(color: textOnSurface),
                        decoration: InputDecoration(
                          hintText: 'Masukkan Kode ODP (Misal: ODP-JBG-01)',
                          hintStyle: const TextStyle(color: textOnSurfaceVariant),
                          filled: true,
                          fillColor: const Color(0xFFF6F1FF),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: Color(0xFFC8C4D3)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: Color(0xFFC8C4D3)),
                          ),
                          focusedBorder: const OutlineInputBorder(
                            borderRadius: BorderRadius.all(Radius.circular(8)),
                            borderSide: BorderSide(color: Color(0xFF070038)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 16),
                
                // Kapasitas Port Section
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFCF8FF),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFC8C4D3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'KAPASITAS PORT',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: textOnSurfaceVariant,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Divider(color: Color(0xFFC8C4D3)),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _capacityController,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(color: textOnSurface),
                        decoration: InputDecoration(
                          hintText: 'Masukkan Kapasitas Port (Misal: 8)',
                          hintStyle: const TextStyle(color: textOnSurfaceVariant),
                          filled: true,
                          fillColor: const Color(0xFFF6F1FF),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: Color(0xFFC8C4D3)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: Color(0xFFC8C4D3)),
                          ),
                          focusedBorder: const OutlineInputBorder(
                            borderRadius: BorderRadius.all(Radius.circular(8)),
                            borderSide: BorderSide(color: Color(0xFF070038)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 24),
                
                // Location Details Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFCF8FF),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFC8C4D3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'LOCATION DETAILS',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: textOnSurfaceVariant,
                              letterSpacing: 0.5,
                            ),
                          ),
                          if (_selectedLocation != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.green.shade100, // green background
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.check_circle, size: 14, color: Colors.green.shade800), // dark green icon
                                  const SizedBox(width: 4),
                                  Text(
                                    'TAGGED',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.green.shade800, // dark green text
                                    ),
                                  ),
                                ],
                              ),
                            )
                          else
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFDAD6),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'UNTAGGED',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF93000A),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Divider(color: Color(0xFFC8C4D3)),
                      const SizedBox(height: 12),
                      
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('LATITUDE', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: textOnSurfaceVariant)),
                                const SizedBox(height: 4),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF6F1FF), // surface-container-low
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(color: const Color(0xFFC8C4D3)),
                                  ),
                                  child: Text(
                                    _selectedLocation != null ? _selectedLocation!.latitude.toStringAsFixed(6) : '-', 
                                    style: const TextStyle(color: textOnSurface)
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('LONGITUDE', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: textOnSurfaceVariant)),
                                const SizedBox(height: 4),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF6F1FF),
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(color: const Color(0xFFC8C4D3)),
                                  ),
                                  child: Text(
                                    _selectedLocation != null ? _selectedLocation!.longitude.toStringAsFixed(6) : '-', 
                                    style: const TextStyle(color: textOnSurface)
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
                
                const SizedBox(height: 24),
                
                // Notes Section
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFCF8FF),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFC8C4D3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'NOTES',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: textOnSurfaceVariant,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Divider(color: Color(0xFFC8C4D3)),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _notesController,
                        maxLines: 3,
                        style: const TextStyle(color: textOnSurface),
                        decoration: InputDecoration(
                          hintText: 'Masukkan catatan lokasi (opsional)...',
                          hintStyle: const TextStyle(color: textOnSurfaceVariant),
                          filled: true,
                          fillColor: const Color(0xFFF6F1FF),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: Color(0xFFC8C4D3)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: Color(0xFFC8C4D3)),
                          ),
                          focusedBorder: const OutlineInputBorder(
                            borderRadius: BorderRadius.all(Radius.circular(8)),
                            borderSide: BorderSide(color: Color(0xFF070038)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 32),
                
                // Action Buttons
                ElevatedButton.icon(
                  onPressed: _isLoading ? null : _saveLocation,
                  icon: const Icon(Icons.save, color: Colors.white),
                  label: Text(_isLoading ? 'Menyimpan...' : 'Save Location', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF070038),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: _isLoading ? null : () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF070038)),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Cancel', style: TextStyle(color: Color(0xFF070038), fontSize: 16, fontWeight: FontWeight.bold)),
                ),
                
                const SizedBox(height: 48), // Bottom padding
              ],
            ),
          ),
          if (_isLoading)
            Container(
              color: Colors.black.withValues(alpha: 0.3),
              child: const Center(
                child: CircularProgressIndicator(),
              ),
            ),
        ],
      ),
    );
  }
}
