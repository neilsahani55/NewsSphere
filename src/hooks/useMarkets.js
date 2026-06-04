import { useEffect, useState } from 'react';
import { clearMarketCache, fetchAllMarkets } from '../services/marketService.js';

const REFRESH_MS = 15 * 60 * 1000; // auto-refresh every 15 min (matches pipeline)

export function useMarkets() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;

    async function load(bust = false) {
      if (bust) clearMarketCache();
      try {
        const d = await fetchAllMarkets();
        if (live) { setData(d); setLoading(false); }
      } catch {
        if (live) setLoading(false);
      }
    }

    load();
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => { live = false; clearInterval(timer); };
  }, []);

  return { data, loading };
}
