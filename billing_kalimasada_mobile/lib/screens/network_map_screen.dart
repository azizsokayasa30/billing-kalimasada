import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
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

class _NetworkMapScreenState extends State<NetworkMapScreen>
    with SingleTickerProviderStateMixin {
  final MapController _mapController = MapController();
  final LatLng _defaultCenter = const LatLng(-7.404620, 109.724536);
  double _currentZoom = 15.0;
  bool _isMapReady = false;
  LatLng? _currentGpsLocation;
  bool _isLocating = false;

  List<dynamic> _odps = [];
  List<dynamic> _customers = [];
  List<dynamic> _cableRoutes = [];
  List<dynamic> _backbone = [];
  bool _isLoading = true;
  late final AnimationController _flowController;

  static const _customerFlowColor = Color(0xFF00E676);
  static const _backboneFlowColor = Color(0xFF40C4FF);

  @override
  void initState() {
    super.initState();
    _flowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat();
    _fetchNetworkMap();
  }

  @override
  void dispose() {
    _flowController.dispose();
    super.dispose();
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
    final nextZoom = (_currentZoom + 1).clamp(2.0, 20.0);
    _animateTo(_mapController.camera.center, nextZoom);
  }

  void _zoomOut() {
    final nextZoom = (_currentZoom - 1).clamp(2.0, 20.0);
    _animateTo(_mapController.camera.center, nextZoom);
  }

  void _moveToCurrentLocation() {
    _locateAndCenterToCurrentPosition();
  }

  Future<void> _locateAndCenterToCurrentPosition() async {
    if (_isLocating) return;
    setState(() => _isLocating = true);
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('GPS belum aktif. Aktifkan lokasi dulu.'),
              backgroundColor: Colors.red,
            ),
          );
        }
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Izin lokasi ditolak. Berikan izin lokasi untuk fitur ini.'),
              backgroundColor: Colors.red,
            ),
          );
        }
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      if (!mounted) return;
      final point = LatLng(pos.latitude, pos.longitude);
      setState(() {
        _currentGpsLocation = point;
      });
      _animateTo(point, 18.0);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Gagal mengambil lokasi GPS saat ini.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLocating = false);
    }
  }

  List<List<LatLng>> _buildCustomerCableSegments() {
    return _cableRoutes
        .whereType<Map>()
        .map((row) {
          final fromLat = (row['odp_lat'] as num?)?.toDouble();
          final fromLng = (row['odp_lng'] as num?)?.toDouble();
          final toLat = (row['customer_lat'] as num?)?.toDouble();
          final toLng = (row['customer_lng'] as num?)?.toDouble();
          if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
            return null;
          }
          return [LatLng(fromLat, fromLng), LatLng(toLat, toLng)];
        })
        .whereType<List<LatLng>>()
        .toList();
  }

  List<List<LatLng>> _buildBackboneSegments() {
    return _backbone
        .whereType<Map>()
        .map((row) {
          final fromLat = (row['from_lat'] as num?)?.toDouble();
          final fromLng = (row['from_lng'] as num?)?.toDouble();
          final toLat = (row['to_lat'] as num?)?.toDouble();
          final toLng = (row['to_lng'] as num?)?.toDouble();
          if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
            return null;
          }
          return [LatLng(fromLat, fromLng), LatLng(toLat, toLng)];
        })
        .whereType<List<LatLng>>()
        .toList();
  }

  LatLng _interpolatePoint(LatLng a, LatLng b, double t) {
    return LatLng(
      a.latitude + ((b.latitude - a.latitude) * t),
      a.longitude + ((b.longitude - a.longitude) * t),
    );
  }

  List<CircleMarker> _buildFlowDots(
    List<List<LatLng>> segments, {
    required Color color,
    required double phaseShift,
  }) {
    final t = (_flowController.value + phaseShift) % 1.0;
    return segments.map((segment) {
      final p = _interpolatePoint(segment.first, segment.last, t);
      return CircleMarker(
        point: p,
        radius: 4.2,
        color: color,
        borderColor: Colors.white,
        borderStrokeWidth: 1.2,
      );
    }).toList();
  }

  Widget _buildGpsPulseMarker() {
    return AnimatedBuilder(
      animation: _flowController,
      builder: (context, _) {
        final pulse = Curves.easeOut.transform(_flowController.value);
        final ringScale = 1.0 + (pulse * 1.2);
        final ringOpacity = (0.30 * (1 - pulse)).clamp(0.0, 1.0);
        return SizedBox(
          width: 42,
          height: 42,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Transform.scale(
                scale: ringScale,
                child: Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFF1A73E8).withValues(alpha: ringOpacity),
                  ),
                ),
              ),
              Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF1A73E8),
                  border: Border.all(color: Colors.white, width: 2),
                  boxShadow: const [
                    BoxShadow(
                      color: Colors.black26,
                      blurRadius: 4,
                      offset: Offset(0, 1),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _animateTo(
    LatLng targetCenter,
    double targetZoom, {
    Duration duration = const Duration(milliseconds: 420),
  }) async {
    if (!_isMapReady) {
      _currentZoom = targetZoom;
      return;
    }

    final startCenter = _mapController.camera.center;
    final startZoom = _mapController.camera.zoom;
    const frameMs = 16;
    final totalMs = duration.inMilliseconds;
    var elapsed = 0;

    while (elapsed < totalMs && mounted) {
      final linearT = (elapsed / totalMs).clamp(0.0, 1.0);
      final t = Curves.easeInOutCubic.transform(linearT);
      final lat = startCenter.latitude + ((targetCenter.latitude - startCenter.latitude) * t);
      final lng = startCenter.longitude + ((targetCenter.longitude - startCenter.longitude) * t);
      final zoom = startZoom + ((targetZoom - startZoom) * t);
      _mapController.move(LatLng(lat, lng), zoom);
      await Future<void>.delayed(const Duration(milliseconds: frameMs));
      elapsed += frameMs;
    }

    if (mounted) {
      _mapController.move(targetCenter, targetZoom);
      _currentZoom = targetZoom;
    }
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
          AnimatedBuilder(
            animation: _flowController,
            builder: (context, _) {
              final backboneSegments = _buildBackboneSegments();
              final cableSegments = _buildCustomerCableSegments();
              return FlutterMap(
                mapController: _mapController,
                options: MapOptions(
                  initialCenter: _defaultCenter,
                  initialZoom: _currentZoom,
                  onMapReady: () {
                    _isMapReady = true;
                  },
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
                    polylines: backboneSegments
                        .map((points) => Polyline(
                              points: points,
                              color: const Color(0xFFFFD400),
                              strokeWidth: 4,
                            ))
                        .toList(),
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
                  CircleLayer(
                    circles: _buildFlowDots(
                      cableSegments,
                      color: _customerFlowColor,
                      phaseShift: 0.0,
                    ),
                  ),
                  CircleLayer(
                    circles: _buildFlowDots(
                      backboneSegments,
                      color: _backboneFlowColor,
                      phaseShift: 0.35,
                    ),
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
                  if (_currentGpsLocation != null)
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: _currentGpsLocation!,
                          width: 34,
                          height: 34,
                          alignment: Alignment.center,
                          child: _buildGpsPulseMarker(),
                        ),
                      ],
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
              );
            },
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
                                final lat = (selection['latitude'] as num).toDouble();
                                final lng = (selection['longitude'] as num).toDouble();
                                _animateTo(LatLng(lat, lng), 18.0);
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
                                        color: Colors.white.withValues(alpha: 0.5),
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
                          icon: _isLocating
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.my_location, size: 20),
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
