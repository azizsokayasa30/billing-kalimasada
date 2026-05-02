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
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
    _role = prefs.getString('role');
    
    final userStr = prefs.getString('user');
    if (userStr != null) {
      _user = jsonDecode(userStr);
    }
    
    _isInitialized = true;
    notifyListeners();
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
