import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_client.dart';

class AuthProvider extends ChangeNotifier {
  bool _isInitialized = false;
  bool _loading = false;
  String? _error;
  String? _token;
  String? _role;
  Map<String, dynamic>? _user;

  bool get isInitialized => _isInitialized;
  bool get loading => _loading;
  String? get error => _error;
  String? get token => _token;
  String? get role => _role;
  Map<String, dynamic>? get user => _user;

  Future<void> initialize() async {
    try {
      final prefs = await SharedPreferences.getInstance().timeout(
        const Duration(seconds: 12),
      );
      _token = prefs.getString('token');
      _role = prefs.getString('role');

      final userStr = prefs.getString('user');
      if (userStr != null) {
        try {
          final decoded = jsonDecode(userStr);
          if (decoded is Map) {
            _user = Map<String, dynamic>.from(decoded);
          }
        } catch (_) {
          _user = null;
        }
      }
    } catch (_) {
      /* SP lambat / gagal — tetap tampilkan login, bukan splash abadi */
    } finally {
      _isInitialized = true;
      notifyListeners();
    }
  }

  Future<void> login(String phone, String password) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await ApiClient.post('/api/auth/login', {
        'username': phone,
        'password': password,
      });

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          _token = data['token'];
          _user = data['user'];
          _role = _user?['role'];

          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('token', _token!);
          await prefs.setString('role', _role ?? '');
          await prefs.setString('user', jsonEncode(_user));
        } else {
          _error = data['message'] ?? 'Login gagal';
        }
      } else {
        final data = jsonDecode(response.body);
        _error = data['message'] ?? 'Gagal menghubungi server';
      }
    } catch (e) {
      _error = 'Koneksi bermasalah: ${e.toString()}';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Muat ulang profil teknisi dari server (sinkron dengan web / tabel technicians).
  Future<void> refreshTechnicianProfile() async {
    if (_role != 'technician' || _token == null) return;
    try {
      final response = await ApiClient.get('/api/mobile-adapter/me');
      if (response.statusCode != 200) return;
      final data = jsonDecode(response.body);
      if (data['success'] == true && data['data'] != null) {
        final merged = Map<String, dynamic>.from(data['data'] as Map);
        merged['role'] = 'technician';
        _user = merged;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user', jsonEncode(_user));
        notifyListeners();
      }
    } catch (_) {
      /* biarkan cache login */
    }
  }

  Future<String?> updateTechnicianProfile({
    required String name,
    required String phone,
    String? email,
    String? address,
  }) async {
    if (_role != 'technician' || _token == null) {
      return 'Akun teknisi tidak aktif';
    }
    try {
      final response = await ApiClient.put('/api/mobile-adapter/me', {
        'name': name,
        'phone': phone,
        'email': email ?? '',
        'address': address ?? '',
      });
      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        await refreshTechnicianProfile();
        return null;
      }
      return data['message']?.toString() ?? 'Gagal menyimpan';
    } catch (e) {
      return e.toString();
    }
  }

  Future<void> logout() async {
    _token = null;
    _role = null;
    _user = null;
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('role');
    await prefs.remove('user');
    
    notifyListeners();
  }
}
