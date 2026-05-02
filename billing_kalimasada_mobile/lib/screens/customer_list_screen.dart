import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../store/customer_provider.dart';
import 'customer_detail_screen.dart';

class CustomerListScreen extends StatefulWidget {
  final String? initialFilter;
  
  const CustomerListScreen({super.key, this.initialFilter});

  @override
  State<CustomerListScreen> createState() => _CustomerListScreenState();
}

class _CustomerListScreenState extends State<CustomerListScreen> {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();

  // Colors from Stitch design
  final Color _bgBackground = const Color(0xFFFCF8FF);
  final Color _bgSurfaceContainerLowest = const Color(0xFFFFFFFF);
  final Color _bgSurfaceContainerLow = const Color(0xFFF6F1FF);
  final Color _bgSurfaceContainer = const Color(0xFFF0EBFF);
  final Color _bgSurfaceContainerHigh = const Color(0xFFEAE5FF);

  final Color _primaryColor = const Color(0xFF070038);
  final Color _primaryContainerColor = const Color(0xFF1B0C6B);
  final Color _secondaryColor = const Color(0xFF7E4990);
  final Color _errorColor = const Color(0xFFBA1A1A);

  final Color _textOnBackground = const Color(0xFF19163F);
  final Color _textOnSurfaceVariant = const Color(0xFF474551);
  final Color _textOnPrimary = const Color(0xFFFFFFFF);
  final Color _outlineVariant = const Color(0xFFC8C4D3);
  final Color _outline = const Color(0xFF787582);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CustomerProvider>().fetchCustomers(
        refresh: true, 
        status: widget.initialFilter,
      );
      context.read<CustomerProvider>().fetchDashboardStats();
    });

    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
          _scrollController.position.maxScrollExtent - 200) {
        context.read<CustomerProvider>().fetchCustomers(
          search: _searchController.text,
          status: widget.initialFilter,
        );
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearch() {
    context.read<CustomerProvider>().fetchCustomers(
      refresh: true,
      search: _searchController.text,
      status: widget.initialFilter,
    );
  }

  Widget _buildSkeleton() {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: 5,
      itemBuilder: (context, index) {
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: _bgSurfaceContainerLowest,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: _outlineVariant.withValues(alpha: 0.5)),
          ),
          child: Row(
            children: [
              Container(width: 8, height: 40, color: Colors.grey[300]),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(width: 100, height: 16, color: Colors.grey[300]),
                    const SizedBox(height: 8),
                    Container(width: 200, height: 14, color: Colors.grey[200]),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bgBackground,
      appBar: AppBar(
        backgroundColor: _primaryContainerColor,
        foregroundColor: _textOnPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Pelanggan',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 22),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {},
            tooltip: 'Filter',
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(60),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            child: Container(
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              child: TextField(
                controller: _searchController,
                style: TextStyle(color: _textOnBackground),
                decoration: InputDecoration(
                  hintText: 'Cari ID, Nama, atau Alamat...',
                  hintStyle: TextStyle(color: _outline),
                  prefixIcon: Icon(Icons.search, color: _outline),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                ),
                onSubmitted: (_) => _onSearch(),
              ),
            ),
          ),
        ),
      ),
      body: Consumer<CustomerProvider>(
        builder: (context, provider, child) {
          final stats = provider.stats;

          return Column(
            children: [
              // Status Summary
              Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    Expanded(
                      child: _buildStatusSummary(
                        'Aktif',
                        '${stats['active'] ?? 0}',
                        _primaryColor,
                        _bgSurfaceContainerHigh,
                        _outlineVariant,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildStatusSummary(
                        'Gangguan',
                        '${stats['isolated'] ?? 0}', // Using isolated as Gangguan
                        _errorColor,
                        const Color(0xFFFFDAD6), // error-container
                        _errorColor.withValues(alpha: 0.2),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildStatusSummary(
                        'Isolir',
                        '${stats['suspended'] ?? 0}',
                        _secondaryColor,
                        _bgSurfaceContainerHigh,
                        _outlineVariant,
                      ),
                    ),
                  ],
                ),
              ),

              // Customer List
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async {
                    provider.fetchDashboardStats();
                    await provider.fetchCustomers(
                      refresh: true,
                      search: _searchController.text,
                    );
                  },
                  color: _primaryContainerColor,
                  child: () {
                    if (provider.loading && provider.customers.isEmpty) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: _buildSkeleton(),
                      );
                    }

                    if (provider.error != null && provider.customers.isEmpty) {
                      return Center(
                        child: Text(
                          provider.error!,
                          style: TextStyle(color: _errorColor),
                        ),
                      );
                    }

                    if (provider.customers.isEmpty) {
                      return const Center(
                        child: Text('Tidak ada pelanggan ditemukan.'),
                      );
                    }

                    return ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount:
                          provider.customers.length +
                          (provider.hasMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index == provider.customers.length) {
                          return Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Center(
                              child: CircularProgressIndicator(
                                color: _primaryContainerColor,
                              ),
                            ),
                          );
                        }

                        final customer = provider.customers[index];
                        final status =
                            customer['status']?.toString().toLowerCase() ??
                            'active';

                        // Default to active colors
                        Color statusColor = const Color(0xFF10B981); // Emerald
                        Color bgColor = _bgSurfaceContainerLowest;
                        String statusLabel = 'Aktif';
                        IconData statusIcon = Icons.check_circle;

                        if (status == 'suspended') {
                          statusColor = _secondaryColor;
                          statusLabel = 'Isolir';
                          statusIcon = Icons.block;
                          bgColor = _bgSurfaceContainerLowest.withValues(
                            alpha: 0.75,
                          );
                        } else if (status == 'isolated') {
                          statusColor = _errorColor;
                          statusLabel = 'Gangguan';
                          statusIcon = Icons.error;
                          bgColor = const Color(
                            0xFFFFDAD6,
                          ).withValues(alpha: 0.2); // error container
                        }

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: bgColor,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: status == 'isolated'
                                  ? _errorColor.withValues(alpha: 0.3)
                                  : _outlineVariant,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.02),
                                blurRadius: 4,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                          child: InkWell(
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) =>
                                      CustomerDetailScreen(customer: customer),
                                ),
                              );
                            },
                            borderRadius: BorderRadius.circular(8),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Row(
                                children: [
                                  Container(
                                    width: 8,
                                    height: 40,
                                    decoration: BoxDecoration(
                                      color: statusColor,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 6,
                                                    vertical: 2,
                                                  ),
                                              decoration: BoxDecoration(
                                                color: _bgSurfaceContainer,
                                                borderRadius:
                                                    BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                'ID: ${customer['customer_id'] ?? '-'}',
                                                style: TextStyle(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                  color: _textOnSurfaceVariant,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 6,
                                                    vertical: 2,
                                                  ),
                                              decoration: BoxDecoration(
                                                color: statusColor.withValues(
                                                  alpha: 0.1,
                                                ),
                                                borderRadius:
                                                    BorderRadius.circular(4),
                                              ),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(
                                                    statusIcon,
                                                    size: 10,
                                                    color: statusColor,
                                                  ),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    statusLabel,
                                                    style: TextStyle(
                                                      fontSize: 10,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                      color: statusColor,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          customer['name'] ?? '-',
                                          style: TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w600,
                                            color: _textOnBackground,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 2),
                                        Row(
                                          children: [
                                            Icon(
                                              Icons.location_on,
                                              size: 14,
                                              color: _textOnSurfaceVariant,
                                            ),
                                            const SizedBox(width: 4),
                                            Expanded(
                                              child: Text(
                                                customer['address'] ?? '-',
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  color: _textOnSurfaceVariant,
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: const Color(
                                            0xFF1B0C6B,
                                          ).withValues(alpha: 0.1),
                                          borderRadius: BorderRadius.circular(
                                            4,
                                          ),
                                          border: Border.all(
                                            color: const Color(
                                              0xFF070038,
                                            ).withValues(alpha: 0.2),
                                          ),
                                        ),
                                        child: Text(
                                          'FO', // Service type placeholder
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            color: _primaryColor,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Icon(
                                        Icons.chevron_right,
                                        color: _outline,
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    );
                  }(),
                ),
              ),
              const SizedBox(height: 80), // Padding for bottom navbar
            ],
          );
        },
      ),
    );
  }

  Widget _buildStatusSummary(
    String label,
    String value,
    Color valueColor,
    Color bgColor,
    Color borderColor,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: _textOnSurfaceVariant,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w600,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }
}
