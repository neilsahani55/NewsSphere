/**
 * /api/sports  — Vercel serverless function
 *
 * Fetches live/upcoming scores for multiple sports from ESPN's public API.
 * Server-side fetch (no CORS). Returns unified JSON grouped by sport.
 *
 * CDN cache: 3 minutes (live scores change frequently)
 */

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';

const HDR = {
  'User-Agent': 'Mozilla/5.0 (compatible; NewsSphere/1.0)',
  'Accept': 'application/json',
};

// Sports to fetch — path is the ESPN API sub-path
const SPORTS = [
  { key: 'cricket',    path: 'cricket',            name: 'Cricket',      emoji: '🏏' },
  { key: 'football',   path: 'soccer',              name: 'Football',     emoji: '⚽' },
  { key: 'f1',         path: 'racing/f1',           name: 'Formula 1',    emoji: '🏎️' },
  { key: 'basketball', path: 'basketball/nba',      name: 'Basketball',   emoji: '🏀' },
  { key: 'tennis',     path: 'tennis',              name: 'Tennis',       emoji: '🎾' },
  { key: 'hockey',     path: 'hockey',              name: 'Hockey',       emoji: '🏒' },
  { key: 'baseball',   path: 'baseball/mlb',        name: 'Baseball',     emoji: '⚾' },
  { key: 'nfl',        path: 'football/nfl',        name: 'NFL',          emoji: '🏈' },
  { key: 'golf',       path: 'golf',                name: 'Golf',         emoji: '⛳' },
  { key: 'mma',        path: 'mma',                 name: 'UFC / MMA',    emoji: '🥊' },
  { key: 'rugby',      path: 'rugby',               name: 'Rugby',        emoji: '🏉' },
];

async function safeJson(url) {
  try {
    const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Try general scoreboard; if empty, discover leagues and fetch those
async function fetchSportEvents(sport) {
  const base = `${ESPN}/${sport.path}`;
  let events = [];

  // 1. General scoreboard (works for some sports like F1, NBA)
  const general = await safeJson(`${base}/scoreboard`);
  if (general?.events?.length) {
    events = general.events;
  }

  // 2. If no events, discover leagues and fetch per-league scoreboards
  if (events.length === 0) {
    const leaguesJson = await safeJson(`${base}/leagues`);
    const ids = (leaguesJson?.leagues ?? []).map(l => String(l.id)).slice(0, 6);
    if (ids.length) {
      const results = await Promise.all(ids.map(id => safeJson(`${base}/${id}/scoreboard`)));
      events = results.flatMap(r => r?.events ?? []);
    }
  }

  return events;
}

function parseCompetitor(c) {
  return {
    name:   c.team?.shortDisplayName || c.team?.abbreviation || c.team?.displayName || '?',
    score:  c.score ?? '',
    winner: c.winner === 'true' || c.winner === true,
  };
}

function parseEvent(ev, sport) {
  const comp = ev?.competitions?.[0];
  if (!comp) return null;

  const state      = comp.status?.type?.state ?? 'post';        // 'in' | 'pre' | 'post'
  const detail     = comp.status?.type?.detail ?? '';
  const clock      = comp.status?.displayClock ?? '';
  const period     = comp.status?.period ?? null;
  const summary    = comp.status?.summary ?? detail;
  const venue      = comp.venue?.fullName ?? '';
  const competitors = (comp.competitors ?? []).map(parseCompetitor);
  const name       = ev.shortName || ev.name || '';

  return {
    id:    ev.id,
    sport: sport.key,
    name:  sport.name,
    emoji: sport.emoji,
    match: name,
    state,
    summary,
    detail,
    clock,
    period,
    venue,
    competitors,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=360');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // Fetch all sports in parallel
  const sportResults = await Promise.allSettled(
    SPORTS.map(sport => fetchSportEvents(sport).then(events => ({ sport, events })))
  );

  const allMatches = [];

  for (const result of sportResults) {
    if (result.status !== 'fulfilled') continue;
    const { sport, events } = result.value;

    // Deduplicate by event id within sport
    const seen = new Set();
    for (const ev of events) {
      if (!ev?.id || seen.has(ev.id)) continue;
      seen.add(ev.id);
      const parsed = parseEvent(ev, sport);
      if (parsed) allMatches.push(parsed);
    }
  }

  // Sort: live → upcoming → completed; within each group keep original order
  const order = { in: 0, pre: 1, post: 2 };
  allMatches.sort((a, b) => (order[a.state] ?? 9) - (order[b.state] ?? 9));

  const live    = allMatches.filter(m => m.state === 'in');
  const pre     = allMatches.filter(m => m.state === 'pre');
  const post    = allMatches.filter(m => m.state === 'post');

  console.log(`/api/sports: ${allMatches.length} total (${live.length} live, ${pre.length} upcoming)`);

  return res.status(200).json({
    matches: allMatches,
    counts: { live: live.length, upcoming: pre.length, completed: post.length },
  });
}
