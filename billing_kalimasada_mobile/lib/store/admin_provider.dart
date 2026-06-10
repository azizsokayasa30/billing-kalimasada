import 'package:flutter/foundation.dart';
import '../services/api_client.dart';

class AdminProvider extends ChangeNotifier {
  Map<String, dynamic>? _overview;
  bool _loading = false;
  String? _error;

  Map<String, dynamic>? get overview => _overview;
  bool get loading => _loading;
  String? get error => _error;

  static String _cacheBust(bool refresh) =>
      refresh ? '?_=${DateTime.now().millisecondsSinceEpoch}' : '';

  static Map<String, dynamic> _networkFromStatus(Map<String, dynamic> body) {
    final routersRaw = body['routers'];
    final routers = routersRaw is List ? routersRaw : const [];
    var online = 0;
    for (final item in routers) {
      if (item is Map && (item['status'] ?? '').toString() == 'online') {
        online++;
      }
    }
    final summaryMap = body['summary'];
    final activeSessions = summaryMap is Map
        ? ((summaryMap['active'] as num?)?.toInt() ?? 0)
        : 0;
    final totalRouters = routers.length;
    String summary;
    if (totalRouters == 0) {
      summary = 'unknown';
    } else if (online == 0) {
      summary = 'offline';
    } else if (online < totalRouters) {
      summary = 'partial';
    } else {
      summary = 'online';
    }
    return {
      'summary': summary,
      'routersOnline': online,
      'routersTotal': totalRouters,
      'activeSessions': activeSessions,
    };
  }

  static ({int total, int gangguan}) _taskCounts(Map<String, dynamic> body) {
    final raw = body['data'];
    if (raw is! List) return (total: 0, gangguan: 0);
    var gangguan = 0;
    for (final item in raw) {
      if (item is! Map) continue;
      final type = (item['type'] ?? '').toString().toUpperCase();
      final sector = (item['sector'] ?? '').toString().toUpperCase();
      if (type == 'TR' || sector == 'TIKET') gangguan++;
    }
    return (total: raw.length, gangguan: gangguan);
  }

  Future<void> fetchOverview({bool refresh = false}) async {
    _loading = true;
    if (refresh) _error = null;
    notifyListeners();
    try {
      final bust = _cacheBust(refresh);
      final responses = await Future.wait([
        ApiClient.get('/api/mobile-adapter/collector/overview$bust'),
        ApiClient.get('/api/mobile-adapter/tasks$bust'),
        ApiClient.get('/api/mobile-adapter/network-status$bust'),
      ]);

      final colRes = responses[0];
      final colBody = ApiClient.decodeJsonObject(colRes, debugLabel: 'collector/overview');
      if (colRes.statusCode != 200 || !ApiClient.jsonSuccess(colBody['success'])) {
        _error = colBody['message']?.toString() ??
            'Gagal memuat dashboard (HTTP ${colRes.statusCode})';
        return;
      }

      final data = Map<String, dynamic>.from(colBody['data'] as Map);
      final field = data['fieldUi'] is Map
          ? Map<String, dynamic>.from(data['fieldUi'] as Map)
          : <String, dynamic>{};
      final stats = data['statistics'] is Map
          ? Map<String, dynamic>.from(data['statistics'] as Map)
          : <String, dynamic>{};
      final tagihan = stats['tagihan'] is Map
          ? Map<String, dynamic>.from(stats['tagihan'] as Map)
          : <String, dynamic>{};

      var totalTugas = 0;
      var totalGangguan = 0;
      try {
        final tasksRes = responses[1];
        if (tasksRes.statusCode == 200) {
          final tasksBody = ApiClient.decodeJsonObject(tasksRes, debugLabel: 'tasks');
          if (ApiClient.jsonSuccess(tasksBody['success'])) {
            final counts = _taskCounts(tasksBody);
            totalTugas = counts.total;
            totalGangguan = counts.gangguan;
          }
        }
      } catch (_) {
        /* opsional */
      }

      var networkStatus = <String, dynamic>{
        'summary': 'unknown',
        'routersOnline': 0,
        'routersTotal': 0,
        'activeSessions': 0,
      };
      try {
        final netRes = responses[2];
        if (netRes.statusCode == 200) {
          final netBody = ApiClient.decodeJsonObject(netRes, debugLabel: 'network-status');
          if (ApiClient.jsonSuccess(netBody['success'])) {
            networkStatus = _networkFromStatus(netBody);
          }
        }
      } catch (_) {
        /* opsional */
      }

      _overview = {
        'totalPelanggan': (field['totalPelangganAktif'] as num?)?.toInt() ?? 0,
        'totalTagihan': (field['targetMonth'] as num?)?.toInt() ??
            (tagihan['total'] as num?)?.toInt() ??
            0,
        'lunas': (field['lunasCount'] as num?)?.toInt() ?? 0,
        'belumLunas': (field['belumBayarCount'] as num?)?.toInt() ?? 0,
        'totalTugas': totalTugas,
        'totalGangguan': totalGangguan,
        'networkStatus': networkStatus,
      };
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
