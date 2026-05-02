import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/colors.dart';
import '../store/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  void _handleLogin() {
    final phone = _phoneController.text.trim();
    final password = _passwordController.text.trim();

    if (phone.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Operator ID dan Passcode tidak boleh kosong'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    context.read<AuthProvider>().login(phone, password);
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    // Colors matching the new updated design
    const bgColor = Color(0xFFF7F9FC);
    const surfaceColor = Color(0xFFFFFFFF);
    const outlineColor = Color(0xFFC6C5D4);
    const outlineVariantColor = Color(0xFFE0E3E6);
    const primaryColor = Color(0xFF000666);
    const primaryContainerColor = Color(0xFF1A237E);
    const textOnSurfaceVariant = Color(0xFF454652);
    const textOnSurface = Color(0xFF191C1E);
    const secondaryColor = Color(0xFF4555B7);

    return Scaffold(
      backgroundColor: bgColor,
      body: Stack(
        children: [
          // Ambient Decorative Elements
          Positioned(
            top: -100,
            left: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                color: const Color(0xFFE0E0FF).withValues(alpha: 0.3),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            bottom: -100,
            right: -100,
            child: Container(
              width: 400,
              height: 400,
              decoration: BoxDecoration(
                color: const Color(0xFFDEE0FF).withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
            ),
          ),
          
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
              child: Container(
                width: double.infinity,
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Header / Logo Area
                    Container(
                      width: 80,
                      height: 80,
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: outlineVariantColor),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.02),
                            offset: const Offset(0, 2),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                      child: Image.network(
                        'https://lh3.googleusercontent.com/aida/ADBb0uigyPo7kYxetK4jpO52xkL5rz9NhnYgbkLaQdmEGtZTRqeOiB5GLIJCLXRdsLMcK14L3KZHpWIxumtbCqUt0LVHWJgZgosS6VjK5iPLigpCnsxSbny3Z-YqTZkLuWqfHhxN5Hhn2a5ddcEQuez0h_FjBimTr_Uz3awl6oZ3o_Z2yxa9lYfnZLJcB0MXw4XCwYynJi7Trqbq1rbDnBPg4OjN8CDMJSGWm2zv0qZPihuMgsOq0o595ptKMefm3APskap46c3K0wewyg',
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) =>
                            const Icon(Icons.router, size: 40, color: primaryColor),
                      ),
                    ),
                    const Text(
                      'Kalimasada Mobile',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: primaryColor,
                        letterSpacing: -0.02,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Portal tim kalimasada',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 16,
                        color: textOnSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Login Card
                    Container(
                      padding: const EdgeInsets.all(32),
                      decoration: BoxDecoration(
                        color: surfaceColor,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: outlineVariantColor),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF1A237E).withValues(alpha: 0.06),
                            offset: const Offset(0, 4),
                            blurRadius: 24,
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (auth.error != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: Text(
                                auth.error!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: AppColors.error),
                              ),
                            ),

                          // Operator ID Input
                          const Text(
                            'Operator ID / Email',
                            style: TextStyle(
                              color: textOnSurface,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 6),
                          TextField(
                            controller: _phoneController,
                            keyboardType: TextInputType.emailAddress,
                            style: const TextStyle(color: textOnSurface, fontSize: 16),
                            decoration: InputDecoration(
                              hintText: 'e.g. OP-8492 or email',
                              hintStyle: TextStyle(color: textOnSurfaceVariant.withValues(alpha: 0.5)),
                              prefixIcon: const Icon(Icons.person, color: textOnSurfaceVariant),
                              filled: true,
                              fillColor: bgColor,
                              contentPadding: const EdgeInsets.symmetric(vertical: 12),
                              enabledBorder: OutlineInputBorder(
                                borderSide: const BorderSide(color: outlineColor),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderSide: const BorderSide(color: primaryColor, width: 2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Password Input
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Password',
                                style: TextStyle(
                                  color: textOnSurface,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              GestureDetector(
                                onTap: () {
                                  // Handle forgot password
                                },
                                child: const Text(
                                  'Lupa diri',
                                  style: TextStyle(
                                    color: secondaryColor,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          TextField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            style: const TextStyle(color: textOnSurface, fontSize: 16),
                            decoration: InputDecoration(
                              hintText: '••••••••',
                              hintStyle: TextStyle(color: textOnSurfaceVariant.withValues(alpha: 0.5)),
                              prefixIcon: const Icon(Icons.lock, color: textOnSurfaceVariant),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword ? Icons.visibility_off : Icons.visibility,
                                  color: textOnSurfaceVariant,
                                ),
                                onPressed: () {
                                  setState(() {
                                    _obscurePassword = !_obscurePassword;
                                  });
                                },
                              ),
                              filled: true,
                              fillColor: bgColor,
                              contentPadding: const EdgeInsets.symmetric(vertical: 12),
                              enabledBorder: OutlineInputBorder(
                                borderSide: const BorderSide(color: outlineColor),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderSide: const BorderSide(color: primaryColor, width: 2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),

                          // Login Button
                          Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              gradient: const LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [primaryColor, primaryContainerColor],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.1),
                                  offset: const Offset(0, 1),
                                  blurRadius: 2,
                                ),
                              ],
                            ),
                            child: ElevatedButton(
                              onPressed: auth.loading ? null : _handleLogin,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.transparent,
                                shadowColor: Colors.transparent,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                              child: auth.loading
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Text(
                                      'LOGIN YUK',
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                        letterSpacing: 0.1,
                                      ),
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 48),

                    // Footer
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECEEF1),
                        borderRadius: BorderRadius.circular(50),
                        border: Border.all(color: outlineVariantColor),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.shield, size: 14, color: secondaryColor),
                          SizedBox(width: 6),
                          Text(
                            'Koneksi aman terenkripsi',
                            style: TextStyle(
                              color: textOnSurfaceVariant,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
