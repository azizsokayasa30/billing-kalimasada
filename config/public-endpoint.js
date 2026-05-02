'use strict';

const { getSetting } = require('./settingsManager');

function trimTrailingSlashes(s) {
  return String(s || '').replace(/\/+$/, '');
}

/**
 * URL dasar aplikasi untuk klien eksternal (Android, callback, deeplink).
 * Prioritas: PUBLIC_APP_BASE_URL / PUBLIC_API_BASE_URL → PUBLIC_APP_* terpisah → server_host + server_port (settings.json).
 * @returns {string} Tanpa slash di akhir
 */
function getPublicAppBaseUrl() {
  const direct = trimTrailingSlashes(
    process.env.PUBLIC_APP_BASE_URL || process.env.PUBLIC_API_BASE_URL || ''
  );
  if (direct) {
    if (!/^https?:\/\//i.test(direct)) {
      return trimTrailingSlashes(`http://${direct.replace(/^\/+/, '')}`);
    }
    return direct;
  }

  let scheme = (process.env.PUBLIC_APP_SCHEME || 'http').toLowerCase().replace(/:?\/?$/, '');
  if (scheme !== 'https') scheme = 'http';

  const host =
    (process.env.PUBLIC_APP_HOST || '').trim() ||
    String(getSetting('server_host', 'localhost') || 'localhost').trim();

  const rawPort =
    (process.env.PUBLIC_APP_PORT || '').trim() ||
    String(getSetting('server_port', '') || '').trim();

  const portNum = parseInt(rawPort, 10);
  const omitPort =
    !rawPort ||
    Number.isNaN(portNum) ||
    (scheme === 'http' && portNum === 80) ||
    (scheme === 'https' && portNum === 443);
  const portSuffix = omitPort ? '' : `:${rawPort}`;

  return trimTrailingSlashes(`${scheme}://${host}${portSuffix}`);
}

/**
 * Objek aman untuk dikirim ke klien (tanpa rahasia).
 */
function getPublicEndpointConfig() {
  const publicAppBaseUrl = getPublicAppBaseUrl();
  let scheme = 'http';
  let host = '';
  let port = '';
  try {
    const u = new URL(publicAppBaseUrl);
    scheme = u.protocol.replace(':', '') || 'http';
    host = u.hostname || '';
    port = u.port || (scheme === 'https' ? '443' : '80');
  } catch (_) {
    host = publicAppBaseUrl;
    port = '';
  }
  return {
    publicAppBaseUrl,
    scheme,
    host,
    port: String(port),
    apiBasePath: '/api',
    authLoginPath: '/api/auth/login',
    dataAccessNote:
      'SQLite billing hanya di server; aplikasi Android harus memakai REST API (base URL di atas), bukan koneksi langsung ke file database.',
  };
}

module.exports = {
  getPublicAppBaseUrl,
  getPublicEndpointConfig,
};
