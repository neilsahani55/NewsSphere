/**
 * Live cricket scores via our own Vercel serverless function /api/cricket.
 * The function fetches from ESPN server-side (no CORS restrictions).
 * Results cached 3 minutes in sessionStorage.
 */

import { useEffect, useState } from 'react';

const CACHE_KEY = 'ns_cricket_v3';
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return Date.now() - ts > CACHE_TTL ? null : data;
  } catch { return null; }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

export function useCricket() {
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;

    async function load() {
      const cached = readCache();
      if (cached) { setMatches(cached); setLoading(false); return; }

      try {
        // /api/cricket is our Vercel function — fetches ESPN server-side (no CORS)
        const res = await fetch('/api/cricket', { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data = json?.matches ?? [];
        writeCache(data);
        if (live) { setMatches(data); setLoading(false); }
      } catch {
        if (live) { setMatches([]); setLoading(false); }
      }
    }

    load();
    // Refresh every 3 minutes during a live match
    const timer = setInterval(() => {
      sessionStorage.removeItem(CACHE_KEY);
      load();
    }, CACHE_TTL);

    return () => { live = false; clearInterval(timer); };
  }, []);

  const liveMatches     = (matches ?? []).filter(m => m.state === 'in');
  const upcomingMatches = (matches ?? []).filter(m => m.state === 'pre');

  return { liveMatches, upcomingMatches, allMatches: matches ?? [], loading };
}
