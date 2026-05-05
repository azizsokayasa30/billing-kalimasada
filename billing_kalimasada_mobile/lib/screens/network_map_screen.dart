import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../services/api_client.dart';
import 'odp_detail_screen.dart';
import '../widgets/odp_map_marker.dart';
import 'tag_location_screen.dart';

class NetworkMapScreen extends StatefulWidget {
  const NetworkMapScreen({super.key});

  @override
  State<NetworkMapScreen> createState() => _NetworkMapScreenState();
}

class _NetworkMapScreenState extends State<NetworkMapScreen> {
  final MapController _mapController = MapController();
  final LatLng _defaultCenter = const LatLng(-7.404620, 109.724536);
  double _currentZoom = 15.0;

  List<dynamic> _odps = [];
  List<dynamic> _customers = [];
  List<dynamic> _cableRoutes = [];
  List<dynamic> _backbone = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchNetworkMap();
  }

  Future<void> _fetchNetworkMap() async {
    setState(() => _isLoading = true);
    try {
      final response = await ApiClient.get('/api/mobile-adapter/network-map');
      final data = jsonDecode(response.body);
      if (data['success'] == true) {
        setState(() {
          final payload = Map<String, dynamic>.from(data['data'] ?? {});
          _odps = List<dynamic>.from(payload['odps'] ?? const []);
          _customers = List<dynamic>.from(payload['customers'] ?? const []);
          _cableRoutes = List<dynamic>.from(payload['cableRoutes'] ?? const []);
          _backbone = List<dynamic>.from(payload['backbone'] ?? const []);
        });
      }
    } catch (e) {
      print('Error fetching network map: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _zoomIn() {
    _currentZoom++;
    _mapController.move(_mapController.camera.center, _currentZoom);
  }

  void _zoomOut() {
    _currentZoom--;
    _mapController.move(_mapController.camera.center, _currentZoom);
  }

  void _moveToCurrentLocation() {
    _currentZoom = 15.0;
    _mapController.move(_defaultCenter, _currentZoom);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F1FF), // surface-container-low
      appBar: AppBar(
        backgroundColor: const Color(0xFF070038), // primary
        title: const Text(
          'Pemetaan Jaringan',
          style: TextStyle(
            color: Colors.white,
            fontSize: 28,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: false,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _fetchNetworkMap,
          ),
        ],
      ),
      body: Stack(
        children: [
          // Map Background Layer
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _defaultCenter,
              initialZoom: _currentZoom,
              onPositionChanged: (position, hasGesture) {
                if (hasGesture) {
                  _currentZoom = position.zoom;
                }
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                userAgentPackageName: 'com.example.billing_kalimasada_mobile',
              ),
              PolylineLayer(
                polylines: _backbone.whereType<Map>().map((row) {
                  final fromLat = (row['from_lat'] as num?)?.toDouble();
                  final fromLng = (row['from_lng'] as num?)?.toDouble();
                  final toLat = (row['to_lat'] as num?)?.toDouble();
                  final toLng = (row['to_lng'] as num?)?.toDouble();
                  if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
                    return null;
                  }
                  return Polyline(
                    points: [LatLng(fromLat, fromLng), LatLng(toLat, toLng)],
                    color: const Color(0xFFFFD400),
                    strokeWidth: 4,
                  );
                }).whereType<Polyline>().toList(),
              ),
              PolylineLayer(
                polylines: _cableRoutes.whereType<Map>().map((row) {
                  final fromLat = (row['customer_lat'] as num?)?.toDouble();
                  final fromLng = (row['customer_lng'] as num?)?.toDouble();
                  final toLat = (row['odp_lat'] as num?)?.toDouble();
                  final toLng = (row['odp_lng'] as num?)?.toDouble();
                  if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
                    return null;
                  }
                  final status = (row['status'] ?? 'connected').toString().toLowerCase();
                  return Polyline(
                    points: [LatLng(fromLat, fromLng), LatLng(toLat, toLng)],
                    color: status == 'connected' ? const Color(0xFF28A745) : const Color(0xFFDC3545),
                    strokeWidth: 3,
                  );
                }).whereType<Polyline>().toList(),
              ),
              MarkerLayer(
                markers: _customers.whereType<Map>().map((c) {
                  final lat = (c['latitude'] as num?)?.toDouble();
                  final lng = (c['longitude'] as num?)?.toDouble();
                  if (lat == null || lng == null) return null;
                  final status = (c['status'] ?? 'active').toString().toLowerCase();
                  final color = status == 'active' ? const Color(0xFF2196F3) : const Color(0xFF9E9E9E);
                  return Marker(
                    point: LatLng(lat, lng),
                    width: 22,
                    height: 22,
                    child: Container(
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 1.5),
                      ),
                      child: const Icon(Icons.home, size: 12, color: Colors.white),
                    ),
                  );
                }).whereType<Marker>().toList(),
              ),
              MarkerLayer(
                markers: _odps.map((odp) {
                  final status = (odp['status'] ?? 'active').toString();
                  final lat = (odp['latitude'] as num?)?.toDouble();
                  final lng = (odp['longitude'] as num?)?.toDouble();
                  if (lat == null || lng == null) {
                    return null;
                  }

                  return Marker(
                    point: LatLng(lat, lng),
                    width: 28,
                    height: 33,
                    alignment: Alignment.topCenter,
                    child: GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => OdpDetailScreen(odpId: odp['code'] ?? odp['name'] ?? odp['id'].toString()),
                          ),
                        ).then((_) => _fetchNetworkMap()); // Refresh after returning
                      },
                      child: OdpMapMarker(status: status),
                    ),
                  );
                }).whereType<Marker>().toList(),
              ),
            ],
          ),
          
          // Overlays Layer
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Top: Search Bar
                  Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFCF8FF), // surface
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFC8C4D3)),
                      boxShadow: const [
                        BoxShadow(
                          color: Colors.black12,
                          blurRadius: 4,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16),
                          child: Icon(Icons.search, color: Color(0xFF474551)), // on-surface-variant
                        ),
                        Expanded(
                          child: Autocomplete<Map<String, dynamic>>(
                            optionsBuilder: (TextEditingValue textEditingValue) {
                              if (textEditingValue.text.isEmpty) {
                                return const Iterable<Map<String, dynamic>>.empty();
                              }
                              final allItems = <Map<String, dynamic>>[
                                ..._odps.whereType<Map>().map((e) => Map<String, dynamic>.from(e)..['__type'] = 'ODP'),
                                ..._customers.whereType<Map>().map((e) => Map<String, dynamic>.from(e)..['__type'] = 'CUSTOMER'),
                              ];
                              return allItems.where((item) {
                                final name = (item['name'] ?? '').toString().toLowerCase();
                                final code = (item['code'] ?? item['phone'] ?? '').toString().toLowerCase();
                                final query = textEditingValue.text.toLowerCase();
                                return name.contains(query) || code.contains(query);
                              });
                            },
                            displayStringForOption: (Map<String, dynamic> option) => option['name'] ?? option['code'] ?? '',
                            onSelected: (Map<String, dynamic> selection) {
                              if (selection['latitude'] != null && selection['longitude'] != null) {
                                setState(() {
                                  _currentZoom = 18.0;
                                  _mapController.move(LatLng(selection['latitude'], selection['longitude']), _currentZoom);
                                });
                              }
                            },
                            fieldViewBuilder: (context, textEditingController, focusNode, onFieldSubmitted) {
                              return TextField(
                                controller: textEditingController,
                                focusNode: focusNode,
                                decoration: const InputDecoration(
                                  hintText: 'Cari ODP atau perangkat',
                                  hintStyle: TextStyle(color: Color(0xFF787582)), // outline
                                  border: InputBorder.none,
                                ),
                                style: const TextStyle(color: Color(0xFF19163F)),
                                onSubmitted: (String value) {
                                  onFieldSubmitted();
                                },
                              );
                            },
                            optionsViewBuilder: (context, onSelected, Iterable<Map<String, dynamic>> options) {
                              return Align(
                                alignment: Alignment.topLeft,
                                child: Padding(
                                  padding: const EdgeInsets.only(top: 8.0),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: BackdropFilter(
                                      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                                      child: Material(
                                        elevation: 4,
                                        color: Colors.white.withOpacity(0.5),
                                        child: ConstrainedBox(
                                          constraints: BoxConstraints(
                                            maxHeight: 250, 
                                            maxWidth: MediaQuery.of(context).size.width - 40 - 48,
                                          ),
                                          child: ListView.builder(
                                            padding: EdgeInsets.zero,
                                            shrinkWrap: true,
                                            itemCount: options.length,
                                            itemBuilder: (context, index) {
                                              final option = options.elementAt(index);
                                              return ListTile(
                                                leading: const Icon(Icons.router, color: Color(0xFF070038)),
                                                title: Text(
                                                  option['name'] ?? option['code'] ?? '', 
                                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.black87),
                                                ),
                                                subtitle: Text(
                                                  option['__type'] == 'CUSTOMER'
                                                      ? 'Pelanggan • ${(option['phone'] ?? '').toString()}'
                                                      : 'ODP • ${(option['code'] ?? '').toString()}',
                                                  style: const TextStyle(fontSize: 12, color: Colors.black54),
                                                ),
                                                onTap: () {
                                                  onSelected(option);
                                                },
                                              );
                                            },
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  // Bottom: Controls, Info Panel, FAB
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      // Map Controls (Zoom & Location)
                      Container(
                        width: 40,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFCF8FF),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFC8C4D3)),
                          boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))],
                        ),
                        child: Column(
                          children: [
                            IconButton(
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minHeight: 40, minWidth: 40),
                              icon: const Icon(Icons.add, size: 20),
                              onPressed: _zoomIn,
                              color: const Color(0xFF19163F),
                            ),
                            Container(height: 1, width: 40, color: const Color(0xFFC8C4D3)),
                            IconButton(
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minHeight: 40, minWidth: 40),
                              icon: const Icon(Icons.remove, size: 20),
                              onPressed: _zoomOut,
                              color: const Color(0xFF19163F),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        width: 40,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFCF8FF),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFC8C4D3)),
                          boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))],
                        ),
                        child: IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minHeight: 40, minWidth: 40),
                          icon: const Icon(Icons.my_location, size: 20),
                          onPressed: _moveToCurrentLocation,
                          color: const Color(0xFF19163F),
                        ),
                      ),
                      
                      const SizedBox(height: 16),
                      
                      // FAB: Tambah Tagging ODP
                      Align(
                        alignment: Alignment.center,
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (context) => const TagLocationScreen()),
                            ).then((success) {
                              if (success == true) {
                                _fetchNetworkMap();
                              }
                            });
                          },
                          icon: const Icon(Icons.add, color: Colors.white),
                          label: const Text('Tambah Tagging ODP', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF1B0C6B), // primary-container
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                            elevation: 4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          
          if (_isLoading)
            const Center(child: CircularProgressIndicator()),
        ],
      ),
    );
  }
}
