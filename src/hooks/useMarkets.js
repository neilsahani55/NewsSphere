import { useEffect, useState } from 'react';
import { fetchAllMarkets } from '../services/marketService.js';

export function useMarkets() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    fetchAllMarkets()
      .then(d  => { if (live) { setData(d);  setLoading(false); } })
      .catch(() => { if (live) { setLoading(false); } });
    return () => { live = false; };
  }, []);

  return { data, loading };
}
