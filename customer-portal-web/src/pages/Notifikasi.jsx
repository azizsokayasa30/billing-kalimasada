import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Megaphone,
  Receipt,
  CreditCard,
  AlertTriangle,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import api from '../api/client';
import { markNotificationsRead } from '../hooks/usePortalNotifications';

function typeIcon(type) {
  switch (type) {
    case 'announcement':
      return Megaphone;
    case 'payment':
      return CreditCard;
    case 'billing':
      return Receipt;
    case 'outage':
      return AlertTriangle;
    case 'handling':
      return Wrench;
    case 'resolved':
      return CheckCircle2;
    default:
      return Bell;
  }
}

function typeTone(type) {
  switch (type) {
    case 'announcement':
      return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case 'payment':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'billing':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'outage':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'handling':
      return 'bg-sky-100 text-sky-700 border-sky-200';
    case 'resolved':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function categoryLabel(cat) {
  const m = {
    informasi: 'Informasi',
    tagihan: 'Tagihan',
    pembayaran: 'Pembayaran',
    gangguan: 'Gangguan',
    penanganan: 'Penanganan',
  };
  return m[cat] || cat || 'Umum';
}

export default function Notifikasi() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    markNotificationsRead();
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/notifications')
      .then((r) => {
        if (cancelled) return;
        if (r.data?.success) setItems(r.data.items || []);
        else setErr(r.data?.message || 'Gagal memuat');
      })
      .catch((e) => {
        if (!cancelled) setErr(e.response?.data?.message || 'Gagal memuat notifikasi');
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Notifikasi</h2>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
          Pemberitahuan tagihan, pembayaran, laporan gangguan, dan informasi dari kantor — diurut dari yang terbaru.
        </p>
      </div>

      {err && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {err}
        </div>
      )}

      <ul className="space-y-3">
        {items.map((n, i) => {
          const Icon = typeIcon(n.type);
          const tone = typeTone(n.type);
          return (
            <motion.li
              key={n.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
              className="rounded-2xl border border-slate-200 bg-white p-4 flex gap-3 shadow-sm"
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${tone}`}
              >
                <Icon className="w-5 h-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <p className="font-bold text-slate-900 leading-snug">{n.title}</p>
                  {n.category ? (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      {categoryLabel(n.category)}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed whitespace-pre-wrap break-words">
                  {n.body}
                </p>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  {new Date(n.created_at).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ul>

      {!err && items.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-6 px-2">
          Belum ada notifikasi. Setelah ada tagihan, pembayaran, laporan gangguan, atau pengumuman admin, akan tampil di sini.
        </p>
      )}
    </div>
  );
}
