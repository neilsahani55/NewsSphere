// Vercel serverless function — proxies the Google Sheet gviz endpoint.
//
// The sheet ID is held in a SERVER-ONLY environment variable (no VITE_ prefix)
// so it never gets baked into the client JS bundle. The client calls
// `/api/news?q=...` and we forward the gviz request, returning the raw
// `google.visualization.Query.setResponse(...)` payload that the existing
// frontend parser already understands.

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const SHEET_ID = process.env.SHEET_ID;
  const SHEET_TAB = process.env.SHEET_TAB || 'News';

  if (!SHEET_ID) {
    res.status(500).json({ error: 'SHEET_ID env var is not configured on the server' });
    return;
  }

  // Vercel exposes parsed query on req.query; fall back to URL parsing for
  // local Node runtimes that don't.
  const q = (req.query && typeof req.query.q === 'string')
    ? req.query.q
    : new URL(req.url, 'http://x').searchParams.get('q') || '';

  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_TAB)}`;
  const upstream = q ? `${base}&tq=${encodeURIComponent(q)}` : base;

  try {
    const r = await fetch(upstream, { cache: 'no-store' });
    const text = await r.text();
    // Cache at the edge for 60 s; allow stale revalidation for 5 min so
    // bursty traffic doesn't hammer the sheet.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(r.status).send(text);
  } catch (err) {
    res.status(502).json({ error: 'Sheet upstream fetch failed', detail: err.message });
  }
}
