/**
 * /api/sports  — Vercel serverless function
 * Live/upcoming/recent scores for multiple sports.
 * Server-side fetch bypasses browser CORS restrictions.
 * CDN cache: 3 minutes.
 *
 * Cricket uses dedicated multi-source fetching because ESPN's US API
 * has limited cricket coverage. Sources tried in order:
 *  1. ESPNCricinfo consumer API  (live-cricket-score page)
 *  2. ESPN cricket with region=in (Indian-facing API)
 *  3. ESPN cricket general scoreboard
 *  4. ESPN cricket league discovery
 *  5. The Sports DB (free, no key, cricket by date)
 */

const ESPN   = 'https://site.api.espn.com/apis/site/v2/sports';
const ESPNCI = 'https://hs-consumer-api.espncricinfo.com/v1/pages';
const SDB    = 'https://www.thesportsdb.com/api/v1/json/3';

const HDR = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Accept: 'application/json' };

const NON_CRICKET_SPORTS = [
  { key: 'football',   path: 'soccer',         name: 'Football',   emoji: '⚽' },
  { key: 'f1',         path: 'racing/f1',       name: 'Formula 1',  emoji: '🏎️' },
  { key: 'basketball', path: 'basketball/nba',  name: 'Basketball', emoji: '🏀' },
  { key: 'tennis',     path: 'tennis',          name: 'Tennis',     emoji: '🎾' },
  { key: 'hockey',     path: 'hockey',          name: 'Hockey',     emoji: '🏒' },
  { key: 'baseball',   path: 'baseball/mlb',    name: 'Baseball',   emoji: '⚾' },
  { key: 'nfl',        path: 'football/nfl',    name: 'NFL',        emoji: '🏈' },
  { key: 'golf',       path: 'golf',            name: 'Golf',       emoji: '⛳' },
  { key: 'mma',        path: 'mma',             name: 'UFC / MMA',  emoji: '🥊' },
  { key: 'rugby',      path: 'rugby',           name: 'Rugby',      emoji: '🏉' },
];

const RACING_KEYS = new Set(['f1', 'nascar', 'indycar']);

async function safeJson(url, timeoutMs = 8000) {
  try {
    const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ── Cricket: dedicated multi-source fetcher ────────────────────────────────

/** Convert ESPNCricinfo consumer API match → ESPN-compatible event shape */
function ciMatchToEvent(m) {
  const state = m.status?.type?.id === 'InProgress' ? 'in'
    : m.status?.type?.id === 'Finished' ? 'post'
    : 'pre';
  const competitors = (m.teams ?? []).map(t => ({
    team: { displayName: t.team?.longName ?? t.team?.name ?? '?', shortDisplayName: t.team?.abbreviation ?? t.team?.name ?? '?' },
    score: t.score ? `${t.score.runs ?? ''}/${t.score.wickets ?? ''}` : '',
    winner: (m.status?.type?.id === 'Finished' && t.isWinner) ? 'true' : 'false',
  }));
  return {
    id: String(m.objectId ?? m.id ?? Math.random()),
    name: m.description ?? m.title ?? 'Cricket',
    shortName: m.title ?? m.description ?? 'Cricket',
    date: m.startTime ?? null,
    competitions: [{
      date:     m.startTime ?? null,
      status:   { type: { state, detail: m.status?.displayText ?? '' }, summary: m.status?.displayText ?? '' },
      venue:    { fullName: m.venue?.name ?? m.ground?.longName ?? '' },
      competitors,
    }],
  };
}

/** Convert The Sports DB event → ESPN-compatible event shape */
function sdbEventToEvent(ev) {
  const s = (ev.strStatus ?? '').toLowerCase();
  const state = (s.includes('live') || s.includes('inning') || s.includes('over') || s.includes('progress'))
    ? 'in'
    : (s.includes('finished') || s.includes('completed') || s.includes('result'))
    ? 'post'
    : 'pre';
  const dateStr = ev.strTimestamp ?? (ev.dateEvent ? `${ev.dateEvent}T${(ev.strTime ?? '00:00:00')}+00:00` : null);
  return {
    id: String(ev.idEvent ?? Math.random()),
    name: ev.strEvent ?? `${ev.strHomeTeam} vs ${ev.strAwayTeam}`,
    shortName: ev.strEvent ?? `${ev.strHomeTeam} v ${ev.strAwayTeam}`,
    date: dateStr,
    competitions: [{
      date: dateStr,
      status: { type: { state, detail: ev.strProgress ?? '' }, summary: ev.strResult ?? ev.strStatus ?? '' },
      venue: { fullName: ev.strVenue ?? '' },
      competitors: [
        { team: { displayName: ev.strHomeTeam ?? '?', shortDisplayName: ev.strHomeTeam ?? '?' }, score: ev.intHomeScore != null ? String(ev.intHomeScore) : '', winner: state === 'post' && Number(ev.intHomeScore) > Number(ev.intAwayScore) ? 'true' : 'false' },
        { team: { displayName: ev.strAwayTeam ?? '?', shortDisplayName: ev.strAwayTeam ?? '?' }, score: ev.intAwayScore != null ? String(ev.intAwayScore) : '', winner: state === 'post' && Number(ev.intAwayScore) > Number(ev.intHomeScore) ? 'true' : 'false' },
      ],
    }],
  };
}

async function fetchCricketEvents() {
  // ── Source 1: ESPNCricinfo consumer API ────────────────────────────────
  // This is the same API the ESPNCricinfo website uses — best cricket data.
  const ciLive = await safeJson(`${ESPNCI}/matches/home?slug=live-cricket-score`);
  const ciMatches = ciLive?.content?.matches ?? ciLive?.matches ?? [];
  if (ciMatches.length) {
    console.log(`Cricket: ESPNCricinfo returned ${ciMatches.length} matches`);
    return ciMatches.map(ciMatchToEvent);
  }

  // ── Source 2: ESPN cricket with Indian region ──────────────────────────
  const espnIn = await safeJson(`${ESPN}/cricket/scoreboard?region=in&lang=en-in`);
  if (espnIn?.events?.length) {
    console.log(`Cricket: ESPN India returned ${espnIn.events.length} matches`);
    return espnIn.events;
  }

  // ── Source 3: ESPN cricket general ────────────────────────────────────
  const espnGen = await safeJson(`${ESPN}/cricket/scoreboard`);
  if (espnGen?.events?.length) {
    console.log(`Cricket: ESPN general returned ${espnGen.events.length} matches`);
    return espnGen.events;
  }

  // ── Source 4: ESPN cricket league discovery ────────────────────────────
  const leaguesJson = await safeJson(`${ESPN}/cricket/leagues`);
  const ids = (leaguesJson?.leagues ?? []).map(l => String(l.id)).filter(Boolean);
  if (ids.length) {
    const results = await Promise.all(ids.slice(0, 10).map(id => safeJson(`${ESPN}/cricket/${id}/scoreboard`)));
    const events = results.flatMap(r => r?.events ?? []);
    if (events.length) {
      console.log(`Cricket: ESPN leagues (${ids.length}) returned ${events.length} matches`);
      return events;
    }
  }

  // ── Source 5: The Sports DB — free, no key, cricket by date ───────────
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow  = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [sdbToday, sdbYest, sdbTmrw] = await Promise.all([
    safeJson(`${SDB}/eventsday.php?d=${today}&s=Cricket`),
    safeJson(`${SDB}/eventsday.php?d=${yesterday}&s=Cricket`),
    safeJson(`${SDB}/eventsday.php?d=${tomorrow}&s=Cricket`),
  ]);

  const sdbEvents = [
    ...(sdbToday?.events  ?? []),
    ...(sdbYest?.events   ?? []),
    ...(sdbTmrw?.events   ?? []),
  ];

  if (sdbEvents.length) {
    console.log(`Cricket: Sports DB returned ${sdbEvents.length} matches`);
    return sdbEvents.map(sdbEventToEvent);
  }

  console.log('Cricket: all sources returned 0 matches');
  return [];
}

// ── Standard sport fetcher (for non-cricket sports) ────────────────────────
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

// ── Competitor parser ──────────────────────────────────────────────────────
function parseCompetitor(c, sportKey) {
  const isRacing = RACING_KEYS.has(sportKey);
  const isIndiv  = ['tennis', 'golf', 'mma', 'boxing'].includes(sportKey);
  const athleteName = c.athlete?.shortName || c.athlete?.displayName || '';
  const teamName    = c.team?.shortDisplayName || c.team?.abbreviation || c.team?.displayName || '';
  let name = isRacing || isIndiv ? (athleteName || teamName || '?') : (teamName || athleteName || '?');
  return {
    name,
    score:  c.score ?? '',
    winner: c.winner === 'true' || c.winner === true,
    order:  Number(c.order ?? 99),
  };
}

// ── Event parser ───────────────────────────────────────────────────────────
const NOW = Date.now();
const H48 = 48 * 60 * 60 * 1000;

function parseEvent(ev, sportKey, sportName, emoji) {
  const comp    = ev?.competitions?.[0];
  if (!comp) return null;
  const state   = comp.status?.type?.state ?? 'post';
  const date    = comp.date ?? ev.date ?? null;
  const evTime  = date ? new Date(date).getTime() : null;

  if (state === 'post' && evTime && NOW - evTime > H48) return null;
  if (state === 'pre'  && evTime && evTime - NOW > H48) return null;

  let competitors = (comp.competitors ?? []).map(c => parseCompetitor(c, sportKey));

  if (RACING_KEYS.has(sportKey)) competitors = competitors.sort((a, b) => a.order - b.order).slice(0, 5);
  if (sportKey === 'golf' && competitors.length > 5) competitors = competitors.sort((a, b) => a.order - b.order).slice(0, 5);
  if (competitors.every(c => c.name === '?')) competitors = [];

  const league = ev.competitions?.[0]?.series?.shortName
              || ev.competitions?.[0]?.notes?.[0]?.headline
              || ev.season?.displayName || '';

  return {
    id:        ev.id,
    sport:     sportKey,
    sportName,
    emoji,
    match:     ev.shortName || ev.name || '',
    league,
    state,
    date,
    summary:   comp.status?.summary ?? '',
    detail:    comp.status?.type?.detail ?? '',
    clock:     comp.status?.displayClock ?? '',
    period:    comp.status?.period ?? null,
    venue:     comp.venue?.fullName ?? '',
    competitors,
  };
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=360');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const all = [];

  // Cricket: dedicated enhanced fetching
  const cricketEvents = await fetchCricketEvents();
  const cricketSeen = new Set();
  for (const ev of cricketEvents) {
    if (!ev?.id || cricketSeen.has(ev.id)) continue;
    cricketSeen.add(ev.id);
    const parsed = parseEvent(ev, 'cricket', 'Cricket', '🏏');
    if (parsed) all.push(parsed);
  }

  // All other sports: standard ESPN fetching
  const otherResults = await Promise.allSettled(
    NON_CRICKET_SPORTS.map(s => fetchSportEvents(s).then(events => ({ sport: s, events })))
  );
  for (const r of otherResults) {
    if (r.status !== 'fulfilled') continue;
    const { sport, events } = r.value;
    const seen = new Set();
    for (const ev of events) {
      if (!ev?.id || seen.has(ev.id)) continue;
      seen.add(ev.id);
      const parsed = parseEvent(ev, sport.key, sport.name, sport.emoji);
      if (parsed) all.push(parsed);
    }
  }

  all.sort((a, b) => {
    const order = { in: 0, pre: 1, post: 2 };
    const od = (order[a.state] ?? 9) - (order[b.state] ?? 9);
    if (od !== 0) return od;
    if (a.state === 'pre') return new Date(a.date).getTime() - new Date(b.date).getTime();
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const live      = all.filter(m => m.state === 'in');
  const upcoming  = all.filter(m => m.state === 'pre');
  const completed = all.filter(m => m.state === 'post');

  console.log(`/api/sports: ${live.length} live, ${upcoming.length} upcoming, ${completed.length} completed (cricket: ${cricketEvents.length} fetched)`);

  return res.status(200).json({
    matches: all, live, upcoming, completed,
    counts: { live: live.length, upcoming: upcoming.length, completed: completed.length },
  });
}
