/**
 * /api/sports — India-first sports data
 *
 * Cricket reality: ESPNCricinfo and Cricbuzz return 403 from ALL server IPs
 * (Vercel, GitHub Actions, etc.) — they only serve browsers.
 * Cricket data comes from Sports DB (schedule + results, not live ball-by-ball).
 *
 * Sources:
 *  1. Sports DB — India team search → events for all sports India plays in
 *  2. Sports DB — today ±1 day for 12 sports (cricket, football, tennis, etc.)
 *  3. ESPN      — F1 + Golf (10-day window, ESPN works fine for these)
 *
 * State fix:  SportsDB past events with empty status → 'post'
 * Name fix:   Tennis/Badminton empty strHomeTeam → parsed from strEvent "X vs Y"
 * Sort:       India matches first within each tab (Live / Upcoming / Results)
 */

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';
const SDB  = 'https://www.thesportsdb.com/api/v1/json/3';

const HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-IN,en;q=0.9',
};

async function safeJson(url, ms = 10000) {
  try {
    const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ── India detection ───────────────────────────────────────────────────────
const INDIA_KW = [
  'india', 'indian', ' ind ', 'ipl ', 'bcci',
  'csk', 'chennai super', 'mumbai indians', 'kolkata knight', 'kkr',
  'royal challengers', 'rcb', 'delhi capitals', 'pbks', 'punjab kings',
  'gujarat titans', 'gt ', 'sunrisers', 'srh', 'lucknow super', 'lsg',
  'rajasthan royals', 'rr ',
  'isl', 'i-league', 'hockeyindia', 'fih india',
  'pro kabaddi', 'pkl', 'india women', 'india a', 'india u19', 'india u23',
];
function isIndia(text = '') {
  const t = (' ' + text + ' ').toLowerCase();
  return INDIA_KW.some(k => t.includes(k));
}

// ── Extract player names from "Roland Garros Mirra Andreeva vs Maja Chwalinska"
function parseVsNames(strEvent, rawHome, rawAway) {
  const home = (rawHome ?? '').trim();
  const away = (rawAway ?? '').trim();
  if (home && away) return [home, away];
  const parts = (strEvent ?? '').split(/\s+vs\.?\s+/i);
  if (parts.length < 2) return [home || '?', away || '?'];
  const homeWords = parts[0].trim().split(/\s+/);
  const awayWords = parts[1].trim().split(/\s+/);
  return [
    home || (homeWords.length > 2 ? homeWords.slice(-2).join(' ') : homeWords.join(' ')) || '?',
    away || awayWords.slice(0, 2).join(' ') || '?',
  ];
}

// ── Time windows ──────────────────────────────────────────────────────────
const NOW = Date.now();
const H1  = 3600000;
const H48 = 48  * H1;
const H72 = 72  * H1;
const H7D = 7   * 24 * H1;
const H10D = 10 * 24 * H1;

function inWindow(dateStr, state, preMax = H48, postMax = H48) {
  if (!dateStr) return true;
  const t = new Date(dateStr).getTime();
  if (isNaN(t)) return true;
  if (state === 'post' && NOW - t > postMax) return false;
  if (state === 'pre'  && t - NOW > preMax)  return false;
  return true;
}

// ── Sports DB sport → internal key ───────────────────────────────────────
const SDB_META = {
  'Cricket':      { key: 'cricket',     name: 'Cricket',      emoji: '🏏' },
  'Soccer':       { key: 'football',    name: 'Football',     emoji: '⚽' },
  'Football':     { key: 'football',    name: 'Football',     emoji: '⚽' },
  'Field Hockey': { key: 'fieldhockey', name: 'Field Hockey', emoji: '🏑' },
  'Hockey':       { key: 'fieldhockey', name: 'Hockey',       emoji: '🏒' },
  'Badminton':    { key: 'badminton',   name: 'Badminton',    emoji: '🏸' },
  'Kabaddi':      { key: 'kabaddi',     name: 'Kabaddi',      emoji: '🤸' },
  'Basketball':   { key: 'basketball',  name: 'Basketball',   emoji: '🏀' },
  'Tennis':       { key: 'tennis',      name: 'Tennis',       emoji: '🎾' },
  'Rugby':        { key: 'rugby',       name: 'Rugby',        emoji: '🏉' },
  'Volleyball':   { key: 'volleyball',  name: 'Volleyball',   emoji: '🏐' },
  'Athletics':    { key: 'athletics',   name: 'Athletics',    emoji: '🏃' },
  'Boxing':       { key: 'boxing',      name: 'Boxing',       emoji: '🥊' },
  'MMA':          { key: 'mma',         name: 'MMA',          emoji: '🥊' },
  'Wrestling':    { key: 'wrestling',   name: 'Wrestling',    emoji: '🤼' },
  'Table Tennis': { key: 'tabletennis', name: 'Table Tennis', emoji: '🏓' },
  'Squash':       { key: 'squash',      name: 'Squash',       emoji: '🎱' },
  'Golf':         { key: 'golf',        name: 'Golf',         emoji: '⛳' },
  'Motorsport':   { key: 'f1',          name: 'Motorsport',   emoji: '🏎️' },
  'Swimming':     { key: 'swimming',    name: 'Swimming',     emoji: '🏊' },
};

// Strip HTML tags from SportsDB text fields (strResult/strProgress contain <br> etc.)
function stripTags(str) {
  return (str ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Parse winner name from strResult text e.g. "Middlesex t20 won by 45 runs"
// Returns { homeWin: bool, awayWin: bool }
function parseWinner(strResult, homeName, awayName) {
  if (!strResult || !homeName || !awayName) return { homeWin: false, awayWin: false };
  const r = strResult.toLowerCase();
  const h = homeName.toLowerCase();
  const a = awayName.toLowerCase();
  // "X won" or "X win"
  const homeWin = r.includes(h + ' won') || r.includes(h + ' win') || r.startsWith(h + ' ');
  const awayWin = r.includes(a + ' won') || r.includes(a + ' win') || r.startsWith(a + ' ');
  return { homeWin, awayWin };
}

function sdbToMatch(ev, overrideSport) {
  const sport = overrideSport ?? ev.strSport ?? 'Unknown';
  const meta  = SDB_META[sport] ?? { key: sport.toLowerCase().replace(/\s+/g, ''), name: sport, emoji: '🏅' };

  const rawStatus   = (ev.strStatus ?? '').trim();
  const stTxt       = (rawStatus + ' ' + (ev.strProgress ?? '')).toLowerCase();

  // Explicit "not started" signals from SportsDB — trust these over time inference
  // NS = Not Started; these appear even after scheduled time if SDB hasn't updated yet
  const isExplicitlyNotStarted =
    rawStatus === 'NS' || rawStatus === '' ||
    stTxt.includes('not started') || stTxt.includes('fixture') ||
    stTxt.includes('scheduled') || stTxt.includes('postponed');

  const isLive     = stTxt.includes('live') || stTxt.includes('inning') || stTxt.includes('progress') || stTxt.includes('quarter') || stTxt.includes('half') || stTxt.includes('set ');
  const isDoneText = !isLive && !isExplicitlyNotStarted && (stTxt.includes('finish') || stTxt.includes('complet') || stTxt.includes('result') || stTxt.includes('final') || stTxt.includes('won') || stTxt.includes(' win'));
  const hasBothScores = ev.intHomeScore != null && ev.intAwayScore != null;

  const dateStr = ev.strTimestamp
    ?? (ev.dateEvent && ev.strTime ? `${ev.dateEvent}T${ev.strTime}+00:00` : null)
    ?? (ev.dateEvent ? `${ev.dateEvent}T00:00:00Z` : null);
  const evTime = dateStr ? new Date(dateStr).getTime() : null;

  // isPast: only override to 'post' if NOT explicitly "not started" by SportsDB
  // This prevents NS/empty-status events from landing in Results just because
  // their scheduled time has passed and SportsDB hasn't updated yet.
  const isPast = evTime != null && evTime < NOW - H1 && !isExplicitlyNotStarted;

  const state = isLive ? 'in'
    : (isDoneText || hasBothScores || isPast) ? 'post'
    : 'pre';

  // Cricket gets wider windows (matches every few days, not daily)
  const preMax  = sport === 'Cricket' ? H7D  : H48;
  const postMax = sport === 'Cricket' ? H72  : H48;
  if (!inWindow(dateStr, state, preMax, postMax)) return null;

  const hs = ev.intHomeScore != null ? String(ev.intHomeScore) : '';
  const as = ev.intAwayScore != null ? String(ev.intAwayScore) : '';

  const [homeName, awayName] = parseVsNames(ev.strEvent, ev.strHomeTeam, ev.strAwayTeam);
  const searchT = [homeName, awayName, ev.strLeague, ev.strSport].join(' ');

  // Winner: score-based first, fall back to strResult text parsing
  let hw = state === 'post' && hasBothScores && Number(ev.intHomeScore) > Number(ev.intAwayScore);
  let aw = state === 'post' && hasBothScores && Number(ev.intAwayScore) > Number(ev.intHomeScore);
  if (state === 'post' && !hw && !aw && ev.strResult) {
    const { homeWin, awayWin } = parseWinner(ev.strResult, homeName, awayName);
    hw = homeWin;
    aw = awayWin;
  }

  // Strip HTML from SportsDB text fields (<br>, <b> etc. appear in strResult/strProgress)
  const cleanResult   = stripTags(ev.strResult);
  const cleanProgress = stripTags(ev.strProgress);
  const cleanStatus   = rawStatus === 'NS' ? '' : rawStatus; // hide bare "NS" from UI

  const summary = cleanResult || (isLive ? cleanProgress || 'Live' : cleanStatus);

  return {
    id:        `sdb_${ev.idEvent}`,
    sport:     meta.key,
    sportName: meta.name,
    emoji:     meta.emoji,
    match:     ev.strEvent || `${homeName} vs ${awayName}`,
    league:    ev.strLeague || ev.strSeason || '',
    state,
    date:      dateStr,
    summary,
    detail:    cleanProgress,
    clock:     isLive ? '🔴 Live' : '',
    period:    null,
    venue:     ev.strVenue || ev.strCountry || '',
    competitors: [
      { name: homeName, score: hs, winner: hw },
      { name: awayName, score: as, winner: aw },
    ],
    isIndia: isIndia(searchT),
    source:  'sdb',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 1: Sports DB — search all "India" teams across every sport
// Gets India cricket, hockey, football, badminton, kabaddi, etc.
// ─────────────────────────────────────────────────────────────────────────
async function fetchIndiaSportsDB() {
  const data  = await safeJson(`${SDB}/searchteams.php?t=India`);
  const teams = (data?.teams ?? []).filter(t => {
    const n = (t.strTeam ?? '').toLowerCase();
    return n === 'india' || n.startsWith('india ') || n.endsWith(' india') || n.includes(' india ');
  }).slice(0, 30);

  console.log(`SDB India teams: ${teams.length}`);

  const fetches = teams.flatMap(team => [
    safeJson(`${SDB}/eventsnext.php?id=${team.idTeam}`).then(r => r?.events ?? []),
    safeJson(`${SDB}/eventslast.php?id=${team.idTeam}`).then(r => r?.events ?? []),
  ]);

  const results = await Promise.allSettled(fetches);
  const seen = new Set();
  const out  = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const ev of r.value) {
      if (!ev?.idEvent || seen.has(ev.idEvent)) continue;
      seen.add(ev.idEvent);
      const m = sdbToMatch(ev);
      if (m) out.push(m);
    }
  }

  console.log(`SDB India events: ${out.length}`);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 2: Sports DB — today ±1 day for 12 sports
// Catches international matches + non-India events
// ─────────────────────────────────────────────────────────────────────────
async function fetchSportsDBToday() {
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(NOW - 86400000).toISOString().slice(0, 10);
  const tmrw  = new Date(NOW + 86400000).toISOString().slice(0, 10);

  const SPORTS = [
    'Cricket', 'Soccer', 'Field Hockey', 'Badminton', 'Kabaddi',
    'Tennis', 'Rugby', 'Basketball', 'Wrestling', 'Table Tennis',
    'Volleyball', 'Boxing',
  ];

  const fetches = SPORTS.flatMap(sport =>
    [yest, today, tmrw].map(d =>
      safeJson(`${SDB}/eventsday.php?d=${d}&s=${encodeURIComponent(sport)}`).then(r => ({ sport, evs: r?.events ?? [] }))
    )
  );

  const results = await Promise.allSettled(fetches);
  const seen = new Set();
  const out  = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const ev of r.value.evs) {
      if (!ev?.idEvent || seen.has(ev.idEvent)) continue;
      seen.add(ev.idEvent);
      const m = sdbToMatch(ev, r.value.sport);
      if (m) out.push(m);
    }
  }

  console.log(`SDB today: ${out.length}`);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 3: ESPN — F1 + Golf (10-day window; races happen every 2-3 weeks)
// ─────────────────────────────────────────────────────────────────────────
async function fetchESPN() {
  const SPORTS = [
    { key: 'f1',   path: 'racing/f1', name: 'Formula 1', emoji: '🏎️' },
    { key: 'golf', path: 'golf',      name: 'Golf',       emoji: '⛳' },
  ];
  const out = [];

  for (const s of SPORTS) {
    const base = `${ESPN}/${s.path}`;
    let raw = await safeJson(`${base}/scoreboard`);
    if (!raw?.events?.length) {
      const lg  = await safeJson(`${base}/leagues`);
      const ids = (lg?.leagues ?? []).map(l => l.id).filter(Boolean).slice(0, 6);
      if (ids.length) {
        const rs = await Promise.allSettled(ids.map(id => safeJson(`${base}/${id}/scoreboard`)));
        raw = { events: rs.flatMap(r => r.status === 'fulfilled' ? r.value?.events ?? [] : []) };
      }
    }
    for (const ev of raw?.events ?? []) {
      const comp = ev?.competitions?.[0];
      if (!comp) continue;
      const state = comp.status?.type?.state ?? 'post';
      const date  = comp.date ?? ev.date ?? null;
      if (!inWindow(date, state, H10D, H10D)) continue;
      const competitors = (comp.competitors ?? [])
        .map(c => ({
          name:   c.athlete?.shortName || c.athlete?.displayName || c.team?.shortDisplayName || c.team?.abbreviation || '?',
          score:  c.score ?? '',
          winner: c.winner === 'true' || c.winner === true,
          order:  Number(c.order ?? 99),
        }))
        .sort((a, b) => a.order - b.order)
        .slice(0, 10);
      out.push({
        id:        `espn_${ev.id}`,
        sport:     s.key,
        sportName: s.name,
        emoji:     s.emoji,
        match:     ev.shortName || ev.name || '',
        league:    ev.season?.displayName || '',
        state,
        date,
        summary:   comp.status?.summary ?? '',
        detail:    comp.status?.type?.detail ?? '',
        clock:     state === 'in' ? '🔴 Live' : '',
        period:    comp.status?.period ?? null,
        venue:     comp.venue?.fullName ?? '',
        competitors,
        isIndia:   false,
        source:    'espn',
      });
    }
  }

  console.log(`ESPN F1+Golf: ${out.length}`);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=360');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const [indiaSDB, todaySDB, espnEvents] = await Promise.all([
    fetchIndiaSportsDB(),
    fetchSportsDBToday(),
    fetchESPN(),
  ]);

  const seen = new Set();
  const all  = [];
  const add  = (evs) => {
    for (const ev of evs) {
      if (!ev?.id || seen.has(ev.id)) continue;
      seen.add(ev.id);
      all.push(ev);
    }
  };

  // India events first (covers cricket, hockey, football, kabaddi, etc.)
  add(indiaSDB);
  // Then broad today's events (catches international matches not in India search)
  add(todaySDB);
  // F1 + Golf
  add(espnEvents);

  // Sort: live → upcoming soonest → completed most-recent; India first within each
  all.sort((a, b) => {
    const so = { in: 0, pre: 1, post: 2 };
    const sd = (so[a.state] ?? 9) - (so[b.state] ?? 9);
    if (sd !== 0) return sd;
    const id = (a.isIndia ? 0 : 1) - (b.isIndia ? 0 : 1);
    if (id !== 0) return id;
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.state === 'pre'
      ? new Date(a.date) - new Date(b.date)
      : new Date(b.date) - new Date(a.date);
  });

  const live      = all.filter(m => m.state === 'in');
  const upcoming  = all.filter(m => m.state === 'pre');
  const completed = all.filter(m => m.state === 'post');

  const sc = {};
  all.forEach(m => { sc[m.sport] = (sc[m.sport] ?? 0) + 1; });
  console.log(`TOTAL: ${all.length} | India: ${all.filter(m=>m.isIndia).length} | live:${live.length} upcoming:${upcoming.length} completed:${completed.length}`);
  console.log(`Sports: ${Object.entries(sc).map(([k,v])=>`${k}:${v}`).join(' ')}`);

  return res.status(200).json({
    matches: all, live, upcoming, completed,
    counts:  { live: live.length, upcoming: upcoming.length, completed: completed.length },
  });
}
