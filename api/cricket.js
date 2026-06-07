/**
 * /api/cricket  — Vercel serverless function
 *
 * Fetches live cricket scores from ESPN's public cricket API server-side.
 * No CORS issues — server-to-server, not browser-to-ESPN.
 *
 * Steps:
 *  1. Discover active cricket leagues from ESPN /leagues endpoint
 *  2. Fetch scoreboards for each active league
 *  3. Return all current/upcoming matches as JSON
 *
 * CDN cache: 3 minutes (scores change during live matches)
 */

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/cricket';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; NewsSphere/1.0)',
  'Accept': 'application/json',
};

async function safeJson(url) {
  try {
    const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function parseEvent(ev) {
  const comp = ev?.competitions?.[0];
  if (!comp) return null;
  const state   = comp.status?.type?.state;
  const summary = comp.status?.summary ?? '';
  const detail  = comp.status?.type?.detail ?? '';
  const competitors = (comp.competitors ?? []).map(c => ({
    name:   c.team?.shortDisplayName || c.team?.displayName || '?',
    score:  c.score ?? '',
    winner: c.winner === 'true' || c.winner === true,
  }));
  return { id: ev.id, name: ev.shortName || ev.name, state, summary, detail, competitors };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=360');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const allEvents = [];

  // Step 1: discover active leagues
  const leaguesJson = await safeJson(`${ESPN}/leagues`);
  const leagueIds = leaguesJson?.leagues?.map(l => String(l.id)).filter(Boolean) ?? [];

  // Step 2: try scoreboards for discovered leagues + a general one
  const endpoints = [
    `${ESPN}/scoreboard`,                          // general — no league filter
    ...leagueIds.slice(0, 8).map(id => `${ESPN}/${id}/scoreboard`),
  ];

  const results = await Promise.all(endpoints.map(safeJson));
  for (const json of results) {
    if (json?.events) allEvents.push(...json.events);
  }

  // Deduplicate by event id
  const seen = new Set();
  const unique = allEvents.filter(e => e?.id && !seen.has(e.id) && seen.add(e.id));

  const matches = unique.map(parseEvent).filter(Boolean);

  // Sort: live first, then upcoming, then completed
  const order = { in: 0, pre: 1, post: 2 };
  matches.sort((a, b) => (order[a.state] ?? 9) - (order[b.state] ?? 9));

  console.log(`/api/cricket: ${matches.length} matches (${leagueIds.length} leagues discovered)`);
  return res.status(200).json({ matches, leagueCount: leagueIds.length });
}
