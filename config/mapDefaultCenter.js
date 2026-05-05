/**
 * Titik awal peta: settings.json (manual / cache geocode alamat perusahaan), fallback Jakarta.
 *
 * Prioritas:
 * 1) map_default_latitude + map_default_longitude (+ map_default_zoom)
 * 2) Cache geocode: map_center_geocoded_* (dari contact_address / company_address / payment_cash_address)
 * 3) Geocode Nominatim sekali lalu simpan cache
 * 4) Jakarta (legacy default)
 */
const https = require('https');
const { URL } = require('url');
const { getSetting, setSetting } = require('./settingsManager');

const JAKARTA = { lat: -6.2088, lng: 106.8456, zoom: 13 };

function parseFloatSetting(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

function parseZoom(v, fallback = 13) {
  const z = parseInt(String(v ?? ''), 10);
  if (Number.isInteger(z) && z >= 2 && z <= 19) return z;
  return fallback;
}

function getCompanyAddressForGeocode() {
  const order = ['contact_address', 'company_address', 'payment_cash_address'];
  for (const key of order) {
    const s = String(getSetting(key, '') || '').trim();
    if (s) return s;
  }
  return '';
}

/** Sinkron: tidak memanggil jaringan. */
function getSyncDefaultMapCenter() {
  const lat = parseFloatSetting(getSetting('map_default_latitude', null));
  const lng = parseFloatSetting(getSetting('map_default_longitude', null));
  const zoom = parseZoom(getSetting('map_default_zoom', '13'), 13);
  if (lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return { lat, lng, zoom, source: 'explicit' };
  }

  const glat = parseFloatSetting(getSetting('map_center_geocoded_lat', null));
  const glng = parseFloatSetting(getSetting('map_center_geocoded_lng', null));
  const gzoom = parseZoom(getSetting('map_center_geocoded_zoom', '13'), 13);
  if (glat != null && glng != null && Math.abs(glat) <= 90 && Math.abs(glng) <= 180) {
    return { lat: glat, lng: glng, zoom: gzoom, source: 'geocoded' };
  }

  return { ...JAKARTA, source: 'jakarta' };
}

function geocodeNominatim(query) {
  return new Promise((resolve) => {
    const base = String(query || '').trim();
    if (!base) {
      resolve(null);
      return;
    }
    const q = `${base.replace(/\s+/g, ' ')}, Indonesia`;
    const u = new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('format', 'json');
    u.searchParams.set('q', q);
    u.searchParams.set('limit', '1');

    const req = https.get(
      u.toString(),
      {
        headers: {
          'User-Agent': 'GembokBill/2.1 (map-default-center)',
          Accept: 'application/json',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve(null);
            return;
          }
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr[0] && arr[0].lat && arr[0].lon) {
              resolve({ lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) });
            } else resolve(null);
          } catch (_) {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => {
      try {
        req.destroy();
      } catch (_) {
        /* ignore */
      }
      resolve(null);
    });
  });
}

let geocodeInFlight = null;

/**
 * Pastikan cache geocode ada bila belum ada koordinat eksplisit; aman dipanggil per request mapping.
 */
async function ensureMapCenterFromCompanyAddress() {
  const explicitLat = parseFloatSetting(getSetting('map_default_latitude', null));
  const explicitLng = parseFloatSetting(getSetting('map_default_longitude', null));
  if (explicitLat != null && explicitLng != null) {
    return getSyncDefaultMapCenter();
  }

  if (parseFloatSetting(getSetting('map_center_geocoded_lat', null)) != null &&
      parseFloatSetting(getSetting('map_center_geocoded_lng', null)) != null) {
    return getSyncDefaultMapCenter();
  }

  const addr = getCompanyAddressForGeocode();
  if (!addr) {
    return getSyncDefaultMapCenter();
  }

  if (geocodeInFlight) {
    return geocodeInFlight;
  }

  geocodeInFlight = (async () => {
    try {
      const coords = await geocodeNominatim(addr);
      if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
        setSetting('map_center_geocoded_lat', coords.lat);
        setSetting('map_center_geocoded_lng', coords.lng);
        setSetting('map_center_geocoded_zoom', '13');
        setSetting('map_center_geocoded_query', addr.slice(0, 240));
        setSetting('map_center_geocoded_at', new Date().toISOString());
      }
    } catch (_) {
      /* geocode opsional */
    } finally {
      geocodeInFlight = null;
    }
    return getSyncDefaultMapCenter();
  })();

  return geocodeInFlight;
}

module.exports = {
  JAKARTA,
  getSyncDefaultMapCenter,
  getCompanyAddressForGeocode,
  ensureMapCenterFromCompanyAddress,
};
