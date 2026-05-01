// Reads the news feed via our own /api/news proxy. The proxy lives on Vercel
// (api/news.js) in production and is replaced by a Vite dev middleware locally
// (see vite.config.js). The sheet ID stays server-side so it never appears in
// the client bundle or in DevTools.

const COLUMNS = [
  'fetched_at_ist',
  'category',
  'article_url',
  'title',
  'description',
  'content',
  'key_points',
  'image_url',
  'published_at_ist',
  'source_name',
  'language',
  'country',
  'sentiment',
];

function buildUrl(query) {
  return query ? `/api/news?q=${encodeURIComponent(query)}` : '/api/news';
}

// gviz returns a JS callback wrapper — we strip it to get the raw JSON.
function parseGvizPayload(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  const body = match ? match[1] : text.match(/\{[\s\S]*\}/)?.[0];
  if (!body) throw new Error('Unexpected gviz payload');
  return JSON.parse(body);
}

function rowToArticle(row) {
  const article = {};
  COLUMNS.forEach((col, idx) => {
    article[col] = row.c[idx]?.v ?? '';
  });
  // For the two datetime columns we keep gviz's `Date(yyyy,m,d,H,M,S)` value
  // (parseDate handles it directly). The formatted .f string ("2026-04-30
  // 18:25:00") is browser-dependent — Safari rejects the space separator as
  // Invalid Date — and using it caused some rows to fall back to epoch 0
  // and pile up at the bottom of the sort.
  return article;
}

export async function loadNews({ query, signal } = {}) {
  const url = buildUrl(query);
  const res = await fetch(url, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`News proxy returned ${res.status}`);
  const text = await res.text();
  const json = parseGvizPayload(text);
  if (json.status === 'error') {
    throw new Error(json.errors?.[0]?.detailed_message || 'Sheet returned an error');
  }
  const rows = json.table?.rows || [];
  return rows.map(rowToArticle).filter(a => a.article_url && a.title);
}

// Convenience helpers that build common gviz queries.
// `recent` defaults to a high limit so the whole sheet is pulled — pagination
// happens client-side once the data is in memory.
export const queries = {
  recent: (limit = 10000) => `select * order by I desc limit ${limit}`,
  byCategory: (cat, limit = 200) => `where B contains '${cat.replace(/'/g, "\\'")}' order by I desc limit ${limit}`,
  byLanguage: (lang, limit = 500) => `where K = '${lang}' order by I desc limit ${limit}`,
  search: (term) => `where lower(D) contains '${term.toLowerCase().replace(/'/g, "\\'")}' order by I desc`,
};
