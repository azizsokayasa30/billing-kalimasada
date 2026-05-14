import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';

function statusLabel(ds) {
  if (ds === 'lunas') return 'Lunas';
  if (ds === 'overdue') return 'Jatuh tempo lewat';
  if (ds === 'belum_bayar') return 'Belum bayar';
  return ds ? String(ds).replace(/_/g, ' ') : '—';
}

function isInvoicePaid(inv) {
  if (!inv) return false;
  if (inv.display_status === 'lunas') return true;
  return String(inv.status || '').toLowerCase().trim() === 'paid';
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [payInfo, setPayInfo] = useState(null);
  const [payErr, setPayErr] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  useEffect(() => {
    setData(null);
    setErr('');
    setPayInfo(null);
    setPayErr('');
    api.get(`/invoices/${id}`).then((r) => {
      if (r.data.success) setData(r.data);
      else setErr(r.data.message || 'Gagal');
    }).catch((e) => setErr(e.response?.data?.message || 'Gagal memuat'));
  }, [id]);

  const loadPayOptions = useCallback(() => {
    if (!id) return;
    setPayErr('');
    api.get(`/invoices/${id}/payment-options`).then((r) => {
      if (r.data.success) setPayInfo(r.data);
      else setPayErr(r.data.message || 'Gagal memuat opsi bayar');
    }).catch((e) => setPayErr(e.response?.data?.message || 'Gagal memuat opsi bayar'));
  }, [id]);

  useEffect(() => {
    if (!data?.invoice) return;
    if (isInvoicePaid(data.invoice)) {
      setPayInfo({ already_paid: true, gateways: [] });
      return;
    }
    loadPayOptions();
  }, [data, loadPayOptions]);

  const startCheckout = async (gatewayId) => {
    if (!gatewayId || checkoutBusy) return;
    setCheckoutBusy(true);
    setPayErr('');
    try {
      const r = await api.post(`/invoices/${id}/checkout`, { gateway: gatewayId });
      if (!r.data.success) {
        setPayErr(r.data.message || 'Gagal membuat pembayaran');
        setCheckoutBusy(false);
        return;
      }
      const url = r.data.payment_url;
      if (url) {
        window.location.href = url;
        return;
      }
      setPayErr('URL pembayaran tidak tersedia. Hubungi admin.');
    } catch (e) {
      setPayErr(e.response?.data?.message || e.message || 'Gagal membuat pembayaran');
    } finally {
      setCheckoutBusy(false);
    }
  };

  if (err) {
    return (
      <div className="space-y-4">
        <Link to="/tagihan" className="text-sm font-semibold text-sky-700">← Kembali</Link>
        <p className="text-rose-700 text-sm bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">{err}</p>
      </div>
    );
  }
  if (!data) return <p className="text-slate-500 py-4">Memuat…</p>;

  const inv = data.invoice;
  const paid = isInvoicePaid(inv);
  const gateways = payInfo?.gateways || [];
  const hasGateways = gateways.length > 0;

  return (
    <div className="max-w-lg space-y-5">
      <Link to="/tagihan" className="text-sm font-semibold text-sky-700 inline-block">← Kembali ke daftar</Link>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Invoice</p>
          <p className="text-xl font-mono font-bold text-slate-900 mt-1">{inv.invoice_number}</p>
        </div>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4 py-1 border-b border-slate-100">
            <dt className="text-slate-500">Status</dt>
            <dd className="text-slate-900 font-semibold">{statusLabel(inv.display_status)}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1 border-b border-slate-100">
            <dt className="text-slate-500">Jumlah</dt>
            <dd className="text-slate-900 font-bold">Rp {Number(inv.amount || 0).toLocaleString('id-ID')}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1 border-b border-slate-100">
            <dt className="text-slate-500">Jatuh tempo</dt>
            <dd className="text-slate-900 font-medium">{inv.due_date || '-'}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1">
            <dt className="text-slate-500">Dibuat</dt>
            <dd className="text-slate-900 font-medium">{inv.created_at?.slice(0, 19)?.replace('T', ' ') || '-'}</dd>
          </div>
        </dl>
        {data.pdf_hint && (
          <p className="text-xs text-slate-500 border-t border-slate-100 pt-4 leading-relaxed">{data.pdf_hint}</p>
        )}
      </div>

      {!paid && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Bayar tagihan</h3>
          <p className="text-sm text-slate-600">
            Pilih penyedia pembayaran. Anda akan diarahkan ke halaman pembayaran resmi (VA, QRIS, kartu, e-wallet, dll.) sesuai pengaturan ISP.
          </p>
          {payErr && (
            <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{payErr}</p>
          )}
          {!payInfo && (
            <p className="text-sm text-slate-500">Memuat opsi pembayaran…</p>
          )}
          {payInfo && payInfo.already_paid && (
            <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">Tagihan ini sudah lunas.</p>
          )}
          {payInfo && !payInfo.already_paid && !hasGateways && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Pembayaran online belum diaktifkan. Silakan hubungi layanan pelanggan untuk transfer manual atau aktivasi gateway.
            </p>
          )}
          {payInfo && !payInfo.already_paid && hasGateways && (
            <div className="space-y-2">
              {gateways.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={checkoutBusy}
                  onClick={() => startCheckout(g.id)}
                  className={`w-full text-left rounded-xl border px-4 py-3.5 transition active:scale-[0.99] ${
                    g.is_default
                      ? 'border-sky-400 bg-sky-50 text-slate-900 ring-1 ring-sky-200'
                      : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-900'
                  } disabled:opacity-50`}
                >
                  <span className="block font-bold text-sm">{g.name}</span>
                  {g.is_default && (
                    <span className="text-[11px] font-semibold text-sky-700">Disarankan</span>
                  )}
                </button>
              ))}
              {checkoutBusy && (
                <p className="text-xs text-slate-500 text-center pt-1">Menghubungkan ke pembayaran…</p>
              )}
            </div>
          )}
        </div>
      )}

      {paid && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 font-medium text-center">
          Tagihan sudah lunas. Terima kasih.
        </div>
      )}
    </div>
  );
}
