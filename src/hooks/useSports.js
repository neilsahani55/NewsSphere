/**
 * Live sports scores across multiple disciplines.
 * Calls /api/sports (Vercel function) which fetches from ESPN server-side.
 * Cached 3 minutes in sessionStorage.
 */

import { useEffect, useState } from 'react';

const CACHE_KEY = 'ns_sports_v3';
const CACHE_TTL = 3 * 60 * 1000;

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

const EMPTY = { matches: [], live: [], upcoming: [], completed: [], counts: {} };

export function useSports() {
  const [matches, setMatches] = useState(null);
  const [counts, setCounts]   = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;

    async function load() {
      const cached = readCache();
      if (cached) { setMatches(cached); setCounts(cached.counts ?? {}); setLoading(false); return; }

      try {
        const res = await fetch('/api/sports', { signal: AbortSignal.timeout(12000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data = {
          matches:   json.matches   ?? [],
          live:      json.live      ?? [],
          upcoming:  json.upcoming  ?? [],
          completed: json.completed ?? [],
          counts:    json.counts    ?? {},
        };
        writeCache(data);
        if (live) { setMatches(data); setCounts(data.counts); setLoading(false); }
      } catch {
        if (live) { setMatches([]); setLoading(false); }
      }
    }

    load();
    const timer = setInterval(() => { sessionStorage.removeItem(CACHE_KEY); load(); }, CACHE_TTL);
    return () => { live = false; clearInterval(timer); };
  }, []);

  const data = matches ?? EMPTY;

  return {
    matches:   data.matches,
    live:      data.live,
    upcoming:  data.upcoming,
    completed: data.completed,
    counts,
    loading,
  };
}
