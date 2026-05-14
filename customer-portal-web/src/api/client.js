import axios from 'axios';

/**
 * Base URL API portal pelanggan.
 * - Produksi (dibuild & disajikan dari server billing yang sama): path relatif /api/...
 * - Domain / port beda: set VITE_API_BASE_URL saat build, mis. https://billing.isp.com
 */
export function resolveApiBaseURL() {
  const v = import.meta.env.VITE_API_BASE_URL;
  if (v && String(v).trim()) {
    const origin = String(v).trim().replace(/\/$/, '');
    return `${origin}/api/customer-portal/v1`;
  }
  return '/api/customer-portal/v1';
}

const api = axios.create({
  baseURL: resolveApiBaseURL(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 60_000,
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export default api;
