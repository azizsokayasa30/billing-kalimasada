import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Loader2 } from 'lucide-react';
import api, { resolveApiBaseURL } from '../api/client';
import { useAuthStore } from '../store/authStore';

const DOWNLOAD_TEST_MS = 7_000;
const UPLOAD_TEST_MS = 7_000;
const DOWNLOAD_CHUNK_BYTES = 3 * 1024 * 1024;
const UPLOAD_CHUNK_BYTES = 768 * 1024;
const SPEEDOMETER_MAX_MBPS = 150;

function formatMbps(bytes, ms) {
  if (!ms || ms < 1 || !bytes) return '0.00';
  const bits = bytes * 8;
  const seconds = ms / 1000;
  return (bits / seconds / 1_000_000).toFixed(2);
}

function makePortalSpeedtestUrl(path, params = {}) {
  const base = resolveApiBaseURL();
  const url = new URL(`${base}/speedtest/${path.replace(/^\/+/, '')}`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text.slice(0, 120) || `HTTP ${res.status}`);
    }
    return res;
  } finally {
    window.clearTimeout(t);
  }
}

function updateSpeedometer(mbps, setNeedle) {
  if (setNeedle) {
    setNeedle(Math.min(100, (mbps / SPEEDOMETER_MAX_MBPS) * 100));
  }
}

function fillRandomBytes(buf) {
  if (!window.crypto?.getRandomValues) return;
  const maxRandomBytes = 65_536;
  for (let offset = 0; offset < buf.length; offset += maxRandomBytes) {
    window.crypto.getRandomValues(buf.subarray(offset, offset + maxRandomBytes));
  }
}

/** Ping ke server LibreSpeed lewat API portal, buang outlier ringan. */
async function measurePing() {
  const samples = [];
  for (let i = 0; i < 7; i += 1) {
    const t0 = performance.now();
    try {
      await api.get('/speedtest/ping', {
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        params: { _: Date.now() + i },
        timeout: 12_000,
      });
      samples.push(performance.now() - t0);
    } catch {
      await new Promise((r) => setTimeout(r, 40));
    }
  }
  if (!samples.length) {
    throw new Error('Server LibreSpeed tidak dapat dijangkau lewat portal.');
  }
  if (samples.length < 3) {
    const avg = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
    return Math.round(avg);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = sorted.slice(1, -1);
  const avg = mid.reduce((a, b) => a + b, 0) / mid.length;
  return Math.round(Number.isFinite(avg) ? avg : sorted[Math.floor(sorted.length / 2)]);
}

async function fetchBinaryDownload(token, bytes, timeoutMs, onProgress) {
  const res = await fetchWithTimeout(
    makePortalSpeedtestUrl('download', { bytes, _: Date.now() }),
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
    timeoutMs,
  );
  if (!res.body?.getReader) {
    return res.arrayBuffer();
  }

  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      if (onProgress) onProgress(received);
    }
  }

  const out = new Uint8Array(received);
  let offset = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return out.buffer;
}

async function measureDownload(token, { setNeedle, setLiveValue, shouldCancel }) {
  let best = 0;
  let totalBytes = 0;
  let totalMs = 0;
  const startedAt = performance.now();

  while (!shouldCancel?.() && performance.now() - startedAt < DOWNLOAD_TEST_MS) {
    const t0 = performance.now();
    const data = await fetchBinaryDownload(token, DOWNLOAD_CHUNK_BYTES, 120_000, (received) => {
      const elapsed = performance.now() - t0;
      const liveMbps = parseFloat(formatMbps(received, elapsed));
      if (Number.isFinite(liveMbps)) {
        setLiveValue?.(liveMbps.toFixed(2));
        updateSpeedometer(liveMbps, setNeedle);
      }
    });
    const ms = performance.now() - t0;
    const n = data.byteLength || 0;
    totalBytes += n;
    totalMs += ms;
    const mbps = parseFloat(formatMbps(n, ms));
    if (mbps > best) best = mbps;
    if (Number.isFinite(mbps)) {
      setLiveValue?.(mbps.toFixed(2));
      updateSpeedometer(mbps, setNeedle);
    }
  }
  return { peak: best, avg: parseFloat(formatMbps(totalBytes, totalMs)) };
}

async function fetchBinaryUpload(token, body, timeoutMs) {
  await fetchWithTimeout(
    makePortalSpeedtestUrl('upload', { _: Date.now() }),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body,
    },
    timeoutMs,
  );
}

async function measureUpload(token, { setNeedle, setLiveValue, shouldCancel }) {
  const buf = new Uint8Array(UPLOAD_CHUNK_BYTES);
  fillRandomBytes(buf);

  let best = 0;
  let totalBytes = 0;
  let totalMs = 0;
  const startedAt = performance.now();

  while (!shouldCancel?.() && performance.now() - startedAt < UPLOAD_TEST_MS) {
    const t0 = performance.now();
    await fetchBinaryUpload(token, buf, 120_000);
    const ms = performance.now() - t0;
    totalBytes += buf.byteLength;
    totalMs += ms;
    const mbps = parseFloat(formatMbps(buf.byteLength, ms));
    if (mbps > best) best = mbps;
    if (Number.isFinite(mbps)) {
      setLiveValue?.(mbps.toFixed(2));
      updateSpeedometer(mbps, setNeedle);
    }
  }

  const avg = parseFloat(formatMbps(totalBytes, totalMs));
  return Number.isFinite(best) && best > 0 ? best : avg;
}

export default function Speedtest() {
  const token = useAuthStore((s) => s.token);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('');
  const [pingMs, setPingMs] = useState(null);
  const [down, setDown] = useState(null);
  const [up, setUp] = useState(null);
  const [needle, setNeedle] = useState(0);
  const [errDetail, setErrDetail] = useState('');
  const cancelRef = useRef(false);

  useEffect(() => () => { cancelRef.current = true; }, []);

  const run = async () => {
    const t = token || useAuthStore.getState().token;
    if (!t) {
      setPhase('error');
      setErrDetail('Sesi habis — silakan login ulang.');
      return;
    }

    cancelRef.current = false;
    setRunning(true);
    setPingMs(null);
    setDown(null);
    setUp(null);
    setNeedle(0);
    setErrDetail('');

    try {
      setPhase('ping');
      const ping = await measurePing();
      if (cancelRef.current) return;
      setPingMs(ping);

      setPhase('download');
      const dl = await measureDownload(t, {
        setNeedle,
        setLiveValue: setDown,
        shouldCancel: () => cancelRef.current,
      });
      if (cancelRef.current) return;
      setDown((dl.peak || dl.avg || 0).toFixed(2));

      setPhase('upload');
      setNeedle(0);
      setUp(null);
      const upVal = await measureUpload(t, {
        setNeedle,
        setLiveValue: setUp,
        shouldCancel: () => cancelRef.current,
      });
      if (cancelRef.current) return;
      setUp(upVal.toFixed(2));

      setPhase('selesai');

      try {
        await api.post('/speedtests', {
          ping_ms: ping,
          download_mbps: parseFloat(dl.peak || dl.avg || 0),
          upload_mbps: parseFloat(upVal || 0),
        });
      } catch { /* ignore */ }
    } catch (e) {
      setPhase('error');
      setPingMs(null);
      setDown(null);
      setUp(null);
      setNeedle(0);
      const msg =
        e?.name === 'AbortError'
          ? 'Waktu habis — koneksi lambat atau server sibuk.'
          : e?.message || 'Permintaan ditolak atau jaringan terputus.';
      setErrDetail(msg);
    } finally {
      setRunning(false);
    }
  };

  const errPhase = phase === 'error';
  const liveSpeed = phase === 'download' ? down : phase === 'upload' ? up : null;

  return (
    <div className="max-w-md mx-auto space-y-8 pb-2">
      <div className="text-center px-1">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Speedtest</h2>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          Mengukur ping, unduh, dan unggah ke <strong>server LibreSpeed ISP Anda</strong>. Hasil bergantung pada Wi‑Fi, perangkat, dan beban jaringan — prinsipnya sama dengan uji kecepatan pada aplikasi seperti Ookla.
        </p>
      </div>

      <div className="relative aspect-square max-w-[280px] sm:max-w-xs mx-auto">
        <div className="absolute inset-0 rounded-full bg-white shadow-inner border border-slate-100 scale-[0.92]" aria-hidden />
        <svg viewBox="0 0 200 200" className="w-full relative z-10 drop-shadow-sm">
          <defs>
            <linearGradient id="arcSp" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="88" fill="none" stroke="#e2e8f0" strokeWidth="12" />
          <motion.circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke="url(#arcSp)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(needle / 100) * 552} 552`}
            transform="rotate(-90 100 100)"
            initial={{ strokeDasharray: '0 552' }}
            animate={{ strokeDasharray: `${(needle / 100) * 552} 552` }}
            transition={{ type: 'spring', stiffness: 80 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20 px-4">
          <AnimatePresence mode="wait">
            {running && phase === 'ping' && (
              <motion.p key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sky-600 text-sm font-semibold text-center">
                Mengukur latensi…
              </motion.p>
            )}
            {running && phase === 'download' && (
              <motion.div key="d" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center">
                <p className="text-sky-600 text-xs font-bold uppercase tracking-wide">Download</p>
                <p className="text-3xl font-black text-sky-600 leading-tight mt-1">{liveSpeed || '0.00'}</p>
                <p className="text-[11px] text-slate-500 font-semibold">Mbps</p>
              </motion.div>
            )}
            {running && phase === 'upload' && (
              <motion.div key="u" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center">
                <p className="text-emerald-600 text-xs font-bold uppercase tracking-wide">Upload</p>
                <p className="text-3xl font-black text-emerald-600 leading-tight mt-1">{liveSpeed || '0.00'}</p>
                <p className="text-[11px] text-slate-500 font-semibold">Mbps</p>
              </motion.div>
            )}
            {!running && phase === 'selesai' && (
              <motion.p key="x" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-600 text-sm font-bold text-center">
                Selesai
              </motion.p>
            )}
            {!running && errPhase && (
              <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-rose-600 text-xs font-semibold text-center leading-snug space-y-1">
                <p>Gagal mengukur.</p>
                {errDetail ? <p className="text-rose-700/90 font-medium normal-case">{errDetail}</p> : null}
              </motion.div>
            )}
            {!running && phase !== 'selesai' && !errPhase && (
              <motion.p key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-slate-500 text-sm font-medium text-center">Tekan mulai</motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Ping</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{pingMs != null ? `${pingMs} ms` : '—'}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Download</p>
          <p className="text-lg font-bold text-sky-600 mt-1">{down != null ? down : '—'}</p>
          <p className="text-[10px] text-slate-400 font-medium">Mbps</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Upload</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{up != null ? up : '—'}</p>
          <p className="text-[10px] text-slate-400 font-medium">Mbps</p>
        </div>
      </div>

      <div className="flex justify-center px-2">
        <button
          type="button"
          disabled={running}
          onClick={run}
          className="inline-flex items-center justify-center gap-2 min-w-[min(100%,14rem)] min-h-[3.25rem] rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-bold px-8 text-base shadow-md shadow-sky-200/80 disabled:opacity-50 active:scale-[0.99] transition-transform"
        >
          {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
          {running ? 'Mengukur…' : 'Mulai'}
        </button>
      </div>
    </div>
  );
}
