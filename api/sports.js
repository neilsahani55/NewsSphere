/**
 * /api/sports  — Vercel serverless function
 * Live/upcoming/recent scores for 11 sports from ESPN's public API.
 * Server-side fetch bypasses browser CORS restrictions.
 * CDN cache: 3 minutes.
 */

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';
const HDR  = { 'User-Agent': 'Mozilla/5.0 (compatible; NewsSphere/1.0)', Accept: 'application/json' };

const SPORTS = [
  { key: 'cricket',    path: 'cricket',         name: 'Cricket',    emoji: '🏏' },
  { key: 'football',   path: 'soccer',           name: 'Football',   emoji: '⚽' },
  { key: 'f1',         path: 'racing/f1',        name: 'Formula 1',  emoji: '🏎️' },
  { key: 'basketball', path: 'basketball/nba',   name: 'Basketball', emoji: '🏀' },
  { key: 'tennis',     path: 'tennis',           name: 'Tennis',     emoji: '🎾' },
  { key: 'hockey',     path: 'hockey',           name: 'Hockey',     emoji: '🏒' },
  { key: 'baseball',   path: 'baseball/mlb',     name: 'Baseball',   emoji: '⚾' },
  { key: 'nfl',        path: 'football/nfl',     name: 'NFL',        emoji: '🏈' },
  { key: 'golf',       path: 'golf',             name: 'Golf',       emoji: '⛳' },
  { key: 'mma',        path: 'mma',              name: 'UFC / MMA',  emoji: '🥊' },
  { key: 'rugby',      path: 'rugby',            name: 'Rugby',      emoji: '🏉' },
];

const RACING_KEYS = new Set(['f1', 'nascar', 'indycar']);

async function safeJson(url) {
  try {
    const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fetchSportEvents(sport) {
  const base = `${ESPN}/${sport.path}`;
  let events = [];

  const general = await safeJson(`${base}/scoreboard`);
  if (general?.events?.length) events = general.events;

  if (!events.length) {
    const leagues = await safeJson(`${base}/leagues`);
    const ids = (leagues?.leagues ?? []).map(l => String(l.id)).slice(0, 6);
    if (ids.length) {
      const res = await Promise.all(ids.map(id => safeJson(`${base}/${id}/scoreboard`)));
      events = res.flatMap(r => r?.events ?? []);
    }
  }

  return events;
}

// Parse a single competitor — handles both team sports AND racing (F1 uses athletes)
function parseCompetitor(c, sportKey) {
  const isRacing = RACING_KEYS.has(sportKey);

  let name = '?';
  if (isRacing) {
    // F1/racing: driver name is in athlete, team is the constructor
    name = c.athlete?.shortName || c.athlete?.displayName
        || c.team?.shortDisplayName || c.team?.abbreviation || '?';
  } else {
    name = c.team?.shortDisplayName || c.team?.abbreviation
        || c.team?.displayName || c.athlete?.shortName
        || c.athlete?.displayName || '?';
  }

  return {
    name,
    score:    c.score ?? '',
    winner:   c.winner === 'true' || c.winner === true,
    order:    Number(c.order ?? c.homeAway === 'home' ? 0 : 1),
  };
}

const NOW = Date.now();
const H48 = 48 * 60 * 60 * 1000;  // 48 hours = yesterday + today

function parseEvent(ev, sport) {
  const comp = ev?.competitions?.[0];
  if (!comp) return null;

  const state  = comp.status?.type?.state ?? 'post';
  const date   = comp.date ?? ev.date ?? null;
  const evTime = date ? new Date(date).getTime() : null;

  // Results: yesterday + today (last 48 hours)
  if (state === 'post' && evTime && NOW - evTime > H48) return null;
  // Upcoming: today + tomorrow (next 48 hours)
  if (state === 'pre'  && evTime && evTime - NOW > H48) return null;

  let competitors = (comp.competitors ?? []).map(c => parseCompetitor(c, sport.key));

  // Racing: sort by finishing position (order field), show top 5 only
  if (RACING_KEYS.has(sport.key)) {
    competitors = competitors.sort((a, b) => a.order - b.order).slice(0, 5);
  }

  return {
    id:          ev.id,
    sport:       sport.key,
    sportName:   sport.name,
    emoji:       sport.emoji,
    match:       ev.shortName || ev.name || '',
    state,
    date,
    summary:     comp.status?.summary ?? '',
    detail:      comp.status?.type?.detail ?? '',
    clock:       comp.status?.displayClock ?? '',
    period:      comp.status?.period ?? null,
    venue:       comp.venue?.fullName ?? '',
    competitors,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=360');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const sportResults = await Promise.allSettled(
    SPORTS.map(s => fetchSportEvents(s).then(events => ({ sport: s, events })))
  );

  const all = [];
  for (const r of sportResults) {
    if (r.status !== 'fulfilled') continue;
    const { sport, events } = r.value;
    const seen = new Set();
    for (const ev of events) {
      if (!ev?.id || seen.has(ev.id)) continue;
      seen.add(ev.id);
      const parsed = parseEvent(ev, sport);
      if (parsed) all.push(parsed);
    }
  }

  // Sort: live → upcoming (soonest first) → completed (most recent first)
  all.sort((a, b) => {
    const order = { in: 0, pre: 1, post: 2 };
    const od = (order[a.state] ?? 9) - (order[b.state] ?? 9);
    if (od !== 0) return od;
    if (a.state === 'pre') {
      return new Date(a.date).getTime() - new Date(b.date).getTime();  // soonest first
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();    // most recent first
  });

  const live      = all.filter(m => m.state === 'in');
  const upcoming  = all.filter(m => m.state === 'pre');
  const completed = all.filter(m => m.state === 'post');

  console.log(`/api/sports: ${live.length} live, ${upcoming.length} upcoming, ${completed.length} completed`);

  return res.status(200).json({
    matches: all,
    live,
    upcoming,
    completed,
    counts: { live: live.length, upcoming: upcoming.length, completed: completed.length },
  });
}
