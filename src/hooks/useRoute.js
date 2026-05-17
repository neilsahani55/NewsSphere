import { useEffect, useState } from 'react';

function parseHash(hash) {
  const h = hash || '#/';
  const m = h.match(/^#\/article\/(\d+)$/);
  if (m) return { route: '#/article', articleId: +m[1] };
  return { route: h, articleId: null };
}

export function useRoute() {
  const [parsed, setParsed] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const handler = () => setParsed(parseHash(window.location.hash));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return parsed;
}
