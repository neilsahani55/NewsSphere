import { useCallback, useEffect, useState } from 'react';

const KEY = 'ns_bookmarks';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function useBookmarks() {
  const [urls, setUrls] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(urls)); } catch {}
  }, [urls]);

  const isBookmarked = useCallback((url) => urls.includes(url), [urls]);

  const toggle = useCallback((url) => {
    if (!url) return;
    setUrls(prev => prev.includes(url) ? prev.filter(u => u !== url) : [url, ...prev]);
  }, []);

  const clearAll = useCallback(() => setUrls([]), []);

  return { bookmarks: urls, isBookmarked, toggle, clearAll, count: urls.length };
}
