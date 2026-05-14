import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Activity, CreditCard, Receipt, Megaphone } from 'lucide-react';
import api from '../api/client';
import Speedtest from './Speedtest';

/** Solid lembut: gradien halus + inset highlight, bukan blok flat */
const TONE_GRADIENT = {
  cyan: 'bg-gradient-to-br from-sky-400 via-sky-500 to-sky-700 shadow-xl shadow-sky-600/20 ring-1 ring-inset ring-white/15',
  amber: 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 shadow-xl shadow-amber-600/25 ring-1 ring-inset ring-white/15',
  slate: 'bg-gradient-to-br from-slate-500 via-slate-600 to-slate-800 shadow-xl shadow-slate-700/25 ring-1 ring-inset ring-white/12',
};

function StatCard({ title, value, sub, footer, icon: Icon, tone, className = '', variant = 'default' }) {
  const t = tone || 'slate';
  const grad = TONE_GRADIENT[t] || TONE_GRADIENT.slate;
  const isHero = variant === 'hero';
  const isCompact = variant === 'compact';

  const shell = isHero
    ? 'rounded-2xl sm:rounded-3xl border border-white/15 p-4 sm:p-5 min-h-[10.5rem] sm:min-h-[12.5rem]'
    : isCompact
      ? 'rounded-xl sm:rounded-3xl border border-white/12 p-3 sm:p-3.5 min-h-0'
      : 'rounded-3xl border border-white/12 p-4 min-h-[7.5rem]';

  const titleCls = isHero
    ? 'text-[11px] sm:text-sm font-bold text-white/90 uppercase tracking-wider'
    : 'text-[10px] sm:text-xs font-semibold text-white/85 uppercase tracking-wide';

  const valueCls = isHero
    ? 'text-xl min-[360px]:text-2xl sm:text-3xl font-extrabold text-white break-words leading-tight tracking-tight'
    : isCompact
      ? 'mt-1 text-[15px] sm:text-[17px] font-bold text-white break-words leading-snug tabular-nums'
      : 'mt-1 text-lg sm:text-xl font-bold text-white break-words';

  const subCls = isHero
    ? 'mt-1 sm:mt-2 text-sm sm:text-base text-white/80'
    : 'mt-1 text-[11px] sm:text-xs text-white/75 leading-snug';

  const iconWrap = isHero
    ? 'w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white/20 text-white backdrop-blur-[2px]'
    : isCompact
      ? 'w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white/14 text-white'
      : 'w-10 h-10 rounded-xl bg-white/15 text-white';

  const iconSz = isHero ? 'w-[18px] h-[18px] sm:w-5 sm:h-5' : isCompact ? 'w-4 h-4 sm:w-[18px] sm:h-[18px]' : 'w-5 h-5';

  if (isHero) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`text-white h-full w-full flex flex-col ${grad} ${shell} ${className}`}
      >
        <div className="flex flex-col h-full min-h-0 justify-between gap-3">
          <div className="flex items-start justify-between gap-2 shrink-0">
            <p className={titleCls}>{title}</p>
            <div className={`shrink-0 flex items-center justify-center ${iconWrap}`}>
              <Icon className={iconSz} strokeWidth={2} />
            </div>
          </div>
          <p className={`${valueCls} min-w-0 flex-1 flex items-center`}>{value}</p>
          {footer ? <div className="shrink-0 space-y-2 pt-0.5">{footer}</div> : null}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`text-white h-full w-full flex flex-col ${grad} ${shell} ${className}`}
    >
      <div className="flex items-start justify-between gap-1.5 sm:gap-2 flex-1">
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <p className={titleCls}>{title}</p>
          <p className={valueCls}>{value}</p>
          {sub ? <p className={subCls}>{sub}</p> : null}
          {footer ? <div className="mt-1 space-y-0.5">{footer}</div> : null}
        </div>
        <div className={`shrink-0 flex items-center justify-center ${iconWrap}`}>
          <Icon className={iconSz} strokeWidth={2.25} />
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { hash } = useLocation();
  const [data, setData] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await api.get('/dashboard/summary');
        if (!cancelled && res.success) setData(res.summary);
      } catch (e) {
        if (!cancelled) setErr(e.response?.data?.message || 'Gagal memuat dashboard');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    api
      .get('/broadcasts', { params: { limit: 6 } })
      .then((r) => {
        if (cancelled || !r.data?.success) return;
        setBroadcasts(r.data.broadcasts || []);
      })
      .catch(() => {
        if (!cancelled) setBroadcasts([]);
      });
    return () => { cancelled = true; };
  }, [data]);

  useEffect(() => {
    if (!data || hash !== '#speedtest') return;
    const timer = window.setTimeout(() => {
      document.getElementById('speedtest')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [data, hash]);

  if (err) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {err}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-52 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-2 gap-2 sm:gap-4 items-stretch">
          <div className="min-w-0 flex flex-col gap-2 sm:gap-3">
            <div className="min-h-[10.5rem] sm:min-h-[12.5rem] bg-slate-100 rounded-2xl sm:rounded-3xl border border-slate-200/80" />
          </div>
          <div className="min-w-0 flex flex-col gap-2 sm:gap-3">
            <div className="flex-1 min-h-0 flex min-h-[4.25rem]">
              <div className="flex-1 bg-slate-100 rounded-xl sm:rounded-3xl border border-slate-200/80" />
            </div>
            <div className="flex-1 min-h-0 flex min-h-[4.25rem]">
              <div className="flex-1 bg-slate-100 rounded-xl sm:rounded-3xl border border-slate-200/80" />
            </div>
          </div>
        </div>
        <div className="h-16 sm:h-[4.5rem] w-full bg-slate-100 rounded-2xl border border-slate-200/80" />
        <div className="h-36 sm:h-40 bg-slate-200 rounded-2xl border border-slate-300/80" />
      </div>
    );
  }

  const { customer, service_status_label, package_name, package_speed, package_price, stats } = data;

  const unpaidCount = stats.unpaid ?? 0;
  const unpaidTotal = Number(stats.unpaid_amount_total ?? 0);
  const unpaidRp = `Rp ${unpaidTotal.toLocaleString('id-ID')}`;
  const totalTagihan = stats.total_invoices ?? 0;

  const priceDisplay =
    package_price != null && !Number.isNaN(Number(package_price))
      ? `Rp ${Number(package_price).toLocaleString('id-ID')}/bulan`
      : '—';

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Halo, {customer?.name || 'Pelanggan'}</h2>
        <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
          ID: <span className="font-mono text-slate-800 font-medium">{customer?.customer_id || customer?.id}</span>
          {' · '}
          Status: <span className="text-sky-700 font-semibold">{service_status_label}</span>
        </p>
        <p className="text-sm text-slate-600 mt-2.5 leading-relaxed max-w-xl">
          Semoga Anda sehat selalu, lancar dan dimudahkan rizqinya 😊
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 items-stretch">
        <div className="min-w-0 flex flex-col gap-2 sm:gap-3">
          <StatCard
            variant="hero"
            title="Paket"
            value={package_name || '-'}
            footer={
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2 text-[13px] sm:text-sm">
                  <span className="text-white/70 font-medium shrink-0 pt-0.5">Kecepatan</span>
                  <span className="font-bold text-white text-right leading-snug tabular-nums min-w-0 flex-1 pl-1">
                    {package_speed || '—'}
                  </span>
                </div>
                <div className="h-px bg-white/20" aria-hidden />
                <div className="flex justify-between items-start gap-2 text-[13px] sm:text-sm">
                  <span className="text-white/70 font-medium shrink-0 pt-0.5">Harga</span>
                  <span className="font-bold text-white text-right leading-snug break-words tabular-nums min-w-0 flex-1 pl-1">
                    {priceDisplay}
                  </span>
                </div>
              </div>
            }
            icon={Activity}
            tone="cyan"
          />
        </div>
        <div className="min-w-0 flex flex-col gap-2 sm:gap-3 min-h-0 self-stretch">
          <div className="flex-1 min-h-0 flex min-h-[4.5rem] sm:min-h-0">
            <StatCard
              variant="compact"
              title="Tagihan lunas"
              value={String(stats.paid)}
              sub={totalTagihan ? `dari ${totalTagihan} total` : 'dari total'}
              icon={Receipt}
              tone="slate"
              className="flex-1"
            />
          </div>
          <div className="flex-1 min-h-0 flex min-h-[4.5rem] sm:min-h-0">
            <StatCard
              variant="compact"
              title="Belum bayar"
              value={unpaidRp}
              sub={unpaidCount === 1 ? '1 belum lunas' : `${unpaidCount} belum lunas`}
              icon={CreditCard}
              tone="amber"
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <Link
        to="/tiket"
        className="flex w-full items-center gap-3 sm:gap-4 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-red-50/90 px-4 py-3.5 sm:px-5 sm:py-4 shadow-sm shadow-rose-100/80 active:scale-[0.99] transition-transform"
      >
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-500/30">
          <Megaphone className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="font-bold text-rose-950 text-sm sm:text-base">Lapor gangguan</p>
          <p className="text-xs sm:text-sm text-rose-800/85 mt-0.5 leading-snug">Lapor gangguan ke admin pusat</p>
        </div>
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-md">
        <div className="px-4 py-3.5 flex justify-between items-center bg-slate-100 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-sky-600 shrink-0" strokeWidth={2} />
            Informasi terbaru
          </h3>
        </div>
        <ul className="divide-y divide-slate-100">
          {broadcasts.length ? (
            broadcasts.map((b) => (
              <li key={b.id} className="px-4 py-3.5 active:bg-slate-50">
                <p className="text-sm font-semibold text-slate-900 leading-snug">{b.title}</p>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed line-clamp-3">{b.body}</p>
                <p className="text-xs text-slate-400 mt-1.5 font-medium">
                  {b.created_at
                    ? new Date(b.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                    : ''}
                </p>
              </li>
            ))
          ) : (
            <li className="px-4 py-8 text-center text-sm text-slate-500 leading-relaxed">
              Belum ada pengumuman dari kantor. Pesan broadcast admin akan tampil di sini.
            </li>
          )}
        </ul>
      </div>

      <section id="speedtest" className="pt-6 sm:pt-8 mt-4 sm:mt-6 border-t border-slate-200">
        <Speedtest />
      </section>
    </div>
  );
}
