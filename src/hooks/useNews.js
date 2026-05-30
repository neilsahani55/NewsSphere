import { useCallback, useEffect, useRef, useState } from 'react';
import { loadNews, INITIAL_BATCH, BACKGROUND_BATCH, MAX_TOTAL_ARTICLES } from '../services/supabaseService.js';

const REFRESH_MS = 5 * 60 * 1000;  // re-fetch everything every 5 minutes
const CACHE_KEY  = 'ns_articles_v2'; // bumped so stale v1 cache (with key_points) is discarded
const CACHE_TTL  = 25 * 60 * 1000;  // pipeline runs every 30 min — 25 min cache is safe

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL || !Array.isArray(data) || data.length === 0) return null;
    return data;
  } catch { return null; }
}

function writeCache(data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

export function useNews({ auto = true } = {}) {
  const [articles, setArticles] = useState(() => readCache() || []);
  const [status, setStatus] = useState(() => (readCache() ? 'success' : 'idle'));
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const abortRef = useRef(null);

  const fetchAll = useCallback(async (ctrl) => {
    setError(null);
    // Don't show spinner if we already have cached articles visible.
    setStatus(prev => prev === 'success' ? 'success' : 'loading');

    // ── Phase 1: first 50 articles ───────────────────────────────────────────
    // Fetch the initial batch and render immediately so the user sees news fast.
    const initial = await loadNews({ signal: ctrl.signal, from: 0, to: INITIAL_BATCH - 1 });
    if (ctrl.signal.aborted) return;

    setArticles(initial);
    setLastUpdated(new Date());
    setStatus('success');
    writeCache(initial);

    // If the database returned fewer rows than requested, there is nothing more.
    if (initial.length < INITIAL_BATCH) return;

    // ── Phase 2: remaining articles in background ────────────────────────────
    // Fetch pages of BACKGROUND_BATCH, stopping at MAX_TOTAL_ARTICLES so we
    // never load the whole database. Cache is written after every page so that
    // a partial load is still usable on the next visit.
    setBackgroundLoading(true);
    const all = [...initial];
    let from = INITIAL_BATCH;

    try {
      while (!ctrl.signal.aborted && all.length < MAX_TOTAL_ARTICLES) {
        const remaining = MAX_TOTAL_ARTICLES - all.length;
        const pageSize  = Math.min(BACKGROUND_BATCH, remaining);
        const batch = await loadNews({
          signal: ctrl.signal,
          from,
          to: from + pageSize - 1,
        });

        if (ctrl.signal.aborted || batch.length === 0) break;

        all.push(...batch);
        setArticles([...all]);
        writeCache(all); // persist after every page — don't lose data on early exit

        if (batch.length < pageSize || all.length >= MAX_TOTAL_ARTICLES) break;
        from += pageSize;
      }
    } finally {
      if (!ctrl.signal.aborted) setBackgroundLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    fetchAll(ctrl).catch((err) => {
      if (err.name === 'AbortError' || ctrl.signal.aborted) return;
      setError(err.message || 'Failed to load news');
      setStatus('error');
      setBackgroundLoading(false);
    });
  }, [fetchAll]);

  useEffect(() => {
    if (!auto) return;
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [auto, refresh]);

  return { articles, status, backgroundLoading, error, lastUpdated, refresh };
}
