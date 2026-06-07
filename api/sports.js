/**
 * /api/sports  — Vercel serverless function
 *
 * Priority order:
 *  1. International / global  (FIFA, UEFA, ICC, F1, Grand Slams, Olympics)
 *  2. India-focused           (IPL, ISL, IHL, PKL, India national teams)
 *  3. Major regional leagues  (Premier League, La Liga, NBA, etc.)
 *
 * American-only sports (NFL, MLB) removed. Replaced with international
 * alternatives that are relevant globally and in India.
 *
 * Football/Soccer fetches 20+ explicit league scoreboards in parallel
 * rather than relying on ESPN's US-biased general endpoint.
 *
 * CDN cache: 3 minutes.
 */

const ESPN   = 'https://site.api.espn.com/apis/site/v2/sports';
const ESPNCI = 'https://hs-consumer-api.espncricinfo.com/v1/pages';
const SDB    = 'https://www.thesportsdb.com/api/v1/json/3';

const HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
};

const RACING_KEYS = new Set(['f1', 'f2', 'motogp', 'nascar']);

// ── Football/Soccer: explicit leagues (international first, then India, then regional) ──
const SOCCER_LEAGUES = [
  // ── Global tournaments ──────────────────────────────────────────────────
  'UEFA.CHAMPIONS',        // UEFA Champions League
  'UEFA.EUROPA',           // UEFA Europa League
  'UEFA.EUROPA.CONF',      // UEFA Conference League
  'FIFA.WORLD',            // FIFA World Cup
  'FIFA.WORLD.QUALIFIER.AFC',
  'FIFA.WORLD.QUALIFIER.UEFA',
  'CONMEBOL.COPA',         // Copa America
  'CONCACAF.GOLD',         // CONCACAF Gold Cup
  'AFC.CHAMPIONS',         // AFC Champions League
  'CAF.CHAMPIONS',         // CAF Champions League
  'UEFA.NATIONS',          // UEFA Nations League
  // ── India ───────────────────────────────────────────────────────────────
  'IND.1',                 // ISL — Indian Super League
  'IND.2',                 // I-League
  'IND.SUPER',             // India Super Cup
  // ── Top European leagues ─────────────────────────────────────────────────
  'ENG.1',                 // Premier League
  'ESP.1',                 // La Liga
  'GER.1',                 // Bundesliga
  'ITA.1',                 // Serie A
  'FRA.1',                 // Ligue 1
  'NED.1',                 // Eredivisie
  'POR.1',                 // Primeira Liga
  'TUR.1',                 // Süper Lig
  // ── Asian / other ────────────────────────────────────────────────────────
  'AFC.ASIAN.CUP',         // AFC Asian Cup
  'AUS.1',                 // A-League (Australia)
  'ARG.1',                 // Liga Profesional (Argentina)
  'BRA.1',                 // Brasileirão (Brazil)
  'MLS',                   // MLS (if applicable)
];

// ── Other sports: international focused ──────────────────────────────────
const OTHER_SPORTS = [
  { key: 'f1',         path: 'racing/f1',         name: 'Formula 1',  emoji: '🏎️' },
  { key: 'tennis',     path: 'tennis',             name: 'Tennis',     emoji: '🎾' },
  { key: 'rugby',      path: 'rugby',              name: 'Rugby',      emoji: '🏉' },
  { key: 'basketball', path: 'basketball/nba',     name: 'Basketball', emoji: '🏀' },
  { key: 'golf',       path: 'golf',               name: 'Golf',       emoji: '⛳' },
  { key: 'mma',        path: 'mma',                name: 'UFC / MMA',  emoji: '🥊' },
  { key: 'hockey',     path: 'hockey',             name: 'Hockey',     emoji: '🏒' },
  { key: 'badminton',  path: 'badminton',          name: 'Badminton',  emoji: '🏸' },
  { key: 'athletics',  path: 'athletics',          name: 'Athletics',  emoji: '🏃' },
  { key: 'boxing',     path: 'boxing',             name: 'Boxing',     emoji: '🥊' },
  { key: 'volleyball', path: 'volleyball',         name: 'Volleyball', emoji: '🏐' },
  { key: 'basketball_fiba', path: 'basketball/mens-college-basketball', name: 'FIBA Basketball', emoji: '🏀' },
];

async function safeJson(url, ms = 8000) {
  try {
    const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ── Cricket: 5-source dedicated fetcher ───────────────────────────────────

function ciMatchToEvent(m) {
  const state = m.status?.type?.id === 'InProgress' ? 'in'
    : m.status?.type?.id === 'Finished' ? 'post' : 'pre';
  const competitors = (m.teams ?? []).map(t => ({
    team: { displayName: t.team?.longName ?? t.team?.name ?? '?', shortDisplayName: t.team?.abbreviation ?? t.team?.name ?? '?' },
    score: t.score ? `${t.score.runs ?? ''}/${t.score.wickets ?? ''}` : '',
    winner: (state === 'post' && t.isWinner) ? 'true' : 'false',
  }));
  return {
    id: String(m.objectId ?? m.id ?? Math.random()),
    name: m.description ?? m.title ?? 'Cricket',
    shortName: m.title ?? m.description ?? 'Cricket',
    date: m.startTime ?? null,
    competitions: [{ date: m.startTime ?? null, status: { type: { state, detail: m.status?.displayText ?? '' }, summary: m.status?.displayText ?? '' }, venue: { fullName: m.venue?.name ?? m.ground?.longName ?? '' }, competitors }],
  };
}

function sdbEventToEvent(ev) {
  const s = (ev.strStatus ?? '').toLowerCase();
  const state = (s.includes('live') || s.includes('inning') || s.includes('over') || s.includes('progress')) ? 'in'
    : (s.includes('finished') || s.includes('completed') || s.includes('result')) ? 'post' : 'pre';
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
  // 1. ESPNCricinfo consumer API (best live cricket)
  const ci = await safeJson(`${ESPNCI}/matches/home?slug=live-cricket-score`);
  const ciMatches = ci?.content?.matches ?? ci?.matches ?? [];
  if (ciMatches.length) { console.log(`Cricket ESPNCricinfo: ${ciMatches.length}`); return ciMatches.map(ciMatchToEvent); }

  // 2. ESPN India region
  const espnIn = await safeJson(`${ESPN}/cricket/scoreboard?region=in&lang=en-in`);
  if (espnIn?.events?.length) { console.log(`Cricket ESPN-IN: ${espnIn.events.length}`); return espnIn.events; }

  // 3. ESPN general
  const espnGen = await safeJson(`${ESPN}/cricket/scoreboard`);
  if (espnGen?.events?.length) { console.log(`Cricket ESPN-gen: ${espnGen.events.length}`); return espnGen.events; }

  // 4. ESPN cricket leagues
  const lg = await safeJson(`${ESPN}/cricket/leagues`);
  const ids = (lg?.leagues ?? []).map(l => String(l.id)).filter(Boolean);
  if (ids.length) {
    const res = await Promise.all(ids.slice(0, 10).map(id => safeJson(`${ESPN}/cricket/${id}/scoreboard`)));
    const ev = res.flatMap(r => r?.events ?? []);
    if (ev.length) { console.log(`Cricket ESPN-leagues (${ids.length}): ${ev.length}`); return ev; }
  }

  // 5. The Sports DB (free, no key, 3 days)
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tmrw  = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const sdbRes = await Promise.all([today, yest, tmrw].map(d => safeJson(`${SDB}/eventsday.php?d=${d}&s=Cricket`)));
  const sdbEv = sdbRes.flatMap(r => r?.events ?? []);
  if (sdbEv.length) { console.log(`Cricket SportsDB: ${sdbEv.length}`); return sdbEv.map(sdbEventToEvent); }

  console.log('Cricket: all 5 sources returned 0');
  return [];
}

// ── Football: explicit international + Indian leagues in parallel ──────────

async function fetchFootballEvents() {
  const results = await Promise.allSettled(
    SOCCER_LEAGUES.map(slug => safeJson(`${ESPN}/soccer/${slug}/scoreboard`))
  );
  const events = [];
  const seen = new Set();
  results.forEach((r) => {
    if (r.status !== 'fulfilled' || !r.value?.events) return;
    for (const ev of r.value.events) {
      if (ev?.id && !seen.has(ev.id)) { seen.add(ev.id); events.push(ev); }
    }
  });
  // If explicit leagues returned nothing, try general soccer scoreboard
  if (!events.length) {
    const gen = await safeJson(`${ESPN}/soccer/scoreboard`);
    (gen?.events ?? []).forEach(ev => { if (ev?.id && !seen.has(ev.id)) { seen.add(ev.id); events.push(ev); } });
  }
  console.log(`Football: ${events.length} from ${SOCCER_LEAGUES.length} leagues`);
  return events;
}

// ── Standard fetcher (for non-cricket, non-football sports) ──────────────

async function fetchSportEvents(sport) {
  const base = `${ESPN}/${sport.path}`;
  let events = [];
  const gen = await safeJson(`${base}/scoreboard`);
  if (gen?.events?.length) return gen.events;
  // League discovery
  const lg = await safeJson(`${base}/leagues`);
  const ids = (lg?.leagues ?? []).map(l => String(l.id)).slice(0, 6);
  if (ids.length) {
    const res = await Promise.all(ids.map(id => safeJson(`${base}/${id}/scoreboard`)));
    events = res.flatMap(r => r?.events ?? []);
  }
  return events;
}

// ── Parsing ────────────────────────────────────────────────────────────────

function parseCompetitor(c, sportKey) {
  const isRacing = RACING_KEYS.has(sportKey);
  const isIndiv  = ['tennis', 'golf', 'mma', 'boxing', 'athletics', 'badminton'].includes(sportKey);
  const ath  = c.athlete?.shortName || c.athlete?.displayName || '';
  const team = c.team?.shortDisplayName || c.team?.abbreviation || c.team?.displayName || '';
  const name = (isRacing || isIndiv) ? (ath || team || '?') : (team || ath || '?');
  return { name, score: c.score ?? '', winner: c.winner === 'true' || c.winner === true, order: Number(c.order ?? 99) };
}

const NOW = Date.now();
const H48 = 48 * 60 * 60 * 1000;

function parseEvent(ev, sportKey, sportName, emoji) {
  const comp   = ev?.competitions?.[0];
  if (!comp) return null;
  const state  = comp.status?.type?.state ?? 'post';
  const date   = comp.date ?? ev.date ?? null;
  const evTime = date ? new Date(date).getTime() : null;
  if (state === 'post' && evTime && NOW - evTime > H48) return null;
  if (state === 'pre'  && evTime && evTime - NOW > H48) return null;

  let competitors = (comp.competitors ?? []).map(c => parseCompetitor(c, sportKey));
  if (RACING_KEYS.has(sportKey) || sportKey === 'golf') {
    competitors = competitors.sort((a, b) => a.order - b.order).slice(0, 5);
  }
  if (competitors.every(c => c.name === '?')) competitors = [];

  const league = ev.competitions?.[0]?.series?.shortName
              || ev.competitions?.[0]?.notes?.[0]?.headline
              || ev.season?.displayName
              || comp.tournament?.name || '';

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
  const addEvents = (events, key, name, emoji) => {
    const seen = new Set(all.map(e => e.id));
    for (const ev of events) {
      if (!ev?.id || seen.has(ev.id)) continue;
      seen.add(ev.id);
      const p = parseEvent(ev, key, name, emoji);
      if (p) all.push(p);
    }
  };

  // 1. Cricket — multi-source (international + India)
  const cricketEv = await fetchCricketEvents();
  addEvents(cricketEv, 'cricket', 'Cricket', '🏏');

  // 2. Football — international leagues + India
  const footballEv = await fetchFootballEvents();
  addEvents(footballEv, 'football', 'Football', '⚽');

  // 3. All other sports in parallel
  const otherResults = await Promise.allSettled(
    OTHER_SPORTS.map(s => fetchSportEvents(s).then(ev => ({ sport: s, events: ev })))
  );
  for (const r of otherResults) {
    if (r.status !== 'fulfilled') continue;
    const { sport, events } = r.value;
    if (events?.length) addEvents(events, sport.key, sport.name, sport.emoji);
  }

  // Sort: live → upcoming soonest → completed most recent
  all.sort((a, b) => {
    const o = { in: 0, pre: 1, post: 2 };
    const od = (o[a.state] ?? 9) - (o[b.state] ?? 9);
    if (od !== 0) return od;
    if (a.state === 'pre') return new Date(a.date).getTime() - new Date(b.date).getTime();
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const live     = all.filter(m => m.state === 'in');
  const upcoming = all.filter(m => m.state === 'pre');
  const completed = all.filter(m => m.state === 'post');

  console.log(`/api/sports total: ${all.length} (live:${live.length} upcoming:${upcoming.length} completed:${completed.length})`);
  console.log(`Sports breakdown: ${[...new Set(all.map(m => m.sport))].map(s => `${s}:${all.filter(m=>m.sport===s).length}`).join(' ')}`);

  return res.status(200).json({
    matches: all, live, upcoming, completed,
    counts: { live: live.length, upcoming: upcoming.length, completed: completed.length },
  });
}
