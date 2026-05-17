import { useEffect, useState } from 'react';

const TAB_PATHS = {
  '/':          'home',
  '/special':   'special',
  '/allnews':   'allnews',
  '/feedback':  'feedback',
};

function parsePath(pathname) {
  const p = pathname || '/';

  // Article: /news/{slug}-{id}
  const articleMatch = p.match(/^\/news\/(.+)-(\d+)$/);
  if (articleMatch) {
    return { route: '/news', tab: 'allnews', slug: articleMatch[1], articleId: +articleMatch[2] };
  }

  // Legal/static pages
  if (p.startsWith('/privacy'))     return { route: '/privacy',     tab: null, slug: null, articleId: null };
  if (p.startsWith('/terms'))       return { route: '/terms',       tab: null, slug: null, articleId: null };
  if (p.startsWith('/grievance'))   return { route: '/grievance',   tab: null, slug: null, articleId: null };
  if (p.startsWith('/methodology')) return { route: '/methodology', tab: null, slug: null, articleId: null };
  if (p.startsWith('/status'))      return { route: '/status',      tab: null, slug: null, articleId: null };

  const tab = TAB_PATHS[p] || 'home';
  return { route: p, tab, slug: null, articleId: null };
}

export const TAB_HASHES = {
  home:     '/',
  special:  '/special',
  allnews:  '/allnews',
  feedback: '/feedback',
};

export function navigate(path) {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute() {
  const [parsed, setParsed] = useState(() => parsePath(window.location.pathname));

  useEffect(() => {
    const handler = () => setParsed(parsePath(window.location.pathname));
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  return parsed;
}
