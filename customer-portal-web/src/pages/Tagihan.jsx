import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/client';

const FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'paid', label: 'Lunas' },
  { id: 'unpaid', label: 'Belum bayar' },
];

export default function Tagihan() {
  const [payment, setPayment] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/invoices', {
        params: { page, limit: 12, payment: String(payment) },
      });
      if (res.success) setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [payment, page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const pg = data?.pagination;

  const pillClass = (active) =>
    `flex-1 min-w-0 rounded-xl px-3 py-2.5 text-sm font-bold transition active:scale-[0.98] ${
      active ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
    }`;

  return (
    <div className="space-y-5">
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Tagihan & pembayaran</h2>

      <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={pillClass(payment === f.id)}
            onClick={() => {
              setPage(1);
              setPayment(f.id);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="px-4 py-12 text-center text-slate-500 text-sm">Memuat…</div>
          ) : data?.invoices?.length ? (
            data.invoices.map((inv) => {
              const ds = inv.display_status;
              const statusLabel = ds === 'lunas' ? 'Lunas' : ds === 'overdue' ? 'Overdue' : 'Belum bayar';
              const statusClass =
                ds === 'lunas'
                  ? 'bg-emerald-100 text-emerald-800'
                  : ds === 'overdue'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-900';
              return (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-4 py-3.5 active:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-bold text-slate-900 truncate">{inv.invoice_number}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {inv.created_at?.slice(0, 10) || '—'}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <p className="text-base font-bold text-slate-800 tabular-nums">
                      Rp {Number(inv.amount || 0).toLocaleString('id-ID')}
                    </p>
                    <Link
                      to={`/tagihan/${inv.id}`}
                      className="shrink-0 text-sky-700 font-bold text-sm py-1 px-2 -mr-2 rounded-lg active:bg-sky-50"
                    >
                      Detail →
                    </Link>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="px-4 py-12 text-center text-slate-500 text-sm">Tidak ada invoice.</div>
          )}
        </div>
        {pg && pg.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/80">
            <p className="text-xs text-slate-600 font-medium">Halaman {pg.page} / {pg.total_pages}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pg.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="touch-target flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-35 active:bg-slate-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                disabled={pg.page >= pg.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="touch-target flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-35 active:bg-slate-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
