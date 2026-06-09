/**
 * Live sports scores across multiple disciplines.
 * Calls /api/sports (Vercel function) which fetches from ESPN server-side.
 * Cached dynamically in sessionStorage.
 */

import { useEffect, useState } from 'react';

const CACHE_KEY = 'ns_sports_v5';
const DEFAULT_TTL = 60 * 1000;
const LIVE_TTL = 20 * 1000;

function ttlForData(data) {
  return (data?.counts?.live ?? 0) > 0 ? LIVE_TTL : DEFAULT_TTL;
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return Date.now() - ts > ttlForData(data) ? null : data;
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
    let mounted = true;
    let timer = null;

    function scheduleNext(data) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        sessionStorage.removeItem(CACHE_KEY);
        load();
      }, ttlForData(data));
    }

    async function load() {
      const cached = readCache();
      if (cached) {
        setMatches(cached);
        setCounts(cached.counts ?? {});
        setLoading(false);
        scheduleNext(cached);
        return;
      }

      try {
        const res = await fetch('/api/sports', { signal: AbortSignal.timeout(15000) });
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
        if (mounted) {
          setMatches(data);
          setCounts(data.counts);
          setLoading(false);
          scheduleNext(data);
        }
      } catch {
        if (mounted) {
          setMatches([]);
          setLoading(false);
          scheduleNext({ counts: { live: 0 } });
        }
      }
    }

    load();
    return () => { mounted = false; clearTimeout(timer); };
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
