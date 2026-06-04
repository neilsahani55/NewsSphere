import { useCallback, useEffect, useState } from 'react';
import { clearMarketCache, fetchAllMarkets } from '../services/marketService.js';

export function useMarkets() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (bust = false) => {
    if (bust) clearMarketCache();
    setLoading(true);
    try {
      const d = await fetchAllMarkets();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Clears cache and re-fetches fresh data
  const refresh = useCallback(() => load(true), [load]);

  return { data, loading, refresh };
}
