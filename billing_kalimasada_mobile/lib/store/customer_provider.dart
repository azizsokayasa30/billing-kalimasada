import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/api_client.dart';

class CustomerProvider extends ChangeNotifier {
  bool _loading = false;
  String? _error;
  List<dynamic> _customers = [];
  Map<String, dynamic> _stats = {};
  bool _hasMore = true;
  int _page = 1;

  bool get loading => _loading;
  String? get error => _error;
  List<dynamic> get customers => _customers;
  Map<String, dynamic> get stats => _stats;
  bool get hasMore => _hasMore;

  Future<void> fetchCustomers({
    bool refresh = false,
    String search = '',
    String? status,
  }) async {
    if (refresh) {
      _page = 1;
      _customers = [];
      _hasMore = true;
    }

    if (!_hasMore || _loading) return;

    _loading = true;
    _error = null;
    if (refresh) notifyListeners();

    try {
      final q = Uri.encodeQueryComponent(search);
      String url = '/api/mobile-adapter/customers?page=$_page&limit=20&search=$q';
      if (status != null && status.isNotEmpty) {
        url += '&status=$status';
      }
      final response = await ApiClient.get(url);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        if (ApiClient.jsonSuccess(data['success'])) {
          final raw = data['data'];
          final newCustomers =
              raw is List ? List<dynamic>.from(raw) : <dynamic>[];
          if (newCustomers.length < 20) {
            _hasMore = false;
          }
          _customers.addAll(newCustomers);
          _page++;
        } else {
          _error = data['message']?.toString();
        }
      } else {
        _error = 'Gagal memuat data pelanggan';
      }
    } catch (e) {
      _error = 'Koneksi bermasalah: ${e.toString()}';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Jangan set `_loading` di sini — dipakai untuk pagination `fetchCustomers`; memakai flag yang sama bikin refresh/macet.
  ///
  /// [bustCache] — tambahkan query unik agar pull-to-refresh tidak memakai respons cache (proxy/CDN) dan angka selalu diambil ulang.
  Future<void> fetchDashboardStats({bool bustCache = false}) async {
    try {
      final path = bustCache
          ? '/api/mobile-adapter/dashboard?_=${DateTime.now().millisecondsSinceEpoch}'
          : '/api/mobile-adapter/dashboard';
      final response = await ApiClient.get(path);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        if (!ApiClient.jsonSuccess(data['success'])) return;

        final inner = data['data'];
        final statsWrap = inner is Map ? inner['stats'] : null;
        final statsData = statsWrap is Map<String, dynamic>
            ? statsWrap
            : (statsWrap is Map ? Map<String, dynamic>.from(statsWrap as Map) : null);
        if (statsData != null) {
          num nz(dynamic v) {
            if (v is num) return v;
            return num.tryParse(v?.toString() ?? '') ?? 0;
          }

          _stats = {
            'total': nz(statsData['total_customers']).toInt(),
            'active': nz(statsData['active_customers']).toInt(),
            'suspended': nz(statsData['suspended_customers']).toInt(),
            'isolated': nz(statsData['isolated_customers']).toInt(),
          };
        }
      }
    } catch (e) {
      // Ignore or log error
    } finally {
      notifyListeners();
    }
  }

  Future<bool> restartConnection(String customerId) async {
    try {
      final response = await ApiClient.post(
        '/api/mobile-adapter/action/restart',
        {'customer_id': customerId},
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['success'] == true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateLocation(
    String customerId,
    double latitude,
    double longitude, {
    int? odpId,
  }) async {
    try {
      final body = <String, dynamic>{
        'latitude': latitude,
        'longitude': longitude,
      };
      if (odpId != null && odpId > 0) {
        body['odp_id'] = odpId;
      }
      final response = await ApiClient.put(
        '/api/mobile-adapter/customers/$customerId/location',
        body,
      );
      print('UPDATE LOCATION RES: ${response.statusCode} - ${response.body}');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['success'] == true;
      }
      return false;
    } catch (e) {
      print('UPDATE LOCATION ERROR: $e');
      return false;
    }
  }
}
