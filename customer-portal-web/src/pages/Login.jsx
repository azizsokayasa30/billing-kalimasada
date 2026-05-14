import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wifi, Loader2 } from 'lucide-react';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) navigate('/dashboard', { replace: true });
  }, [token, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { identifier, password, rememberMe: remember });
      if (!data.success) {
        setError(data.message || 'Login gagal');
        return;
      }
      setSession(data.token, data.customer);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      if (serverMsg) {
        setError(serverMsg);
        return;
      }
      const code = err.code;
      const net =
        code === 'ERR_NETWORK' ||
        code === 'ECONNABORTED' ||
        (err.message && String(err.message).toLowerCase().includes('network'));
      if (net) {
        setError(
          import.meta.env.DEV
            ? 'Tidak terhubung ke API. Jalankan billing di mesin ini (node app.js / npm start), lalu pastikan port sama dengan proxy Vite — default http://127.0.0.1:4555. Atur di akar repo atau customer-portal-web: VITE_PROXY_TARGET=http://127.0.0.1:PORT'
            : 'Tidak terhubung ke server billing. Pastikan aplikasi Node berjalan dan URL /api/customer-portal/v1 dapat dijangkau. Jika portal di-host terpisah, build dengan VITE_API_BASE_URL=https://domain-billing-anda'
        );
        return;
      }
      setError(err.message || 'Permintaan login gagal.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-300 min-h-[3rem]';

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] bg-gradient-to-br from-sky-50 via-white to-emerald-50/40">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shadow-lg shadow-sky-300/50">
            <Wifi className="w-9 h-9 text-white" strokeWidth={2} />
          </div>
          <h1 className="mt-5 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-center">Portal pelanggan</h1>
          <p className="mt-2 text-sm text-slate-600 text-center max-w-sm leading-relaxed">
            Masuk dengan username, nomor layanan, PPPoE, email, atau telepon sesuai data billing.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-soft space-y-4"
        >
          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 leading-snug">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">ID pelanggan</label>
            <input
              className={inputClass}
              placeholder="username / ID layanan / email / telepon"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              inputMode="text"
              enterKeyHint="next"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Password</label>
            <input
              type="password"
              className={inputClass}
              placeholder="Password billing"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              enterKeyHint="go"
            />
          </div>
          <label className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer select-none min-h-[2.75rem]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-5 w-5 rounded-md border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            Ingat saya di perangkat ini
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-semibold py-3.5 text-base shadow-md shadow-sky-200/80 transition min-h-[3.25rem] disabled:opacity-55 active:scale-[0.99]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Masuk
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-slate-500 leading-relaxed px-2">
          Reset password melalui admin atau portal billing yang ada.
        </p>
      </motion.div>
    </div>
  );
}
