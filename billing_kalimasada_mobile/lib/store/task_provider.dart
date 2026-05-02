import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/api_client.dart';

class TaskProvider extends ChangeNotifier {
  bool _loading = false;
  String? _error;
  List<dynamic> _tasks = [];

  bool get loading => _loading;
  String? get error => _error;
  List<dynamic> get tasks => _tasks;

  Future<void> fetchTasks({bool refresh = false}) async {
    if (_loading && !refresh) return;

    _loading = true;
    _error = null;
    if (refresh) notifyListeners();

    try {
      final response = await ApiClient.get('/api/mobile-adapter/tasks');
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          _tasks = data['data'];
        } else {
          _error = data['message'];
        }
      } else {
        _error = 'Gagal memuat data tugas';
      }
    } catch (e) {
      _error = 'Koneksi bermasalah: ${e.toString()}';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<bool> updateTaskStatus(String id, String type, String status) async {
    try {
      final response = await ApiClient.post('/api/mobile-adapter/tasks/$type/$id/status', {
        'status': status,
      });

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          // Update the local list
          final index = _tasks.indexWhere((t) => t['id']?.toString() == id && t['type'] == type);
          if (index != -1) {
            _tasks[index]['status'] = status;
            notifyListeners();
          }
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }
}
