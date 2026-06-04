// Shared location hook — calls ipapi.co once, caches in localStorage 30 min.
// All widgets (weather, AQI, fuel) use this so there's only one network call.

const CACHE_KEY = 'ns_location_v2';
const CACHE_TTL = 30 * 60 * 1000;

export const INDIA_DEFAULT = { lat: 28.6139, lon: 77.209, city: 'Delhi', region: 'Delhi' };

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return Date.now() - ts > CACHE_TTL ? null : data;
  } catch { return null; }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
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
        const loc = {
          lat:    j.latitude  ?? INDIA_DEFAULT.lat,
          lon:    j.longitude ?? INDIA_DEFAULT.lon,
          city:   j.city      || INDIA_DEFAULT.city,
          region: j.region    || INDIA_DEFAULT.region,
        };
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
