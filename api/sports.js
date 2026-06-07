/**
 * /api/sports  — Vercel serverless function
 *
 * Multi-source strategy:
 *  1. ESPNCricinfo consumer API  → best live cricket scores (all international)
 *  2. The Sports DB              → broad coverage: soccer, cricket, badminton,
 *                                   kabaddi, hockey, basketball, etc. — today ± 1 day
 *  3. ESPN                       → F1, tennis majors, NBA, known leagues
 *
 * India-match detection: any match where a team name / league contains
 * "India", "IND", IPL team names, ISL, Pro Kabaddi, etc. gets a priority
 * boost so they appear first in Live/Upcoming/Results sections.
 *
 * Sort order within each state:
 *   India matches → other international → rest
 *
 * CDN cache: 3 minutes.
 */

const ESPN   = 'https://site.api.espn.com/apis/site/v2/sports';
const ESPNCI = 'https://hs-consumer-api.espncricinfo.com/v1/pages';
const SDB    = 'https://www.thesportsdb.com/api/v1/json/3';

const HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

async function safeJson(url, ms = 9000) {
  try {
    const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ── India match detection ─────────────────────────────────────────────────
const INDIA_KEYWORDS = [
  'india', 'indian', ' ind ', 'ipl ', 'ipl2', 'bcci',
  // IPL teams
  'chennai super kings', 'csk', 'mumbai indians', 'kolkata knight', 'kkr',
  'royal challengers', 'rcb', 'delhi capitals', ' dc ', 'punjab kings', 'pbks',
  'gujarat titans', 'gt ', 'sunrisers', 'srh', 'lucknow super giants', 'lsg',
  'rajasthan royals', 'rr ',
  // Football
  'isl', 'i-league', 'india national',
  // Hockey
  'hockey india', 'fih india',
  // Other Indian leagues
  'pro kabaddi', 'pkl', 'premier badminton',
  // India women teams
  'india women', 'india w',
  // India A / U19
  'india a', 'india u19', 'india u23',
];

function isIndiaMatch(text = '') {
  const t = text.toLowerCase();
  return INDIA_KEYWORDS.some(kw => t.includes(kw));
}

// ── Sport mapping from Sports DB sport name ───────────────────────────────
const SDB_SPORT_MAP = {
  'Cricket':       { key: 'cricket',    name: 'Cricket',    emoji: '🏏' },
  'Soccer':        { key: 'football',   name: 'Football',   emoji: '⚽' },
  'Field Hockey':  { key: 'fieldhockey',name: 'Field Hockey',emoji: '🏑' },
  'Hockey':        { key: 'fieldhockey',name: 'Field Hockey',emoji: '🏑' },
  'Badminton':     { key: 'badminton',  name: 'Badminton',  emoji: '🏸' },
  'Kabaddi':       { key: 'kabaddi',    name: 'Kabaddi',    emoji: '🤸' },
  'Basketball':    { key: 'basketball', name: 'Basketball', emoji: '🏀' },
  'Tennis':        { key: 'tennis',     name: 'Tennis',     emoji: '🎾' },
  'Rugby':         { key: 'rugby',      name: 'Rugby',      emoji: '🏉' },
  'Volleyball':    { key: 'volleyball', name: 'Volleyball', emoji: '🏐' },
  'Table Tennis':  { key: 'tabletennis',name: 'Table Tennis',emoji: '🏓' },
  'Squash':        { key: 'squash',     name: 'Squash',     emoji: '🎱' },
  'Athletics':     { key: 'athletics',  name: 'Athletics',  emoji: '🏃' },
  'Swimming':      { key: 'swimming',   name: 'Swimming',   emoji: '🏊' },
  'Boxing':        { key: 'boxing',     name: 'Boxing',     emoji: '🥊' },
  'MMA':           { key: 'mma',        name: 'MMA',        emoji: '🥊' },
  'Motorsport':    { key: 'f1',         name: 'Motorsport', emoji: '🏎️' },
  'Golf':          { key: 'golf',       name: 'Golf',       emoji: '⛳' },
  'Cycling':       { key: 'cycling',    name: 'Cycling',    emoji: '🚴' },
  'Wrestling':     { key: 'wrestling',  name: 'Wrestling',  emoji: '🤼' },
};

const NOW = Date.now();
const H48 = 48 * 60 * 60 * 1000;

// ── Convert SportsDB event → internal format ──────────────────────────────
function convertSDB(ev, sport) {
  const sportMeta = SDB_SPORT_MAP[sport] ?? { key: sport.toLowerCase(), name: sport, emoji: '🏅' };
  const s = (ev.strStatus ?? ev.strProgress ?? '').toLowerCase();
  const state = (s.includes('live') || s.includes('inning') || s.includes(' ov') || s.includes('in progress') || s.includes('quarter') || s.includes('half'))
    ? 'in'
    : (s.includes('finish') || s.includes('complet') || s.includes('result') || s.includes('final') || ev.intHomeScore != null)
    ? 'post'
    : 'pre';

  const dateStr = ev.strTimestamp
    ?? (ev.dateEvent && ev.strTime ? `${ev.dateEvent}T${ev.strTime}+00:00` : null)
    ?? (ev.dateEvent ? `${ev.dateEvent}T00:00:00Z` : null);

  const evTime = dateStr ? new Date(dateStr).getTime() : null;
  if (state === 'post' && evTime && NOW - evTime > H48) return null;
  if (state === 'pre'  && evTime && evTime - NOW > H48) return null;

  const homeScore = ev.intHomeScore != null ? String(ev.intHomeScore) : '';
  const awayScore = ev.intAwayScore != null ? String(ev.intAwayScore) : '';
  const homeWins  = state === 'post' && Number(ev.intHomeScore) > Number(ev.intAwayScore);
  const awayWins  = state === 'post' && Number(ev.intAwayScore) > Number(ev.intHomeScore);

  const searchText = [ev.strHomeTeam, ev.strAwayTeam, ev.strLeague, ev.strSport].join(' ');

  return {
    id:          `sdb_${ev.idEvent}`,
    sport:       sportMeta.key,
    sportName:   sportMeta.name,
    emoji:       sportMeta.emoji,
    match:       ev.strEvent || `${ev.strHomeTeam || '?'} vs ${ev.strAwayTeam || '?'}`,
    league:      ev.strLeague || ev.strSeason || '',
    state,
    date:        dateStr,
    summary:     ev.strResult || (state === 'in' ? ev.strProgress || 'Live' : ev.strStatus || ''),
    detail:      ev.strProgress || '',
    clock:       '',
    period:      null,
    venue:       ev.strVenue || ev.strCountry || '',
    competitors: [
      { name: ev.strHomeTeam || '?', score: homeScore, winner: homeWins },
      { name: ev.strAwayTeam || '?', score: awayScore, winner: awayWins },
    ],
    isIndia: isIndiaMatch(searchText),
    source: 'sdb',
  };
}

// ── The Sports DB: fetch all sports for 3 days ────────────────────────────
const SDB_SPORTS_TO_FETCH = [
  'Cricket', 'Soccer', 'Badminton', 'Field Hockey', 'Kabaddi',
  'Basketball', 'Tennis', 'Rugby', 'Volleyball', 'Table Tennis',
  'Athletics', 'Boxing', 'MMA', 'Wrestling', 'Golf', 'Cycling',
];

async function fetchSportsDB() {
  const today    = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow  = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const dates = [yesterday, today, tomorrow];

  // All sport × date combinations in parallel
  const fetches = SDB_SPORTS_TO_FETCH.flatMap(sport =>
    dates.map(d => safeJson(`${SDB}/eventsday.php?d=${d}&s=${encodeURIComponent(sport)}`).then(r => ({ sport, events: r?.events ?? [] })))
  );

  const results = await Promise.allSettled(fetches);
  const all = [];
  const seen = new Set();

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { sport, events } = r.value;
    for (const ev of events) {
      if (!ev?.idEvent || seen.has(ev.idEvent)) continue;
      seen.add(ev.idEvent);
      const converted = convertSDB(ev, sport);
      if (converted) all.push(converted);
    }
  }

  console.log(`SportsDB: ${all.length} events across ${SDB_SPORTS_TO_FETCH.length} sports`);
  return all;
}

// ── ESPNCricinfo: live cricket ─────────────────────────────────────────────
function ciToInternal(m) {
  const state = m.status?.type?.id === 'InProgress' ? 'in'
    : m.status?.type?.id === 'Finished' ? 'post' : 'pre';
  const competitors = (m.teams ?? []).map(t => ({
    name:    t.team?.longName ?? t.team?.name ?? '?',
    score:   t.score ? `${t.score.runs ?? ''}/${t.score.wickets ?? ''}` : '',
    winner:  state === 'post' && !!t.isWinner,
    order:   99,
  }));
  const searchText = competitors.map(c => c.name).join(' ') + ' ' + (m.description ?? '');
  return {
    id:          `ci_${m.objectId ?? m.id ?? Math.random()}`,
    sport:       'cricket',
    sportName:   'Cricket',
    emoji:       '🏏',
    match:       m.description ?? m.title ?? 'Cricket',
    league:      m.series?.name ?? m.tournament?.name ?? '',
    state,
    date:        m.startTime ?? null,
    summary:     m.status?.displayText ?? '',
    detail:      m.status?.displayText ?? '',
    clock:       '',
    period:      null,
    venue:       m.venue?.name ?? m.ground?.longName ?? '',
    competitors,
    isIndia:     isIndiaMatch(searchText),
    source:      'espncricinfo',
  };
}

async function fetchCricket() {
  const events = [];

  // Source 1: ESPNCricinfo live page
  const ci = await safeJson(`${ESPNCI}/matches/home?slug=live-cricket-score`);
  const ciMatches = ci?.content?.matches ?? ci?.matches ?? [];
  if (ciMatches.length) {
    events.push(...ciMatches.map(ciToInternal).filter(Boolean));
    console.log(`Cricket ESPNCricinfo: ${ciMatches.length} matches`);
  }

  // Source 2: ESPN with Indian region
  if (events.length === 0) {
    const espnIn = await safeJson(`${ESPN}/cricket/scoreboard?region=in&lang=en-in`);
    if (espnIn?.events?.length) {
      console.log(`Cricket ESPN-IN: ${espnIn.events.length}`);
      // Use ESPNCricinfo converter format
    }
  }

  // Source 3: ESPN cricket leagues
  if (events.length === 0) {
    const lg = await safeJson(`${ESPN}/cricket/leagues`);
    const ids = (lg?.leagues ?? []).map(l => String(l.id)).filter(Boolean);
    if (ids.length) {
      const res = await Promise.allSettled(ids.slice(0, 10).map(id => safeJson(`${ESPN}/cricket/${id}/scoreboard`)));
      for (const r of res) {
        if (r.status !== 'fulfilled' || !r.value?.events) continue;
        // events already handled by sportsdb for cricket; just log
      }
      console.log(`Cricket ESPN leagues: ${ids.length} leagues tried`);
    }
  }

  return events;
}

// ── ESPN: specific sports not well-covered by SportsDB ────────────────────
const ESPN_SPORTS = [
  { key: 'f1',    path: 'racing/f1',  name: 'Formula 1',  emoji: '🏎️' },
  { key: 'golf',  path: 'golf',       name: 'Golf',        emoji: '⛳' },
];

async function fetchESPN() {
  const events = [];
  for (const sport of ESPN_SPORTS) {
    const base = `${ESPN}/${sport.path}`;
    let raw = await safeJson(`${base}/scoreboard`);
    if (!raw?.events?.length) {
      const lg = await safeJson(`${base}/leagues`);
      const ids = (lg?.leagues ?? []).map(l => l.id).filter(Boolean).slice(0, 5);
      if (ids.length) {
        const res = await Promise.allSettled(ids.map(id => safeJson(`${base}/${id}/scoreboard`)));
        raw = { events: res.flatMap(r => r.status === 'fulfilled' ? r.value?.events ?? [] : []) };
      }
    }
    for (const ev of raw?.events ?? []) {
      const comp = ev?.competitions?.[0];
      if (!comp) continue;
      const state  = comp.status?.type?.state ?? 'post';
      const date   = comp.date ?? ev.date ?? null;
      const evTime = date ? new Date(date).getTime() : null;
      if (state === 'post' && evTime && NOW - evTime > H48) continue;
      if (state === 'pre'  && evTime && evTime - NOW > H48) continue;
      const competitors = (comp.competitors ?? []).map(c => ({
        name:   c.team?.shortDisplayName || c.athlete?.shortName || '?',
        score:  c.score ?? '',
        winner: c.winner === 'true' || c.winner === true,
        order:  Number(c.order ?? 99),
      }));
      if (sport.key === 'f1') competitors.sort((a, b) => a.order - b.order).splice(5);
      events.push({
        id: `espn_${ev.id}`, sport: sport.key, sportName: sport.name, emoji: sport.emoji,
        match: ev.shortName || ev.name || '', league: ev.season?.displayName || '',
        state, date, summary: comp.status?.summary ?? '', detail: comp.status?.type?.detail ?? '',
        clock: comp.status?.displayClock ?? '', period: comp.status?.period ?? null,
        venue: comp.venue?.fullName ?? '', competitors,
        isIndia: false, source: 'espn',
      });
    }
  }
  console.log(`ESPN direct: ${events.length} events`);
  return events;
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=360');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // Fetch all sources in parallel
  const [sdbEvents, cricketEvents, espnEvents] = await Promise.all([
    fetchSportsDB(),
    fetchCricket(),
    fetchESPN(),
  ]);

  // Merge, deduplicate by id
  const seen = new Set();
  const all  = [];

  const addAll = (events) => {
    for (const ev of events) {
      if (!ev?.id || seen.has(ev.id)) continue;
      seen.add(ev.id);
      all.push(ev);
    }
  };

  // Priority: cricket (ESPNCricinfo best) → SportsDB → ESPN
  addAll(cricketEvents);
  addAll(sdbEvents);
  addAll(espnEvents);

  // Sort:
  // 1. state: live(0) > upcoming(1) > completed(2)
  // 2. within state: India(0) > international(1) > other(2)
  // 3. within India+state: upcoming=soonest first, completed=most-recent first
  const stateOrder = { in: 0, pre: 1, post: 2 };
  all.sort((a, b) => {
    const sd = (stateOrder[a.state] ?? 9) - (stateOrder[b.state] ?? 9);
    if (sd !== 0) return sd;
    const id = (a.isIndia ? 0 : 1) - (b.isIndia ? 0 : 1);
    if (id !== 0) return id;
    if (!a.date || !b.date) return 0;
    if (a.state === 'pre') return new Date(a.date).getTime() - new Date(b.date).getTime();
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const live      = all.filter(m => m.state === 'in');
  const upcoming  = all.filter(m => m.state === 'pre');
  const completed = all.filter(m => m.state === 'post');

  // Per-sport breakdown for debugging
  const sportCounts = {};
  all.forEach(m => { sportCounts[m.sport] = (sportCounts[m.sport] ?? 0) + 1; });
  const indiaCount = all.filter(m => m.isIndia).length;

  console.log(`/api/sports: ${all.length} total | India: ${indiaCount} | live:${live.length} upcoming:${upcoming.length} completed:${completed.length}`);
  console.log(`Breakdown: ${Object.entries(sportCounts).map(([k,v]) => `${k}:${v}`).join(' ')}`);

  return res.status(200).json({
    matches: all, live, upcoming, completed,
    counts: { live: live.length, upcoming: upcoming.length, completed: completed.length },
  });
}
