import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class ApiClient {
  /// Prioritas: API_URL → BILLING_API_URL → API_BASE_URL (tanpa slash akhir).
  /// Contoh: `http://192.168.1.10:3000` atau `https://billing.domain.com`
  static String get _baseUrl {
    String? fromEnv;
    for (final key in ['API_URL', 'BILLING_API_URL', 'API_BASE_URL']) {
      final v = dotenv.env[key]?.trim();
      if (v != null && v.isNotEmpty) {
        fromEnv = v;
        break;
      }
    }
    String base = fromEnv ?? 'http://192.168.0.200:2002';
    while (base.endsWith('/')) {
      base = base.substring(0, base.length - 1);
    }
    return base;
  }

  static Uri _uri(String endpoint) {
    final path = endpoint.startsWith('/') ? endpoint : '/$endpoint';
    return Uri.parse(_baseUrl).resolve(path);
  }

  static Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<http.Response> get(String endpoint) async {
    final headers = await _getHeaders();
    final uri = _uri(endpoint);
    final response = await http.get(uri, headers: headers);
    print('GET $uri → ${response.statusCode}');
    return response;
  }

  static Future<http.Response> post(String endpoint, Map<String, dynamic> body) async {
    final headers = await _getHeaders();
    return http.post(
      _uri(endpoint),
      headers: headers,
      body: jsonEncode(body),
    );
  }

  static Future<http.Response> put(String endpoint, Map<String, dynamic> body) async {
    final headers = await _getHeaders();
    return http.put(
      _uri(endpoint),
      headers: headers,
      body: jsonEncode(body),
    );
  }
}
