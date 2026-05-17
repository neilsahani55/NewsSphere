import { useCallback, useEffect, useState } from 'react';

const KEY = 'ns_read';
const MAX = 300; // cap so localStorage never overflows

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

export function useReadArticles() {
  const [readUrls, setReadUrls] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(readUrls)); } catch {}
  }, [readUrls]);

  const isRead = useCallback((url) => readUrls.includes(url), [readUrls]);

  const markRead = useCallback((url) => {
    if (!url) return;
    setReadUrls(prev => {
      if (prev.includes(url)) return prev; // already marked, skip re-render
      const next = [url, ...prev];
      return next.length > MAX ? next.slice(0, MAX) : next;
    });
  }, []);

  const clearRead = useCallback(() => {
    setReadUrls([]);
    localStorage.removeItem(KEY);
  }, []);

  return { isRead, markRead, clearRead, readUrls, readCount: readUrls.length };
}
