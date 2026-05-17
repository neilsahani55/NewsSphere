import { useEffect, useState } from 'react';

const TAB_ROUTES = {
  '#/':         'home',
  '#/special':  'special',
  '#/allnews':  'allnews',
  '#/feedback': 'feedback',
};

function parseHash(hash) {
  const h = hash || '#/';

  // Article URL: #/news/{slug}-{id}
  const articleMatch = h.match(/^#\/news\/(.+)-(\d+)$/);
  if (articleMatch) {
    return { route: '#/news', tab: 'allnews', slug: articleMatch[1], articleId: +articleMatch[2] };
  }

  // Legal/static pages
  if (h.startsWith('#/privacy'))     return { route: '#/privacy',     tab: null, slug: null, articleId: null };
  if (h.startsWith('#/terms'))       return { route: '#/terms',       tab: null, slug: null, articleId: null };
  if (h.startsWith('#/grievance'))   return { route: '#/grievance',   tab: null, slug: null, articleId: null };
  if (h.startsWith('#/methodology')) return { route: '#/methodology', tab: null, slug: null, articleId: null };
  if (h.startsWith('#/status'))      return { route: '#/status',      tab: null, slug: null, articleId: null };

  // Tab routes
  const tab = TAB_ROUTES[h] || 'home';
  return { route: h, tab, slug: null, articleId: null };
}

export const TAB_URLS = {
  home:     '#/',
  special:  '#/special',
  allnews:  '#/allnews',
  feedback: '#/feedback',
};

export function useRoute() {
  const [parsed, setParsed] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const handler = () => setParsed(parseHash(window.location.hash));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return parsed;
}
