import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Loader2, CheckCircle2, AlertCircle, MapPin } from 'lucide-react';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';

export default function Tiket() {
  const customer = useAuthStore((s) => s.customer);
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.token);

  const [categories, setCategories] = useState([]);
  const [optsLoading, setOptsLoading] = useState(true);
  const [optsErr, setOptsErr] = useState('');

  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [success, setSuccess] = useState(null);
  const locationPrefilled = useRef(false);

  const loadTickets = useCallback(() => {
    setTicketsLoading(true);
    api
      .get('/tickets')
      .then((r) => {
        if (r.data?.success) setTickets(Array.isArray(r.data.tickets) ? r.data.tickets : []);
      })
      .catch(() => setTickets([]))
      .finally(() => setTicketsLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setOptsLoading(true);
    setOptsErr('');
    api
      .get('/tickets/form-options')
      .then((r) => {
        if (cancelled || !r.data?.success) return;
        const cats = Array.isArray(r.data.categories) ? r.data.categories : [];
        setCategories(cats);
        if (cats.length) setCategory((prev) => (prev && cats.includes(prev) ? prev : cats[0]));
      })
      .catch((e) => {
        if (!cancelled) setOptsErr(e.response?.data?.message || 'Gagal memuat kategori');
      })
      .finally(() => {
        if (!cancelled) setOptsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (!customer?.address || locationPrefilled.current) return;
    setLocation(String(customer.address).trim());
    locationPrefilled.current = true;
  }, [customer?.address, customer?.id]);

  useEffect(() => {
    if (!token) return;
    api.get('/auth/me').then((r) => {
      if (r.data.success && r.data.customer) setSession(token, r.data.customer);
    }).catch(() => {});
  }, [token, setSession]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormErr('');
    setSuccess(null);
    setSubmitting(true);
    try {
      const { data } = await api.post('/tickets', {
        category,
        description: description.trim(),
        location: location.trim(),
      });
      if (!data.success) {
        setFormErr(data.message || 'Gagal mengirim');
        setSubmitting(false);
        return;
      }
      setSuccess(data.message || 'Laporan terkirim.');
      setDescription('');
      loadTickets();
    } catch (err) {
      setFormErr(err.response?.data?.message || 'Gagal mengirim laporan. Periksa koneksi atau coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const phoneOk = Boolean((customer?.phone || '').trim());

  return (
    <div className="max-w-xl mx-auto space-y-5 sm:space-y-6 pb-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Lapor gangguan</h2>
        <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
          Kirim laporan ke pusat — sama dengan modul gangguan billing. Notifikasi ke teknisi/admin mengikuti pengaturan WA sistem (
          <span className="font-medium">trouble_report</span>
          ).
        </p>
      </div>

      {!phoneOk ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3 text-sm text-amber-950">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-700" />
          <p>
            <span className="font-bold">Nomor telepon wajib.</span>
            {' '}
            Isi telepon di
            {' '}
            <Link to="/profil" className="font-bold text-sky-800 underline">Profil</Link>
            {' '}
            agar laporan terhubung ke data Anda dan muncul di riwayat.
          </p>
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-rose-200 bg-white shadow-md shadow-rose-100/40 overflow-hidden"
      >
        <div className="px-4 sm:px-5 py-4 border-b border-rose-100 bg-gradient-to-r from-rose-50 to-red-50/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5" strokeWidth={2.25} />
          </div>
          <p className="font-bold text-slate-900">Formulir laporan</p>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {optsLoading ? (
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memuat kategori…
            </p>
          ) : optsErr ? (
            <p className="text-sm text-rose-600">{optsErr}</p>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex gap-2 text-sm text-emerald-900">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          ) : null}
          {formErr ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{formErr}</div>
          ) : null}

          <div>
            <label htmlFor="tg-cat" className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Kategori masalah
            </label>
            <select
              id="tg-cat"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={optsLoading || !categories.length || !phoneOk}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 font-medium bg-white focus:ring-2 focus:ring-rose-300/50 focus:border-rose-400 disabled:opacity-50"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tg-loc" className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Lokasi / titik pasang (opsional)
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="tg-loc"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={!phoneOk}
                placeholder="Alamat pemasangan atau patokan lokasi"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-slate-900 focus:ring-2 focus:ring-rose-300/50 focus:border-rose-400 disabled:opacity-50"
                maxLength={500}
              />
            </div>
          </div>

          <div>
            <label htmlFor="tg-desc" className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Deskripsi masalah
            </label>
            <textarea
              id="tg-desc"
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!phoneOk}
              placeholder="Jelaskan gejala, kapan mulai, sudah coba restart ONT/router, dll. (minimal 10 karakter)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 focus:ring-2 focus:ring-rose-300/50 focus:border-rose-400 resize-y min-h-[7rem] disabled:opacity-50"
              maxLength={4000}
            />
            <p className="text-[11px] text-slate-500 mt-1">{description.length} / 4000</p>
          </div>

          <button
            type="submit"
            disabled={submitting || !phoneOk || optsLoading || !categories.length}
            className="w-full min-h-[3rem] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm sm:text-base shadow-md shadow-rose-500/25 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Mengirim…
              </>
            ) : (
              'Kirim laporan ke pusat'
            )}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center gap-2">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">Laporan Anda (nomor ini)</h3>
          <Link to="/profil" className="text-xs sm:text-sm font-bold text-sky-700 shrink-0">
            Riwayat di Profil →
          </Link>
        </div>
        {ticketsLoading ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Memuat…</p>
        ) : tickets.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-600 leading-relaxed">
            Belum ada tiket. Setelah mengirim form di atas, laporan muncul di sini dan di halaman Profil.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {tickets.slice(0, 8).map((t) => (
              <li key={String(t.id)} className="px-4 py-3">
                <p className="text-xs font-bold text-rose-700 uppercase">{t.status_label || t.status}</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{t.category || 'Gangguan'}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description || '—'}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link to="/dashboard" className="inline-block text-sm font-semibold text-slate-600 hover:text-slate-900">
        ← Dashboard
      </Link>
    </div>
  );
}
