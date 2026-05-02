import 'package:flutter/foundation.dart' show ChangeNotifier, debugPrint, kDebugMode;
import '../services/api_client.dart';

class CollectorProvider extends ChangeNotifier {
  /// Ditambah dari luar (tombol sync) agar tab Pelanggan memuat ulang dengan filter chip saat ini.
  int customersReloadNonce = 0;

  Map<String, dynamic>? _overview;
  List<dynamic> _customers = [];
  Map<String, dynamic>? _settlement;
  Map<String, dynamic>? _me;

  String? _overviewError;
  String? _customersError;
  String? _settlementError;
  String? _meError;

  bool _overviewLoading = false;
  bool _customersLoading = false;
  bool _settlementLoading = false;
  bool _meLoading = false;

  Map<String, dynamic>? get overview => _overview;
  List<dynamic> get customers => _customers;
  Map<String, dynamic>? get settlement => _settlement;
  Map<String, dynamic>? get me => _me;

  String? get overviewError => _overviewError;
  String? get customersError => _customersError;
  String? get settlementError => _settlementError;
  String? get meError => _meError;

  bool get overviewLoading => _overviewLoading;
  bool get customersLoading => _customersLoading;
  bool get settlementLoading => _settlementLoading;
  bool get meLoading => _meLoading;

  Future<void> fetchOverview({int? month, int? year}) async {
    _overviewLoading = true;
    _overviewError = null;
    notifyListeners();
    try {
      final q = <String>[];
      if (month != null) q.add('month=$month');
      if (year != null) q.add('year=$year');
      final path =
          '/api/mobile-adapter/collector/overview${q.isEmpty ? '' : '?${q.join('&')}'}';
      final r = await ApiClient.get(path);
      final body = ApiClient.decodeJsonObject(r, debugLabel: 'collector/overview');
      if (r.statusCode == 200 && body['success'] == true) {
        _overview = Map<String, dynamic>.from(body['data'] as Map);
      } else {
        _overviewError = body['message']?.toString() ?? 'Gagal memuat';
      }
    } catch (e) {
      _overviewError = e.toString();
    } finally {
      _overviewLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchCustomers({String status = '', String q = ''}) async {
    _customersLoading = true;
    _customersError = null;
    notifyListeners();
    try {
      final params = <String>[];
      if (status.isNotEmpty) params.add('status=${Uri.encodeComponent(status)}');
      if (q.trim().isNotEmpty) params.add('q=${Uri.encodeComponent(q.trim())}');
      final path =
          '/api/mobile-adapter/collector/customers${params.isEmpty ? '' : '?${params.join('&')}'}';
      final r = await ApiClient.get(path);
      final body = ApiClient.decodeJsonObject(r, debugLabel: 'collector/customers');
      if (r.statusCode == 200 && body['success'] == true) {
        final raw = body['data'];
        if (raw is List) {
          _customers = List<dynamic>.from(raw);
        } else {
          _customers = [];
          _customersError = 'Format data pelanggan tidak valid (bukan array).';
        }
        if (kDebugMode) {
          debugPrint('[collector/customers] status=$status q="$q" → ${_customers.length} baris');
        }
      } else {
        _customersError = body['message']?.toString() ?? 'Gagal memuat';
      }
    } catch (e) {
      _customersError = e.toString();
    } finally {
      _customersLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchSettlement() async {
    _settlementLoading = true;
    _settlementError = null;
    notifyListeners();
    try {
      final r = await ApiClient.get('/api/mobile-adapter/collector/settlement');
      final body = ApiClient.decodeJsonObject(r, debugLabel: 'collector/settlement');
      if (r.statusCode == 200 && body['success'] == true) {
        _settlement = Map<String, dynamic>.from(body['data'] as Map);
      } else {
        _settlementError = body['message']?.toString() ?? 'Gagal memuat';
      }
    } catch (e) {
      _settlementError = e.toString();
    } finally {
      _settlementLoading = false;
      notifyListeners();
    }
  }

  void bumpCustomersReload() {
    customersReloadNonce++;
    notifyListeners();
  }

  Future<void> fetchMe() async {
    _meLoading = true;
    _meError = null;
    notifyListeners();
    try {
      final r = await ApiClient.get('/api/mobile-adapter/collector/me');
      final body = ApiClient.decodeJsonObject(r, debugLabel: 'collector/me');
      if (r.statusCode == 200 && body['success'] == true) {
        _me = Map<String, dynamic>.from(body['data'] as Map);
      } else {
        _meError = body['message']?.toString() ?? 'Gagal memuat';
      }
    } catch (e) {
      _meError = e.toString();
    } finally {
      _meLoading = false;
      notifyListeners();
    }
  }
}
