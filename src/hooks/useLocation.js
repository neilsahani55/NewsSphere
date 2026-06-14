// Shared location hook — calls ipapi.co once, caches in localStorage 30 min.
// All widgets (weather, AQI, fuel) use this so there's only one network call.

const CACHE_KEY = 'ns_location_v3';
const CACHE_TTL = 30 * 60 * 1000;

export const INDIA_DEFAULT = { lat: 28.6139, lon: 77.209, city: 'New Delhi', region: 'Delhi' };

function normalizeLocation(data) {
  const city = String(data?.city || '').trim();
  const region = String(data?.region || '').trim();
  const lat = Number.isFinite(Number(data?.lat)) ? Number(data.lat) : INDIA_DEFAULT.lat;
  const lon = Number.isFinite(Number(data?.lon)) ? Number(data.lon) : INDIA_DEFAULT.lon;

  return {
    lat,
    lon,
    city: city || INDIA_DEFAULT.city,
    region: region || INDIA_DEFAULT.region,
  };
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return Date.now() - ts > CACHE_TTL ? null : normalizeLocation(data);
  } catch { return null; }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: normalizeLocation(data) })); } catch {}
}

// Module-level promise so concurrent callers share one in-flight request
let _pending = null;

export async function fetchLocation() {
  const cached = readCache();
  if (cached) return cached;

  if (!_pending) {
    _pending = fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        _pending = null;
        if (!j || j.error) return INDIA_DEFAULT;
        const loc = normalizeLocation({
          lat:    j.latitude  ?? INDIA_DEFAULT.lat,
          lon:    j.longitude ?? INDIA_DEFAULT.lon,
          city:   j.city      || INDIA_DEFAULT.city,
          region: j.region    || INDIA_DEFAULT.region,
        });
        writeCache(loc);
        return loc;
      })
      .catch(() => { _pending = null; return INDIA_DEFAULT; });
  }

  return _pending;
}

import { useEffect, useState } from 'react';

export function useLocation() {
  const [loc, setLoc] = useState(() => readCache() ?? INDIA_DEFAULT);
  useEffect(() => {
    let live = true;
    fetchLocation().then(l => { if (live) setLoc(l); });
    return () => { live = false; };
  }, []);
  return loc;
}
