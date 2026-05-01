import { useCallback, useEffect, useRef, useState } from 'react';
import { loadNews, queries } from '../services/sheetService.js';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useNews({ auto = true } = {}) {
  const [articles, setArticles] = useState([]);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus('loading');
    setError(null);
    try {
      const data = await loadNews({ query: queries.recent(), signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setArticles(data);
      setLastUpdated(new Date());
      setStatus('success');
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err.message || 'Failed to load news');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!auto) return;
    refresh();
    const id = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [auto, refresh]);

  return { articles, status, error, lastUpdated, refresh };
}
