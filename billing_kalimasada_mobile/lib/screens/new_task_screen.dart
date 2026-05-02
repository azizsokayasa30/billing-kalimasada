import 'package:flutter/material.dart';

class NewTaskScreen extends StatefulWidget {
  const NewTaskScreen({super.key});

  @override
  State<NewTaskScreen> createState() => _NewTaskScreenState();
}

class _NewTaskScreenState extends State<NewTaskScreen> {
  String _priority = 'medium';

  @override
  Widget build(BuildContext context) {
    const bgBackground = Color(0xFFFCF8FF);
    const textOnSurface = Color(0xFF19163F);
    const textOnSurfaceVariant = Color(0xFF474551);
    
    return Scaffold(
      backgroundColor: bgBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF070038)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'New Task',
          style: TextStyle(
            color: Color(0xFF1B0C6B),
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFC8C4D3).withValues(alpha: 0.5), height: 1),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Create Task',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: textOnSurface,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Enter details for the new field operation assignment.',
              style: TextStyle(
                fontSize: 16,
                color: textOnSurfaceVariant,
              ),
            ),
            const SizedBox(height: 24),
            
            Container(
              padding: const EdgeInsets.all(20),
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildTextField(
                    label: 'Customer Name',
                    hintText: 'e.g. Acme Corp',
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    label: 'Task Title',
                    hintText: 'e.g. Quarterly Inspection',
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    label: 'Description',
                    hintText: 'Provide detailed instructions...',
                    maxLines: 4,
                  ),
                  const SizedBox(height: 16),
                  
                  // Technician and Due Date side by side
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'ASSIGNED TECHNICIAN',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: textOnSurfaceVariant,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              height: 48,
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFFC8C4D3)),
                              ),
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  isExpanded: true,
                                  hint: const Text('Select a technician'),
                                  value: null,
                                  icon: const Icon(Icons.arrow_drop_down, color: textOnSurfaceVariant),
                                  items: ['Sarah Jenkins', 'Marcus Wei', 'David O\'Connor']
                                      .map((name) => DropdownMenuItem(
                                            value: name,
                                            child: Text(name),
                                          ))
                                      .toList(),
                                  onChanged: (value) {},
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'DUE DATE',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: textOnSurfaceVariant,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              height: 48,
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFFC8C4D3)),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: const [
                                  Text('Select date', style: TextStyle(color: Color(0xFF787582))),
                                  Icon(Icons.calendar_today, size: 18, color: textOnSurfaceVariant),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Priority
                  const Text(
                    'PRIORITY',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: textOnSurfaceVariant,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEAE5FF), // surface-container-high
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFC8C4D3)),
                    ),
                    child: Row(
                      children: [
                        _buildPriorityOption('Low', 'low', const Color(0xFF19163F), Colors.white),
                        _buildPriorityOption('Medium', 'medium', const Color(0xFF19163F), Colors.white),
                        _buildPriorityOption('High', 'high', const Color(0xFF93000A), const Color(0xFFFFDAD6)),
                      ],
                    ),
                  ),
                  
                  const SizedBox(height: 32),
                  const Divider(color: Color(0xFFC8C4D3)),
                  const SizedBox(height: 16),
                  
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.save, color: Colors.white, size: 20),
                      label: const Text('Save Task', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF070038),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({required String label, required String hintText, int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: Color(0xFF474551),
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 4),
        TextField(
          maxLines: maxLines,
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: const TextStyle(color: Color(0xFF787582)),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFFC8C4D3)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFFC8C4D3)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFF070038)),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildPriorityOption(String label, String value, Color activeTextColor, Color activeBgColor) {
    final isSelected = _priority == value;
    
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() {
            _priority = value;
          });
        },
        child: Container(
          height: 40,
          decoration: BoxDecoration(
            color: isSelected ? activeBgColor : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 2,
                      offset: const Offset(0, 1),
                    )
                  ]
                : null,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: isSelected ? activeTextColor : const Color(0xFF474551),
            ),
          ),
        ),
      ),
    );
  }
}
