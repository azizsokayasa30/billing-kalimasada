import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package as PkgIcon,
  ChevronDown,
  Send,
  Loader2,
  Sparkles,
} from 'lucide-react';
import api from '../api/client';

const FALLBACK_RECOMMENDATIONS = [
  { id: 'rec_10', name: 'PAKET 10MBPS', speed: '10 MBPS', price_label: 'Rp 100.000', price_rupiah: 100000 },
  { id: 'rec_20', name: 'PAKET 20MBPS', speed: '20 MBPS', price_label: 'Rp 150.000', price_rupiah: 150000 },
  { id: 'rec_30', name: 'PAKET 30MBPS', speed: '30 MBPS', price_label: 'Rp 200.000', price_rupiah: 200000 },
  { id: 'rec_40', name: 'PAKET 40MBPS', speed: '40 MBPS', price_label: 'Rp 300.000', price_rupiah: 300000 },
  { id: 'rec_50', name: 'PAKET 50MBPS', speed: '50 MBPS', price_label: 'Rp 350.000', price_rupiah: 350000 },
];

export default function Paket() {
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [noteModal, setNoteModal] = useState(null);
  const [noteText, setNoteText] = useState('');
  const rekomRef = useRef(null);

  useEffect(() => {
    api.get('/package').then((r) => setData(r.data)).catch(() => setData({ success: false }));
  }, []);

  const scrollToRekomendasi = () => {
    rekomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submitPackageRequest = async (rec) => {
    setBusyId(rec.id);
    setMsg({ type: '', text: '' });
    try {
      const { data: res } = await api.post('/package-change-request', {
        recommendation_id: rec.id,
        note: noteText.trim() || undefined,
      });
      if (res?.success) {
        setMsg({ type: 'ok', text: res.message || 'Permintaan terkirim ke admin.' });
        setNoteModal(null);
        setNoteText('');
      } else {
        setMsg({ type: 'err', text: res?.message || 'Gagal mengirim.' });
      }
    } catch (e) {
      setMsg({
        type: 'err',
        text: e.response?.data?.message || 'Gagal mengirim permintaan.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const openRequestModal = (rec) => {
    setNoteText('');
    setNoteModal(rec);
  };

  if (!data?.success) {
    return <p className="text-slate-500 text-sm py-4">Memuat paket…</p>;
  }

  const { package: pkg, customer_snapshot, recommendations } = data;
  const rekom = Array.isArray(recommendations) && recommendations.length ? recommendations : FALLBACK_RECOMMENDATIONS;

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Paket internet</h2>

      {msg.text ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            msg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {msg.text}
        </div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"
      >
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-100 flex items-center justify-center border border-sky-200 shrink-0">
            <PkgIcon className="w-7 h-7 text-sky-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-sky-600 uppercase tracking-wide leading-snug">
              Paket yang anda gunakan saat ini
            </p>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              {pkg?.name || customer_snapshot?.package_name || '-'}
            </h3>
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
              <div>
                <dt className="text-slate-500 text-xs font-medium">Kecepatan</dt>
                <dd className="text-slate-900 font-semibold mt-0.5">
                  {pkg?.speed || customer_snapshot?.package_speed || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs font-medium">Harga</dt>
                <dd className="text-slate-900 font-semibold mt-0.5">
                  {customer_snapshot?.package_price != null
                    ? `Rp ${Number(customer_snapshot.package_price).toLocaleString('id-ID')}`
                    : pkg?.price != null
                      ? `Rp ${Number(pkg.price).toLocaleString('id-ID')}`
                      : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs font-medium">Status layanan</dt>
                <dd className="text-sky-700 font-bold mt-0.5 capitalize">{customer_snapshot?.status || '-'}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs font-medium">Bergabung</dt>
                <dd className="text-slate-900 font-semibold mt-0.5">
                  {customer_snapshot?.join_date?.slice(0, 10) || '-'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={scrollToRekomendasi}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 text-white font-semibold text-sm px-4 py-3 shadow-sm hover:bg-sky-700 active:bg-sky-800 transition-colors touch-target"
          >
            <ChevronDown className="w-4 h-4 shrink-0" strokeWidth={2.5} />
            Ubah paket
          </button>
          <p className="text-xs text-slate-600 leading-relaxed sm:flex-1">
            Pilih salah satu paket rekomendasi di bawah untuk mengajukan upgrade atau downgrade. Permintaan Anda akan
            tampil di dashboard admin.
          </p>
        </div>
      </motion.div>

      <section id="rekomendasi-paket" ref={rekomRef} className="scroll-mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-amber-500 shrink-0" strokeWidth={2} />
          <h3 className="text-lg font-bold text-slate-900">Rekomendasi paket</h3>
        </div>
        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          Bandingkan kecepatan dan harga, lalu kirim permintaan ke tim kami.
        </p>
        <ul className="space-y-3">
          {rekom.map((rec, i) => (
            <motion.li
              key={rec.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.25) }}
              className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900">{rec.name}</p>
                <p className="text-sm text-slate-600 mt-0.5">{rec.speed}</p>
                <p className="text-base font-bold text-sky-700 mt-2 tabular-nums">
                  {rec.price_label || (rec.price_rupiah != null ? `Rp ${Number(rec.price_rupiah).toLocaleString('id-ID')}` : '-')}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId != null}
                onClick={() => openRequestModal(rec)}
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 text-sky-800 font-semibold text-sm px-4 py-2.5 hover:bg-sky-100 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                {busyId === rec.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Ajukan paket ini
              </button>
            </motion.li>
          ))}
        </ul>
      </section>

      {noteModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pkg-req-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl p-5 sm:p-6"
          >
            <h4 id="pkg-req-title" className="text-lg font-bold text-slate-900">
              Ajukan {noteModal.name}
            </h4>
            <p className="text-sm text-slate-600 mt-1">
              {noteModal.speed} · {noteModal.price_label || `Rp ${Number(noteModal.price_rupiah).toLocaleString('id-ID')}`}
            </p>
            <label className="block mt-4 text-sm font-semibold text-slate-700" htmlFor="pkg-note">
              Catatan untuk admin (opsional)
            </label>
            <textarea
              id="pkg-note"
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              maxLength={500}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none resize-y min-h-[5rem]"
              placeholder="Contoh: ingin aktif tanggal 1 depan, atau tanya prorata."
            />
            <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setNoteModal(null);
                  setNoteText('');
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busyId != null}
                onClick={() => submitPackageRequest(noteModal)}
                className="rounded-xl bg-sky-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {busyId === noteModal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Kirim permintaan
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
