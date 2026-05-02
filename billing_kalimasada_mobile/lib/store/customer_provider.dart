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

  Future<void> fetchCustomers({bool refresh = false, String search = '', String? status}) async {
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
      String url = '/api/mobile-adapter/customers?page=$_page&limit=20&search=$search';
      if (status != null && status.isNotEmpty) {
        url += '&status=$status';
      }
      final response = await ApiClient.get(url);
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          final List<dynamic> newCustomers = data['data'];
          if (newCustomers.length < 20) {
            _hasMore = false;
          }
          _customers.addAll(newCustomers);
          _page++;
        } else {
          _error = data['message'];
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

  Future<void> fetchDashboardStats() async {
    _loading = true;
    notifyListeners();
    try {
      final response = await ApiClient.get('/api/mobile-adapter/dashboard');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          final statsData = data['data']['stats'];
          _stats = {
            'total': statsData['total_customers'] ?? 0,
            'active': statsData['active_customers'] ?? 0,
            'suspended': statsData['suspended_customers'] ?? 0,
            'isolated': statsData['isolated_customers'] ?? 0,
          };
        }
      }
    } catch (e) {
      // Ignore or log error
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<bool> restartConnection(String customerId) async {
    try {
      final response = await ApiClient.post('/api/mobile-adapter/action/restart', {
        'customer_id': customerId,
      });
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['success'] == true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateLocation(String customerId, double latitude, double longitude) async {
    try {
      final response = await ApiClient.put('/api/mobile-adapter/customers/$customerId/location', {
        'latitude': latitude,
        'longitude': longitude,
      });
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
