import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Mail, Phone, User, Pencil, LogOut, ClipboardList, ChevronRight } from 'lucide-react';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';

function FieldModal({ open, title, field, value, onClose, onSave, saving, error }) {
  const [draft, setDraft] = useState(value || '');
  useEffect(() => {
    if (open) setDraft(value || '');
  }, [open, value]);

  if (!open) return null;
  const inputCls =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 focus:ring-2 focus:ring-sky-400/40 focus:border-sky-400';
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40" role="dialog" aria-modal="true">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {error ? <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p> : null}
        {field === 'address' ? (
          <textarea
            className={`${inputCls} min-h-[6rem] sm:min-h-[5rem]`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            autoComplete="street-address"
          />
        ) : (
          <input
            type={field === 'email' ? 'email' : 'tel'}
            className={`${inputCls} min-h-[2.75rem]`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete={field === 'email' ? 'email' : 'tel'}
          />
        )}
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-700 active:bg-slate-50">
            Batal
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(draft)}
            className="px-4 py-2.5 rounded-xl bg-sky-600 text-white font-bold disabled:opacity-50 active:scale-[0.99]"
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function statusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'resolved' || s === 'closed') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (s === 'in_progress') return 'bg-sky-100 text-sky-800 border-sky-200';
  return 'bg-amber-100 text-amber-900 border-amber-200';
}

export default function Profil() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.token);
  const customer = useAuthStore((s) => s.customer);

  const loaded = useRef(false);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsErr, setTicketsErr] = useState('');

  useEffect(() => {
    if (!token || loaded.current) return;
    loaded.current = true;
    api.get('/auth/me').then((r) => {
      if (r.data.success && r.data.customer) {
        setSession(token, r.data.customer);
      }
    }).catch(() => {});
  }, [token, setSession]);

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    setTicketsLoading(true);
    setTicketsErr('');
    api
      .get('/tickets')
      .then((r) => {
        if (cancelled || !r.data?.success) return;
        setTickets(Array.isArray(r.data.tickets) ? r.data.tickets : []);
      })
      .catch((e) => {
        if (!cancelled) setTicketsErr(e.response?.data?.message || 'Gagal memuat riwayat');
      })
      .finally(() => {
        if (!cancelled) setTicketsLoading(false);
      });
    return () => { cancelled = true; };
  }, [customer?.phone, customer?.id]);

  const saveField = async (field, value) => {
    setSaving(true);
    setFormErr('');
    try {
      const body = { [field]: value };
      const { data } = await api.patch('/profile', body);
      if (!data.success) {
        setFormErr(data.message || 'Gagal menyimpan');
        setSaving(false);
        return;
      }
      setSession(token, data.customer);
      setModal(null);
    } catch (e) {
      setFormErr(e.response?.data?.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!customer) {
    return (
      <div className="max-w-xl mx-auto w-full min-h-[50vh] flex items-center justify-center rounded-2xl border border-slate-200 bg-white/80 px-4 py-12 text-slate-500">
        Memuat profil…
      </div>
    );
  }

  const row = (Icon, label, value, field) => (
    <div className="p-4 sm:p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-slate-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-slate-900 font-semibold mt-1 break-words">{value || '—'}</p>
      </div>
      {field ? (
        <button
          type="button"
          onClick={() => { setFormErr(''); setModal({ field, title: `Edit ${label}`, value: value || '' }); }}
          className="shrink-0 touch-target flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 text-sky-700 bg-white shadow-sm active:bg-sky-50"
          aria-label={`Edit ${label}`}
        >
          <Pencil className="w-5 h-5" />
        </button>
      ) : null}
    </div>
  );

  const formatWhen = (a, b) => {
    const raw = b || a;
    if (!raw) return '—';
    try {
      return new Date(raw).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return String(raw).slice(0, 16);
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full flex flex-col gap-4 sm:gap-5 pb-6">
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-md shadow-slate-200/40 overflow-hidden flex flex-col">
        <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-100 bg-gradient-to-br from-sky-50/80 to-white">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Profil</h2>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            Ringkasan data pelanggan; ubah telepon, email, dan alamat dengan tombol edit.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {row(User, 'Nama', customer.name, null)}
          {row(Phone, 'Telepon', customer.phone, 'phone')}
          {row(Mail, 'Email', customer.email, 'email')}
          {row(MapPin, 'Alamat', customer.address, 'address')}
        </div>
        {(customer.latitude && customer.longitude) ? (
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <a
              href={`https://www.google.com/maps?q=${customer.latitude},${customer.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold text-sky-700 inline-flex items-center min-h-[2.5rem]"
            >
              Buka lokasi di Google Maps
            </a>
          </div>
        ) : null}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/30">
          <p className="text-xs text-slate-500 leading-relaxed">
            Perubahan telepon, email, dan alamat disimpan ke data billing. Nama diatur oleh admin.
          </p>
        </div>
      </div>

      <div className="rounded-2xl sm:rounded-3xl border border-rose-200/90 bg-white shadow-md shadow-rose-100/30 overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-rose-100 bg-gradient-to-r from-rose-50/90 to-red-50/50 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 text-base">Riwayat lapor gangguan & penanganan</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Laporan yang nomor teleponnya sama dengan profil Anda. Penanganan mengikuti status di pusat.
            </p>
            <Link
              to="/tiket"
              className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-rose-700 hover:text-rose-900"
            >
              Buka halaman lapor gangguan
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
        <div className="px-0">
          {ticketsLoading ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Memuat riwayat…</p>
          ) : ticketsErr ? (
            <p className="px-4 py-6 text-center text-sm text-rose-600">{ticketsErr}</p>
          ) : tickets.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-600 leading-relaxed">
              Belum ada laporan terhubung ke nomor telepon Anda. Pastikan nomor di profil sama dengan saat melapor ke pusat.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[min(22rem,50vh)] overflow-y-auto">
              {tickets.map((t) => (
                <li key={String(t.id)} className="px-4 py-3.5 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-lg border ${statusBadgeClass(t.status)}`}>
                      {t.status_label || t.status}
                    </span>
                    <span className="text-xs text-slate-500 font-medium tabular-nums">
                      {formatWhen(t.created_at, t.updated_at)}
                    </span>
                  </div>
                  {t.category ? (
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">{t.category}</p>
                  ) : null}
                  <p className="text-sm text-slate-800 mt-1 leading-snug break-words">
                    {t.description ? (t.description.length > 200 ? `${t.description.slice(0, 200)}…` : t.description) : '—'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 min-h-[3.25rem] rounded-2xl border-2 border-rose-200 bg-white text-rose-700 font-bold text-sm sm:text-base shadow-sm hover:bg-rose-50 active:bg-rose-100/80 transition-colors"
      >
        <LogOut className="w-5 h-5" strokeWidth={2.25} />
        Keluar dari portal
      </button>

      <FieldModal
        open={Boolean(modal)}
        title={modal?.title || ''}
        field={modal?.field}
        value={modal?.value}
        saving={saving}
        error={formErr}
        onClose={() => { setModal(null); setFormErr(''); }}
        onSave={(draft) => {
          if (!modal?.field) return;
          if (modal.field === 'phone' && !String(draft).trim()) {
            setFormErr('Telepon tidak boleh kosong.');
            return;
          }
          saveField(modal.field, String(draft).trim());
        }}
      />
    </div>
  );
}
