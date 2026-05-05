import 'package:flutter/material.dart';

class AddNewCustomerScreen extends StatefulWidget {
  const AddNewCustomerScreen({super.key});

  @override
  State<AddNewCustomerScreen> createState() => _AddNewCustomerScreenState();
}

class _AddNewCustomerScreenState extends State<AddNewCustomerScreen> {
  String? _selectedDistrict;
  String? _selectedPlan;

  @override
  Widget build(BuildContext context) {
    const bgBackground = Color(0xFFFCF8FF);
    const textOnSurface = Color(0xFF19163F);
    const textOnSurfaceVariant = Color(0xFF474551);
    const primaryColor = Color(0xFF070038);

    return Scaffold(
      backgroundColor: bgBackground,
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8FAFC), // slate-50
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1E1B4B)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Tambah Pelanggan',
          style: TextStyle(
            color: Color(0xFF1E1B4B),
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: false,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE2E8F0), height: 1),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Informasi Pribadi
            _buildSectionContainer(
              icon: Icons.person,
              title: 'Informasi Pribadi',
              child: Column(
                children: [
                  _buildTextField(
                    label: 'Nama Lengkap *',
                    hint: 'Masukkan nama lengkap',
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    label: 'No. Telepon *',
                    hint: '08xx xxxx xxxx',
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    label: 'Alamat Email (Opsional)',
                    hint: 'email@contoh.com',
                    keyboardType: TextInputType.emailAddress,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Informasi Alamat
            _buildSectionContainer(
              icon: Icons.home_work,
              title: 'Informasi Alamat',
              child: Column(
                children: [
                  _buildTextField(
                    label: 'Alamat Layanan *',
                    hint: 'Masukkan alamat lengkap layanan',
                    maxLines: 3,
                  ),
                  const SizedBox(height: 16),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Wilayah/Sektor *',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: textOnSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 4),
                      DropdownButtonFormField<String>(
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(
                              color: Color(0xFFC8C4D3),
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(
                              color: Color(0xFFC8C4D3),
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: primaryColor),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                        ),
                        hint: const Text('Pilih Wilayah/Sektor'),
                        initialValue: _selectedDistrict,
                        items: const [
                          DropdownMenuItem(
                            value: 'sektor_utara',
                            child: Text('Sektor Utara'),
                          ),
                          DropdownMenuItem(
                            value: 'sektor_selatan',
                            child: Text('Sektor Selatan'),
                          ),
                          DropdownMenuItem(
                            value: 'sektor_timur',
                            child: Text('Sektor Timur'),
                          ),
                          DropdownMenuItem(
                            value: 'sektor_barat',
                            child: Text('Sektor Barat'),
                          ),
                        ],
                        onChanged: (val) =>
                            setState(() => _selectedDistrict = val),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Konfigurasi Jaringan
            _buildSectionContainer(
              icon: Icons.router,
              title: 'Konfigurasi Jaringan',
              child: Column(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Paket Layanan *',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: textOnSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 4),
                      DropdownButtonFormField<String>(
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(
                              color: Color(0xFFC8C4D3),
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(
                              color: Color(0xFFC8C4D3),
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: primaryColor),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                        ),
                        hint: const Text('Pilih Paket'),
                        initialValue: _selectedPlan,
                        items: const [
                          DropdownMenuItem(
                            value: '20mbps',
                            child: Text('20 Mbps - Standar'),
                          ),
                          DropdownMenuItem(
                            value: '50mbps',
                            child: Text('50 Mbps - Cepat'),
                          ),
                          DropdownMenuItem(
                            value: '100mbps',
                            child: Text('100 Mbps - Super'),
                          ),
                        ],
                        onChanged: (val) => setState(() => _selectedPlan = val),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    label: 'Alamat MAC *',
                    hint: 'XX:XX:XX:XX:XX:XX',
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    label: 'ODP Terdekat *',
                    hint: 'Cari ODP (mis. ODP-BLS-01)',
                    prefixIcon: Icons.search,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Form Actions
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(
                        color: Color(0xFF787582),
                        width: 2,
                      ),
                      minimumSize: const Size(0, 48),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text(
                      'Batal',
                      style: TextStyle(
                        color: textOnSurface,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: () {},
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryColor,
                      minimumSize: const Size(0, 48),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text(
                      'Simpan Pelanggan',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionContainer({
    required IconData icon,
    required String title,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFC8C4D3)),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 2)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: const Color(0xFF070038)),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF070038),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Divider(color: Color(0xFFF0EBFF), thickness: 2),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }

  Widget _buildTextField({
    required String label,
    required String hint,
    int maxLines = 1,
    TextInputType keyboardType = TextInputType.text,
    IconData? prefixIcon,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: Color(0xFF474551),
          ),
        ),
        const SizedBox(height: 4),
        TextField(
          maxLines: maxLines,
          keyboardType: keyboardType,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: prefixIcon != null
                ? Icon(prefixIcon, color: const Color(0xFF474551))
                : null,
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
            focusedBorder: const OutlineInputBorder(
              borderRadius: BorderRadius.all(Radius.circular(8)),
              borderSide: BorderSide(color: Color(0xFF070038)),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 12,
            ),
          ),
        ),
      ],
    );
  }
}
