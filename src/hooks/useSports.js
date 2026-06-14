/**
 * Live sports scores across multiple disciplines.
 * Calls /api/sports (Vercel function) which fetches from multiple providers server-side.
 * Cached dynamically in sessionStorage with an escape hatch for manual refreshes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const CACHE_KEY = 'ns_sports_v6';
const DEFAULT_TTL = 45 * 1000;
const LIVE_TTL = 15 * 1000;
const EMPTY = { matches: [], live: [], upcoming: [], completed: [], counts: { live: 0, upcoming: 0, completed: 0 } };

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSportsData(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const live = asArray(source.live);
  const upcoming = asArray(source.upcoming);
  const completed = asArray(source.completed);
  const matches = asArray(source.matches);
  const countsSource = source.counts && typeof source.counts === 'object' && !Array.isArray(source.counts)
    ? source.counts
    : {};

  return {
    matches: matches.length > 0 ? matches : [...live, ...upcoming, ...completed],
    live,
    upcoming,
    completed,
    counts: {
      ...countsSource,
      live: Number.isFinite(countsSource.live) ? countsSource.live : live.length,
      upcoming: Number.isFinite(countsSource.upcoming) ? countsSource.upcoming : upcoming.length,
      completed: Number.isFinite(countsSource.completed) ? countsSource.completed : completed.length,
    },
  };
}

function ttlForData(data) {
  return (data?.counts?.live ?? 0) > 0 ? LIVE_TTL : DEFAULT_TTL;
}

function readCacheEntry() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    const normalized = normalizeSportsData(data);
    if (Date.now() - ts > ttlForData(normalized)) return null;
    return { ts, data: normalized };
  } catch { return null; }
}

function readCache() {
  return readCacheEntry()?.data ?? null;
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: normalizeSportsData(data) }));
  } catch {}
}

export function useSports() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef(null);
  const mountedRef = useRef(false);
  const lastForcedRefreshRef = useRef(0);
  const loadRef = useRef(async () => {});

  const scheduleNext = useCallback((nextData) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      sessionStorage.removeItem(CACHE_KEY);
      void loadRef.current(true);
    }, ttlForData(nextData));
  }, []);

  const load = useCallback(async (force = false) => {
    if (!force) {
      const cached = readCache();
      if (cached) {
        if (mountedRef.current) {
          setData(cached);
          setLoading(false);
          setRefreshing(false);
        }
        scheduleNext(cached);
        return;
      }
    }

    try {
      const suffix = force ? `?refresh=1&t=${Date.now()}` : '';
      const res = await fetch(`/api/sports${suffix}`, {
        signal: AbortSignal.timeout(15000),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const nextData = normalizeSportsData({
        matches: json.matches ?? [],
        live: json.live ?? [],
        upcoming: json.upcoming ?? [],
        completed: json.completed ?? [],
        counts: json.counts ?? {},
      });
      writeCache(nextData);
      if (mountedRef.current) {
        setData(nextData);
        setLoading(false);
        setRefreshing(false);
      }
      scheduleNext(nextData);
    } catch {
      const fallback = readCache() ?? EMPTY;
      if (mountedRef.current) {
        setData((current) => (current.matches.length > 0 ? current : fallback));
        setLoading(false);
        setRefreshing(false);
      }
      scheduleNext(fallback);
    }
  }, [scheduleNext]);

  loadRef.current = load;

  const refresh = useCallback(() => {
    lastForcedRefreshRef.current = Date.now();
    sessionStorage.removeItem(CACHE_KEY);
    setRefreshing(true);
    void load(true);
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    void load(false);

    function refreshOnReturn() {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastForcedRefreshRef.current < 5000) return;
      const cached = readCacheEntry();
      if (!cached || now - cached.ts >= Math.min(ttlForData(cached.data), 30 * 1000)) {
        lastForcedRefreshRef.current = now;
        void load(true);
      }
    }

    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);

    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [load]);

  return {
    matches: data.matches,
    live: data.live,
    upcoming:  data.upcoming,
    completed: data.completed,
    counts: data.counts,
    loading,
    refreshing,
    refresh,
  };
}
