import 'package:flutter/material.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const bgBackground = Color(0xFFFCF8FF);
    const textOnSurface = Color(0xFF19163F);
    const textOnSurfaceVariant = Color(0xFF474551);
    const primaryColor = Color(0xFF070038);

    return Scaffold(
      backgroundColor: bgBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF474551)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Notifications',
          style: TextStyle(
            color: Color(0xFF1E1B4B),
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE2E8F0), height: 1),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Today Section
          const Text(
            'Today',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: textOnSurface),
          ),
          const SizedBox(height: 12),
          
          _buildNotificationCard(
            isUnread: true,
            icon: Icons.assignment,
            iconBgColor: const Color(0xFF1B0C6B), // primary-container
            iconColor: const Color(0xFF857ED9), // on-primary-container
            title: 'New Task Assigned',
            time: '10m ago',
            description: 'Installation at Site A-42 requires immediate attention. Ensure fiber splice kit is ready.',
          ),
          const SizedBox(height: 12),
          
          _buildNotificationCard(
            isUnread: true,
            icon: Icons.warning,
            iconBgColor: const Color(0xFFFFDAD6), // error-container
            iconColor: const Color(0xFF93000A), // on-error-container
            title: 'Network Alert: Sector 7',
            time: '1h ago',
            description: 'Signal degradation detected. Preliminary checks suggest physical layer issue.',
          ),
          const SizedBox(height: 12),
          
          _buildNotificationCard(
            isUnread: false,
            icon: Icons.check_circle,
            iconBgColor: const Color(0xFFE4DFFF), // surface-variant
            iconColor: textOnSurfaceVariant,
            title: 'Payment Confirmed',
            time: '3h ago',
            description: 'Client invoice #INV-8890 settled. Account status updated to active.',
          ),

          const SizedBox(height: 32),

          // Yesterday Section
          const Text(
            'Yesterday',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: textOnSurface),
          ),
          const SizedBox(height: 12),
          
          _buildNotificationCard(
            isUnread: false,
            icon: Icons.assignment,
            iconBgColor: const Color(0xFFE4DFFF),
            iconColor: textOnSurfaceVariant,
            title: 'Task Updated',
            time: '1d ago',
            description: 'Schedule changed for Site B-12 maintenance. Now set for tomorrow at 0900.',
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationCard({
    required bool isUnread,
    required IconData icon,
    required Color iconBgColor,
    required Color iconColor,
    required String title,
    required String time,
    required String description,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFC8C4D3)),
        boxShadow: isUnread
            ? [const BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))]
            : null,
      ),
      child: Opacity(
        opacity: isUnread ? 1.0 : 0.8,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (isUnread)
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 20, right: 8),
                decoration: const BoxDecoration(
                  color: Color(0xFF070038), // primary
                  shape: BoxShape.circle,
                ),
              )
            else
              const SizedBox(width: 16),
              
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: iconBgColor,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: iconColor),
            ),
            const SizedBox(width: 16),
            
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF19163F),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        time,
                        style: const TextStyle(
                          fontSize: 14,
                          color: Color(0xFF474551),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF474551),
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
