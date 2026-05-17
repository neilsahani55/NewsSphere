import { useEffect, useState } from 'react';

function parseHash(hash) {
  const h = hash || '#/';
  // Format: #/news/{slug}-{id}  e.g.  #/news/ipl-super-sunday-1234
  const m = h.match(/^#\/news\/(.+)-(\d+)$/);
  if (m) return { route: '#/news', slug: m[1], articleId: +m[2] };
  return { route: h, slug: null, articleId: null };
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
