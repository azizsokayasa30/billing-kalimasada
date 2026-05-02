import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../store/task_provider.dart';
import '../store/auth_provider.dart';
import 'new_task_screen.dart';
import 'job_execution_screen.dart';
import 'task_detail_screen.dart';

class TaskListScreen extends StatefulWidget {
  final void Function(int)? onNavigateToTab;

  const TaskListScreen({super.key, this.onNavigateToTab});

  @override
  State<TaskListScreen> createState() => _TaskListScreenState();
}

class _TaskListScreenState extends State<TaskListScreen> {
  bool _isSearching = false;
  String _searchQuery = '';
  String _selectedType = 'Semua'; // 'Semua', 'Tiket', 'PSB'
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TaskProvider>().fetchTasks();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isTechnician = context.watch<AuthProvider>().role == 'technician';
    const bgBackground = Color(0xFFFCF8FF);
    const textOnSurface = Color(0xFF19163F);
    const textOnSurfaceVariant = Color(0xFF474551);
    
    return Scaffold(
      backgroundColor: bgBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: _isSearching
            ? TextField(
                controller: _searchController,
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: 'Cari tugas, pelanggan...',
                  border: InputBorder.none,
                ),
                onChanged: (value) {
                  setState(() {
                    _searchQuery = value.toLowerCase();
                  });
                },
              )
            : const Text(
                'FieldOps Precision',
                style: TextStyle(
                  color: Color(0xFF1B0C6B),
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
        centerTitle: !_isSearching,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF787582)),
          onPressed: () {
            if (_isSearching) {
              setState(() {
                _isSearching = false;
                _searchQuery = '';
                _searchController.clear();
              });
            } else {
              if (Navigator.canPop(context)) {
                Navigator.pop(context);
              } else if (widget.onNavigateToTab != null) {
                widget.onNavigateToTab!(0); // Go back to Dashboard tab
              }
            }
          },
        ),
        actions: [
          if (!_isSearching)
            IconButton(
              icon: const Icon(Icons.search, color: Color(0xFF787582)),
              onPressed: () {
                setState(() {
                  _isSearching = true;
                });
              },
            ),
          IconButton(
            icon: const Icon(Icons.filter_list, color: Color(0xFF787582)),
            onPressed: () {},
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFC8C4D3).withValues(alpha: 0.5), height: 1),
        ),
      ),
      body: Consumer<TaskProvider>(
        builder: (context, provider, child) {
          if (provider.loading && provider.tasks.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          var tasks = provider.tasks;
          
          if (_selectedType != 'Semua') {
            tasks = tasks.where((t) {
              final type = t['type']?.toString().toUpperCase() ?? '';
              if (_selectedType == 'Tiket') return type == 'TR';
              if (_selectedType == 'PSB') return type == 'INSTALL';
              return true;
            }).toList();
          }

          // Removed status filtering to synchronize with web dashboard which shows all tasks

          if (_searchQuery.isNotEmpty) {
            tasks = tasks.where((t) {
              final title = (t['title'] ?? '').toString().toLowerCase();
              final customer = (t['customer'] ?? '').toString().toLowerCase();
              final address = (t['address'] ?? '').toString().toLowerCase();
              return title.contains(_searchQuery) ||
                     customer.contains(_searchQuery) ||
                     address.contains(_searchQuery);
            }).toList();
          }

          return RefreshIndicator(
            onRefresh: () => provider.fetchTasks(refresh: true),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Daftar Tugas',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: textOnSurface,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${tasks.length} active work orders assigned to you.',
                          style: const TextStyle(
                            fontSize: 16,
                            color: textOnSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  // Filters
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      children: [
                        _buildFilterButton(
                          icon: Icons.tune,
                          label: 'FILTERS',
                          bgColor: const Color(0xFFEAE5FF),
                          textColor: textOnSurface,
                        ),
                        const SizedBox(width: 12),

                        PopupMenuButton<String>(
                          color: Colors.white,
                          surfaceTintColor: Colors.white,
                          onSelected: (String result) {
                            setState(() {
                              _selectedType = result;
                            });
                          },
                          itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
                            const PopupMenuItem<String>(
                              value: 'Semua',
                              child: Text('Semua', style: TextStyle(color: Colors.black)),
                            ),
                            const PopupMenuItem<String>(
                              value: 'Tiket',
                              child: Text('Tiket', style: TextStyle(color: Colors.black)),
                            ),
                            const PopupMenuItem<String>(
                              value: 'PSB',
                              child: Text('PSB', style: TextStyle(color: Colors.black)),
                            ),
                          ],
                          child: _buildFilterButton(
                            label: _selectedType == 'Semua' ? 'TIKET/PSB' : _selectedType.toUpperCase(),
                            suffixIcon: Icons.arrow_drop_down,
                            bgColor: Colors.white,
                            textColor: textOnSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  const SizedBox(height: 20),
                  
                  if (provider.error != null && tasks.isEmpty)
                    Center(child: Text(provider.error!, style: const TextStyle(color: Colors.red)))
                  else if (tasks.isEmpty)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(20.0),
                        child: Text('Tidak ada tugas tersedia.'),
                      ),
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Column(
                        children: tasks.map((task) => _buildTaskCard(task)).toList(),
                      ),
                    ),
                  
                  const SizedBox(height: 80),
                ],
              ),
            ),
          );
        },
      ),

      floatingActionButton: isTechnician ? null : FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const NewTaskScreen()),
          );
        },
        backgroundColor: const Color(0xFF070038),
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildFilterButton({IconData? icon, required String label, IconData? suffixIcon, required Color bgColor, required Color textColor}) {
    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF787582).withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 18, color: textColor),
            const SizedBox(width: 8),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: textColor,
              letterSpacing: 0.5,
            ),
          ),
          if (suffixIcon != null) ...[
            const SizedBox(width: 8),
            Icon(suffixIcon, size: 18, color: textColor),
          ],
        ],
      ),
    );
  }

  Widget _buildTaskCard(Map<String, dynamic> task) {
    Color priorityColor;
    Color priorityBgColor;
    IconData priorityIcon;
    
    switch (task['priority']?.toString().toUpperCase()) {
      case 'HIGH':
      case 'CRITICAL':
        priorityColor = const Color(0xFF93000A);
        priorityBgColor = const Color(0xFFFFDAD6);
        priorityIcon = Icons.error;
        break;
      case 'MEDIUM':
        priorityColor = const Color(0xFF423A91);
        priorityBgColor = const Color(0xFFE4DFFF);
        priorityIcon = Icons.info;
        break;
      case 'LOW':
      case 'NORMAL':
      default:
        priorityColor = const Color(0xFF474551);
        priorityBgColor = const Color(0xFFEAE5FF); // surface-variant
        priorityIcon = Icons.check_circle;
        break;
    }

    final type = task['type']?.toString().toUpperCase() ?? '';
    Color typeColor;
    Color typeBgColor;
    
    if (type == 'TR') {
      typeColor = const Color(0xFFBA1A1A); // Red
      typeBgColor = const Color(0xFFFFDAD6);
    } else if (type == 'INSTALL') {
      typeColor = const Color(0xFF146C2E); // Green
      typeBgColor = const Color(0xFFC4EECE);
    } else {
      typeColor = const Color(0xFF474551);
      typeBgColor = const Color(0xFFF0EBFF);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFC8C4D3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 6,
                color: typeColor,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: priorityBgColor,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(priorityIcon, size: 14, color: priorityColor),
                                const SizedBox(width: 4),
                                Text(
                                  task['priority']?.toString() ?? 'NORMAL',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: priorityColor,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: typeBgColor,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              task['sector'] ?? (type == 'TR' ? 'TIKET' : type == 'INSTALL' ? 'PSB' : 'UMUM'),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: typeColor,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        task['title']?.toString() ?? 'Tugas',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF19163F),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.apartment, size: 18, color: Color(0xFF787582)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  task['customer']?.toString() ?? 'Nama Pelanggan',
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF19163F),
                                  ),
                                ),
                                Text(
                                  'ID: ${task['id']?.toString() ?? '-'}',
                                  style: const TextStyle(
                                    fontSize: 16,
                                    color: Color(0xFF474551),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.location_on, size: 18, color: Color(0xFF787582)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              task['address']?.toString() ?? 'Alamat tidak tersedia',
                              style: const TextStyle(
                                fontSize: 16,
                                color: Color(0xFF474551),
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (task['phone'] != null) ...[
                        const SizedBox(height: 8),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.phone, size: 18, color: Color(0xFF787582)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                task['phone'].toString(),
                                style: const TextStyle(
                                  fontSize: 16,
                                  color: Color(0xFF474551),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 16),
                      const Divider(color: Color(0xFFE4DFFF)),
                      const SizedBox(height: 8),
                      
                      // Action buttons based on priority
                      if (task['priority'] == 'HIGH')
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () {
                              final id = task['id']?.toString();
                              final type = task['type']?.toString();
                              if (id != null && type != null) {
                                context.read<TaskProvider>().updateTaskStatus(id, type, 'mulai');
                              }
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => JobExecutionScreen(task: task),
                                ),
                              ).then((_) {
                                if (context.mounted) {
                                  context.read<TaskProvider>().fetchTasks(refresh: true);
                                }
                              });
                            },
                            icon: const Icon(Icons.play_arrow, color: Colors.white, size: 20),
                            label: const Text('Start Job', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF070038),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        )
                      else if (task['priority'] == 'MEDIUM')
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () {},
                                style: OutlinedButton.styleFrom(
                                  side: const BorderSide(color: Color(0xFF787582)),
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                child: const Text('Details', style: TextStyle(color: Color(0xFF19163F), fontWeight: FontWeight.w600)),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: () {
                                  final id = task['id']?.toString();
                                  final type = task['type']?.toString();
                                  if (id != null && type != null) {
                                    context.read<TaskProvider>().updateTaskStatus(id, type, 'mulai');
                                  }
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) => JobExecutionScreen(task: task),
                                    ),
                                  ).then((_) {
                                    if (context.mounted) {
                                      context.read<TaskProvider>().fetchTasks(refresh: true);
                                    }
                                  });
                                },
                                icon: const Icon(Icons.play_arrow, color: Colors.white, size: 20),
                                label: const Text('Start', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF070038),
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                              ),
                            ),
                          ],
                        )
                      else
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => TaskDetailScreen(task: task),
                                ),
                              ).then((_) {
                                if (context.mounted) {
                                  context.read<TaskProvider>().fetchTasks(refresh: true);
                                }
                              });
                            },
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: Color(0xFF787582)),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            child: const Text('LIHAT', style: TextStyle(color: Color(0xFF19163F), fontWeight: FontWeight.w600)),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

