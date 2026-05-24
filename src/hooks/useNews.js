import { useCallback, useEffect, useRef, useState } from 'react';
import { loadNews, INITIAL_BATCH, BACKGROUND_BATCH } from '../services/supabaseService.js';

const REFRESH_MS = 5 * 60 * 1000; // re-fetch everything every 5 minutes

export function useNews({ auto = true } = {}) {
  const [articles, setArticles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const abortRef = useRef(null);

  const fetchAll = useCallback(async (ctrl) => {
    setStatus('loading');
    setError(null);

    // ── Phase 1: first 50 articles ───────────────────────────────────────────
    // Fetch the initial batch and render immediately so the user sees news fast.
    const initial = await loadNews({ signal: ctrl.signal, from: 0, to: INITIAL_BATCH - 1 });
    if (ctrl.signal.aborted) return;

    setArticles(initial);
    setLastUpdated(new Date());
    setStatus('success');

    // If the database returned fewer rows than requested, there is nothing more.
    if (initial.length < INITIAL_BATCH) return;

    // ── Phase 2: remaining articles in background ────────────────────────────
    // Keep fetching pages of BACKGROUND_BATCH until the DB returns an empty page.
    setBackgroundLoading(true);
    const all = [...initial];
    let from = INITIAL_BATCH;

    try {
      while (!ctrl.signal.aborted) {
        const batch = await loadNews({
          signal: ctrl.signal,
          from,
          to: from + BACKGROUND_BATCH - 1,
        });

        if (ctrl.signal.aborted || batch.length === 0) break;

        all.push(...batch);
        setArticles([...all]); // each append triggers a re-render with more articles

        if (batch.length < BACKGROUND_BATCH) break; // last page
        from += BACKGROUND_BATCH;
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
