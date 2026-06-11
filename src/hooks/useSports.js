/**
 * Live sports scores across multiple disciplines.
 * Calls /api/sports (Vercel function) which fetches from ESPN server-side.
 * Cached dynamically in sessionStorage.
 */

import { useEffect, useState } from 'react';

const CACHE_KEY = 'ns_sports_v5';
const DEFAULT_TTL = 60 * 1000;
const LIVE_TTL = 20 * 1000;
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

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    const normalized = normalizeSportsData(data);
    return Date.now() - ts > ttlForData(normalized) ? null : normalized;
  } catch { return null; }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: normalizeSportsData(data) }));
  } catch {}
}

export function useSports() {
  const [data, setData]       = useState(EMPTY);
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
        setData(cached);
        setLoading(false);
        scheduleNext(cached);
        return;
      }

      try {
        const res = await fetch('/api/sports', { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const nextData = normalizeSportsData({
          matches:   json.matches   ?? [],
          live:      json.live      ?? [],
          upcoming:  json.upcoming  ?? [],
          completed: json.completed ?? [],
          counts:    json.counts    ?? {},
        });
        writeCache(nextData);
        if (mounted) {
          setData(nextData);
          setLoading(false);
          scheduleNext(nextData);
        }
      } catch {
        if (mounted) {
          setData(EMPTY);
          setLoading(false);
          scheduleNext(EMPTY);
        }
      }
    }

    load();
    return () => { mounted = false; clearTimeout(timer); };
  }, []);

  return {
    matches:   data.matches,
    live:      data.live,
    upcoming:  data.upcoming,
    completed: data.completed,
    counts:    data.counts,
    loading,
  };
}
