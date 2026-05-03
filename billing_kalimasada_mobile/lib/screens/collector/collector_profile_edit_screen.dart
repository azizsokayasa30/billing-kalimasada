import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../store/collector_provider.dart';
import '../../theme/collector_colors.dart';

/// Ubah nama, alamat, email, dan nomor HP kolektor (API PUT /collector/me).
class CollectorProfileEditScreen extends StatefulWidget {
  const CollectorProfileEditScreen({super.key});

  @override
  State<CollectorProfileEditScreen> createState() => _CollectorProfileEditScreenState();
}

class _CollectorProfileEditScreenState extends State<CollectorProfileEditScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _address;
  late final TextEditingController _email;
  late final TextEditingController _phone;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final m = context.read<CollectorProvider>().me;
    _name = TextEditingController(text: m?['name']?.toString() ?? '');
    _address = TextEditingController(text: m?['address']?.toString() ?? '');
    _email = TextEditingController(text: m?['email']?.toString() ?? '');
    _phone = TextEditingController(text: m?['phone']?.toString() ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _address.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final err = await context.read<CollectorProvider>().updateCollectorProfile(
          name: _name.text.trim(),
          phone: _phone.text.trim(),
          email: _email.text.trim(),
          address: _address.text.trim(),
        );
    if (!mounted) return;
    setState(() => _saving = false);
    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profil berhasil diperbarui')));
    Navigator.of(context).pop();
  }

  static const _fieldStyle = TextStyle(color: FieldCollectorColors.onSurface, fontSize: 16);

  @override
  Widget build(BuildContext context) {
    const bg = Color(0xFFF8F9FA);
    final light = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.fromSeed(
        seedColor: FieldCollectorColors.primaryContainer,
        brightness: Brightness.light,
      ).copyWith(
        surface: Colors.white,
        onSurface: FieldCollectorColors.onSurface,
        onSurfaceVariant: FieldCollectorColors.onSurfaceVariant,
      ),
      scaffoldBackgroundColor: bg,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        labelStyle: const TextStyle(color: FieldCollectorColors.onSurfaceVariant, fontSize: 14),
        hintStyle: TextStyle(color: FieldCollectorColors.onSurfaceVariant.withValues(alpha: 0.85), fontSize: 14),
        floatingLabelStyle: const TextStyle(color: FieldCollectorColors.primaryContainer, fontWeight: FontWeight.w600),
      ),
    );

    return Theme(
      data: light,
      child: Scaffold(
        backgroundColor: bg,
        appBar: AppBar(
          backgroundColor: Colors.white,
          foregroundColor: FieldCollectorColors.primaryContainer,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          title: const Text(
            'Pengaturan akun',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 18,
              color: FieldCollectorColors.onSurface,
            ),
          ),
          iconTheme: const IconThemeData(color: FieldCollectorColors.primaryContainer),
          bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1)),
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _name,
                  style: _fieldStyle,
                  textCapitalization: TextCapitalization.words,
                  decoration: _decoration('Nama lengkap', hint: 'Nama Anda'),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Nama wajib diisi';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _address,
                  style: _fieldStyle,
                  maxLines: 3,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: _decoration('Alamat', hint: 'Alamat lengkap'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _email,
                  style: _fieldStyle,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  decoration: _decoration('Email', hint: 'nama@email.com'),
                  validator: (v) {
                    final t = v?.trim() ?? '';
                    if (t.isEmpty) return null;
                    if (!t.contains('@')) return 'Format email tidak valid';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _phone,
                  style: _fieldStyle,
                  keyboardType: TextInputType.phone,
                  decoration: _decoration('Nomor HP', hint: '08…'),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Nomor HP wajib diisi';
                    return null;
                  },
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  style: FilledButton.styleFrom(
                    backgroundColor: FieldCollectorColors.primaryContainer,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: _saving
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Simpan perubahan'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _decoration(String label, {String? hint}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      filled: true,
      fillColor: Colors.white,
      floatingLabelBehavior: FloatingLabelBehavior.auto,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: FieldCollectorColors.outlineVariant),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: FieldCollectorColors.primaryContainer, width: 1.5),
      ),
    );
  }
}
