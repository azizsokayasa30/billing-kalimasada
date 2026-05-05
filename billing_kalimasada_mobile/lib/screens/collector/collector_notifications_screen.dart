import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../store/collector_notification_provider.dart';
import '../../theme/collector_colors.dart';

class CollectorNotificationsScreen extends StatefulWidget {
  const CollectorNotificationsScreen({super.key});

  @override
  State<CollectorNotificationsScreen> createState() => _CollectorNotificationsScreenState();
}

class _CollectorNotificationsScreenState extends State<CollectorNotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CollectorNotificationProvider>().fetchNotifications();
    });
  }

  String _subtitle(Map<String, dynamic> row) {
    final body = row['body']?.toString().trim();
    final created = row['created_at']?.toString();
    String? t;
    if (created != null && created.isNotEmpty) {
      try {
        final d = DateTime.tryParse(created);
        if (d != null) {
          t = DateFormat('d MMM yyyy, HH:mm', 'id_ID').format(d.toLocal());
        }
      } catch (_) {}
    }
    if (body != null && body.isNotEmpty && t != null) return '$body\n$t';
    if (body != null && body.isNotEmpty) return body;
    return t ?? '';
  }

  @override
  Widget build(BuildContext context) {
    final n = context.watch<CollectorNotificationProvider>();

    return Theme(
      data: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        colorScheme: ColorScheme.fromSeed(
          seedColor: FieldCollectorColors.primaryContainer,
          brightness: Brightness.light,
        ),
      ),
      child: Scaffold(
        backgroundColor: FieldCollectorColors.background,
        appBar: AppBar(
          backgroundColor: Colors.white,
          foregroundColor: FieldCollectorColors.primaryContainer,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          title: const Text('Notifikasi', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1)),
          actions: [
            TextButton(
              onPressed: n.unreadCount == 0
                  ? null
                  : () async {
                      await n.markAllRead();
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Semua ditandai dibaca')),
                        );
                      }
                    },
              child: const Text('Bersihkan badge'),
            ),
          ],
        ),
        body: n.loading && n.items.isEmpty
            ? const Center(child: CircularProgressIndicator(color: FieldCollectorColors.primaryContainer))
            : n.error != null && n.items.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(n.error!, textAlign: TextAlign.center),
                          const SizedBox(height: 12),
                          FilledButton(
                            onPressed: () => n.fetchNotifications(),
                            child: const Text('Coba lagi'),
                          ),
                        ],
                      ),
                    ),
                  )
                : RefreshIndicator(
                    color: FieldCollectorColors.primaryContainer,
                    onRefresh: () => n.fetchNotifications(),
                    child: n.items.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: const [
                              SizedBox(height: 120),
                              Center(
                                child: Text(
                                  'Belum ada notifikasi.\nTagihan baru, isolir, pembatalan pembayaran,\natau setoran dari admin akan muncul di sini.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(height: 1.45, color: FieldCollectorColors.onSurfaceVariant),
                                ),
                              ),
                            ],
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                            itemCount: n.items.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 8),
                            itemBuilder: (context, i) {
                              final row = n.items[i];
                              final unread = row['unread'] == true;
                              final title = row['title']?.toString() ?? 'Notifikasi';
                              return Material(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(12),
                                  onTap: () async {
                                    if (unread) await n.markRead(row['id']);
                                  },
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          width: 8,
                                          height: 8,
                                          margin: const EdgeInsets.only(top: 6, right: 10),
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            color: unread
                                                ? const Color(0xFFFF1744)
                                                : Colors.transparent,
                                          ),
                                        ),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                title,
                                                style: TextStyle(
                                                  fontWeight: unread ? FontWeight.w800 : FontWeight.w600,
                                                  fontSize: 15,
                                                  color: FieldCollectorColors.onSurface,
                                                ),
                                              ),
                                              if (_subtitle(row).isNotEmpty) ...[
                                                const SizedBox(height: 4),
                                                Text(
                                                  _subtitle(row),
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    height: 1.35,
                                                    color: FieldCollectorColors.onSurfaceVariant,
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
      ),
    );
  }
}
