/**
 * /api/sports — India-first multi-source sports data
 *
 * Cricket (cascading — all run in parallel, merged with dedup):
 *  A. ESPNCricinfo HTML page → parse __NEXT_DATA__ (Next.js embed)
 *     Most reliable — not an "API", just reading the same HTML the browser gets
 *  B. ESPNCricinfo consumer API — 5 slugs (live / upcoming / results / ipl / india)
 *  C. ESPN cricket scoreboard — India region + general + all league discovery
 *  D. Cricbuzz HTML  — live + upcoming + recent (may be blocked from DC IPs)
 *  E. Sports DB cricket today ±1 day
 *  F. Sports DB India cricket team — next/last 5 matches
 *
 * Other sports:
 *  G. Sports DB India team search — all sports where India plays
 *  H. Sports DB today ±1 day for 10 non-cricket sports
 *  I. ESPN F1 + Golf (10-day window)
 *
 * Time windows:
 *  Cricket: 7 days upcoming + 72 h completed
 *  F1/Golf: 10 days both ways
 *  All other: 48 h both ways
 *
 * State fix: SportsDB events with no strStatus but past date → 'post'
 * Name fix:  Individual sports (tennis/badminton) with empty strHomeTeam
 *            → parse player names from strEvent ("X vs Y")
 */

const ESPNCI = 'https://hs-consumer-api.espncricinfo.com/v1/pages';
const ESPN   = 'https://site.api.espn.com/apis/site/v2/sports';
const SDB    = 'https://www.thesportsdb.com/api/v1/json/3';
const CB     = 'https://www.cricbuzz.com/api/html/livescores';

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const JSON_HDR = { 'User-Agent': BROWSER_UA, Accept: 'application/json', 'Accept-Language': 'en-IN,en;q=0.9' };
const CI_HDR   = { ...JSON_HDR, Origin: 'https://www.espncricinfo.com', Referer: 'https://www.espncricinfo.com/' };
const HTML_HDR = { 'User-Agent': BROWSER_UA, Accept: 'text/html,*/*;q=0.8', 'Accept-Language': 'en-IN,en;q=0.9', Referer: 'https://www.espncricinfo.com/' };
const CB_HDR   = { ...HTML_HDR, Referer: 'https://www.cricbuzz.com/', 'sec-fetch-site': 'same-origin' };

async function safeJson(url, hdrs, ms = 10000) {
  try {
    const r = await fetch(url, { headers: hdrs ?? JSON_HDR, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
async function safeText(url, hdrs, ms = 10000) {
  try {
    const r = await fetch(url, { headers: hdrs ?? HTML_HDR, signal: AbortSignal.timeout(ms) });
    if (!r.ok) { console.log(`HTTP ${r.status}: ${url}`); return null; }
    return await r.text();
  } catch (e) { console.log(`fetch err ${url}: ${e.message}`); return null; }
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

// ── HTML strip ────────────────────────────────────────────────────────────
function strip(h = '') {
  return h.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
}

// ── Time windows ──────────────────────────────────────────────────────────
const NOW  = Date.now();
const H1   = 3600000;
const H48  = 48  * H1;
const H72  = 72  * H1;
const H7D  = 7   * 24 * H1;
const H10D = 10  * 24 * H1;

function inWindow(dateStr, state, preMax = H48, postMax = H48) {
  if (!dateStr) return true;
  const t = new Date(dateStr).getTime();
  if (isNaN(t)) return true;
  if (state === 'post' && NOW - t > postMax) return false;
  if (state === 'pre'  && t - NOW > preMax)  return false;
  return true;
}

// ── Parse names from "Roland Garros Mirra Andreeva vs Maja Chwalinska" ────
function parseVsNames(strEvent, rawHome, rawAway) {
  const home = (rawHome ?? '').trim();
  const away = (rawAway ?? '').trim();
  if (home && away) return [home, away];

  const parts = (strEvent ?? '').split(/\s+vs\.?\s+/i);
  if (parts.length < 2) return [home || '?', away || '?'];

  // First part may start with tournament name: "Roland Garros Mirra Andreeva"
  // Take the last 2 words as the player name
  const homeWords = parts[0].trim().split(/\s+/);
  const awayWords = parts[1].trim().split(/\s+/);
  const parsedHome = homeWords.length > 2 ? homeWords.slice(-2).join(' ') : homeWords.join(' ');
  const parsedAway = awayWords.slice(0, 2).join(' ');

  return [home || parsedHome || '?', away || parsedAway || '?'];
}

// ─────────────────────────────────────────────────────────────────────────
// CRICKET A — ESPNCricinfo HTML page (__NEXT_DATA__ embed)
// Fetches https://www.espncricinfo.com/live-cricket-score HTML and extracts
// the Next.js server-side data blob which contains full match list.
// ─────────────────────────────────────────────────────────────────────────
function deepFindMatches(obj, depth = 0) {
  if (!obj || depth > 6) return [];
  if (Array.isArray(obj)) {
    // Check if this looks like a matches array
    if (obj.length > 0 && obj[0]?.objectId && obj[0]?.teams) return obj;
    return obj.flatMap(item => deepFindMatches(item, depth + 1));
  }
  if (typeof obj === 'object') {
    if (obj.objectId && obj.teams) return [obj]; // Single match object
    return Object.values(obj).flatMap(v => deepFindMatches(v, depth + 1));
  }
  return [];
}

function ciState(m) {
  const id  = m.status?.type?.id ?? '';
  const txt = (m.status?.type?.displayText ?? m.status?.displayText ?? '').toLowerCase();
  if (id === 'InProgress' || txt.includes('live') || txt.includes('in progress')) return 'in';
  if (id === 'Finished' || txt.includes('won') || txt.includes('draw') || txt.includes('abandon') || txt.includes('no result')) return 'post';
  return 'pre';
}

function ciToMatch(m, seriesName = '') {
  const state = ciState(m);
  const date  = m.startTime ?? null;
  if (!inWindow(date, state, H7D, H72)) return null; // Cricket: 7d upcoming, 72h results

  const competitors = (m.teams ?? []).map(t => ({
    name:   t.team?.longName ?? t.team?.name ?? '?',
    score:  t.score ? `${t.score.runs ?? ''}/${t.score.wickets ?? ''}${t.score.overs != null ? ` (${t.score.overs} ov)` : ''}` : '',
    winner: state === 'post' && !!t.isWinner,
  }));

  const league  = seriesName || m.series?.name || m.tournament?.name || '';
  const searchT = competitors.map(c => c.name).join(' ') + ' ' + league;
  const id      = m.objectId ?? m.id ?? m.matchId;

  return {
    id: `ci_${id ?? Math.random()}`,
    sport: 'cricket', sportName: 'Cricket', emoji: '🏏',
    match: m.description ?? m.title ?? league ?? 'Cricket',
    league, state, date,
    summary: m.status?.displayText ?? '',
    detail:  m.status?.displayText ?? '',
    clock:   state === 'in' ? '🔴 Live' : '',
    period:  null,
    venue:   m.venue?.name ?? m.ground?.longName ?? '',
    competitors,
    isIndia: isIndia(searchT),
    source: 'espncricinfo',
  };
}

async function fetchCricketHTMLPage() {
  const html = await safeText('https://www.espncricinfo.com/live-cricket-score', HTML_HDR, 12000);
  if (!html || html.length < 500) return [];

  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) { console.log('ESPNCricinfo HTML: __NEXT_DATA__ not found'); return []; }

  try {
    const nextData = JSON.parse(m[1]);
    const rawMatches = deepFindMatches(nextData?.props ?? nextData);
    const deduped    = [...new Map(rawMatches.map(x => [x.objectId, x])).values()];
    const converted  = deduped.map(x => ciToMatch(x, '')).filter(Boolean);
    console.log(`ESPNCricinfo HTML: ${rawMatches.length} raw → ${converted.length} matches`);
    return converted;
  } catch (e) {
    console.log(`ESPNCricinfo HTML parse error: ${e.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CRICKET B — ESPNCricinfo consumer API (multiple slugs)
// ─────────────────────────────────────────────────────────────────────────
function extractCIMatches(json) {
  if (!json) return [];
  if (json.content?.matches?.length) return json.content.matches;
  if (json.matches?.length) return json.matches;
  if (Array.isArray(json.content?.typeMatches)) {
    return json.content.typeMatches.flatMap(t =>
      (t.seriesMatches ?? []).flatMap(s => s.seriesAdWrapper?.matches ?? [])
    );
  }
  return deepFindMatches(json);
}

async function fetchESPNCricinfoAPI() {
  const SLUGS = [
    'live-cricket-score',
    'upcoming-cricket-matches',
    'cricket-results',
    'cricket-ipl',
    'india-cricket',
    'women-cricket',
  ];

  const results = await Promise.allSettled(
    SLUGS.map(slug => safeJson(`${ESPNCI}/matches/home?slug=${slug}`, CI_HDR))
  );

  const seen = new Set();
  const all  = [];

  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    for (const m of extractCIMatches(r.value)) {
      const id = m.objectId ?? m.id;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      const match = ciToMatch(m, '');
      if (match) all.push(match);
    }
  }

  // Series list → matches per series
  const seriesData = await safeJson(`${ESPNCI}/series/list?lang=en&hasFixtures=true`, CI_HDR);
  const seriesList = seriesData?.content?.series ?? seriesData?.series ?? [];
  console.log(`ESPNCricinfo API: ${all.length} slug matches + ${seriesList.length} series`);

  if (seriesList.length) {
    const fetches = seriesList.slice(0, 20).map(s =>
      safeJson(`${ESPNCI}/series/matches?lang=en&seriesId=${s.objectId}`, CI_HDR)
        .then(r => ({ name: s.description || s.name || '', matches: extractCIMatches(r) }))
    );
    const sr = await Promise.allSettled(fetches);
    for (const r of sr) {
      if (r.status !== 'fulfilled') continue;
      for (const m of r.value.matches) {
        const id = m.objectId ?? m.id;
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        const match = ciToMatch(m, r.value.name);
        if (match) all.push(match);
      }
    }
  }

  console.log(`ESPNCricinfo API total: ${all.length}`);
  return all;
}

// ─────────────────────────────────────────────────────────────────────────
// CRICKET C — ESPN cricket scoreboard (espn.com/cricket/scores)
// ─────────────────────────────────────────────────────────────────────────
function espnCricketToMatch(ev) {
  const comp = ev?.competitions?.[0];
  if (!comp) return null;
  const state = comp.status?.type?.state ?? 'post';
  const date  = comp.date ?? ev.date ?? null;
  if (!inWindow(date, state, H7D, H72)) return null;

  const competitors = (comp.competitors ?? []).map(c => ({
    name:   c.team?.displayName || c.team?.abbreviation || '?',
    score:  c.score ?? '',
    winner: c.winner === 'true' || c.winner === true,
  }));
  const searchT = competitors.map(c => c.name).join(' ') + ' ' + (ev.name || '');

  return {
    id: `espnc_${ev.id}`,
    sport: 'cricket', sportName: 'Cricket', emoji: '🏏',
    match:  ev.shortName || ev.name || '',
    league: ev.season?.displayName || comp.notes?.[0]?.headline || '',
    state, date,
    summary: comp.status?.summary ?? '',
    detail:  comp.status?.type?.detail ?? '',
    clock:   state === 'in' ? '🔴 Live' : '',
    period:  comp.status?.period ?? null,
    venue:   comp.venue?.fullName ?? '',
    competitors,
    isIndia: isIndia(searchT),
    source:  'espn_cricket',
  };
}

async function fetchESPNCricketAPI() {
  const BASE = `${ESPN}/cricket`;
  const [ind, gen] = await Promise.all([
    safeJson(`${BASE}/scoreboard?region=in&lang=en-in`),
    safeJson(`${BASE}/scoreboard`),
  ]);

  let events = [...(ind?.events ?? []), ...(gen?.events ?? [])];

  // Discover and fetch all available leagues
  const lg  = await safeJson(`${BASE}/leagues`);
  const ids = (lg?.leagues ?? []).map(l => l.id).filter(Boolean);
  if (ids.length) {
    const rs = await Promise.allSettled(ids.slice(0, 15).map(id => safeJson(`${BASE}/${id}/scoreboard`)));
    events.push(...rs.flatMap(r => r.status === 'fulfilled' ? r.value?.events ?? [] : []));
  }

  const seen = new Set();
  const matches = [];
  for (const ev of events) {
    if (!ev?.id || seen.has(ev.id)) continue;
    seen.add(ev.id);
    const m = espnCricketToMatch(ev);
    if (m) matches.push(m);
  }

  console.log(`ESPN cricket API: ${matches.length}`);
  return matches;
}

// ─────────────────────────────────────────────────────────────────────────
// CRICKET D — Cricbuzz HTML (may be blocked from datacenter IPs)
// ─────────────────────────────────────────────────────────────────────────
function parseCricbuzzHtml(html, fallbackState) {
  if (!html || html.length < 200) return [];
  const matches = [];

  const seriesRe = /class="[^"]*cb-lst-mtch-hdr[^"]*"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g;
  const seriesPos = [];
  let sh;
  while ((sh = seriesRe.exec(html)) !== null) seriesPos.push({ pos: sh.index, name: strip(sh[1]) });

  const blockRe = /<a[^>]+class="[^"]*block-element[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let bm;
  while ((bm = blockRe.exec(html)) !== null) {
    const href = bm[1], inner = bm[2], pos = bm.index;
    const idM  = href.match(/\/(\d+)\//);
    if (!idM) continue;

    const series = seriesPos.filter(s => s.pos < pos).at(-1)?.name ?? '';

    const teamRe = /class="[^"]*cb-col-60[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]{0,500}?class="[^"]*cb-tms-scr[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    const teams = [];
    let tm;
    while ((tm = teamRe.exec(inner)) !== null && teams.length < 2) {
      const n = strip(tm[1]), s = strip(tm[2]);
      if (n) teams.push({ name: n, score: s });
    }
    if (!teams.length) continue;

    const stM   = /class="[^"]*cb-min-stts[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(inner);
    const stTxt = strip(stM?.[1] ?? '');
    const clsM  = /cb-text-(\w+)/.exec(inner);
    const cls   = clsM?.[1] ?? '';

    const state = cls === 'inprogress' ? 'in'
      : (cls === 'complete' || cls === 'winning') ? 'post'
      : cls === 'scheduled' ? 'pre'
      : fallbackState;

    const searchT = teams.map(t => t.name).join(' ') + ' ' + series;
    matches.push({
      id: `cb_${idM[1]}`, sport: 'cricket', sportName: 'Cricket', emoji: '🏏',
      match:  teams.length >= 2 ? `${teams[0].name} vs ${teams[1].name}` : teams[0].name,
      league: series, state, date: null,
      summary: stTxt, detail: stTxt,
      clock: state === 'in' ? '🔴 Live' : '',
      period: null, venue: '',
      competitors: teams.map(t => ({ name: t.name, score: t.score, winner: false })),
      isIndia: isIndia(searchT),
      source: 'cricbuzz',
    });
  }
  return matches;
}

async function fetchCricbuzz() {
  const [lHtml, uHtml, rHtml] = await Promise.all([
    safeText(CB, CB_HDR),
    safeText(`${CB}/upcoming`, CB_HDR),
    safeText(`${CB}/recent`, CB_HDR),
  ]);
  const live = parseCricbuzzHtml(lHtml, 'in');
  const up   = parseCricbuzzHtml(uHtml, 'pre');
  const rec  = parseCricbuzzHtml(rHtml, 'post');
  console.log(`Cricbuzz: ${live.length} live | ${up.length} upcoming | ${rec.length} recent`);
  return [...live, ...up, ...rec];
}

// ─────────────────────────────────────────────────────────────────────────
// Sports DB helpers
// ─────────────────────────────────────────────────────────────────────────
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

function sdbToMatch(ev, overrideSport) {
  const sport = overrideSport ?? ev.strSport ?? 'Unknown';
  const meta  = SDB_META[sport] ?? { key: sport.toLowerCase().replace(/\s+/g,''), name: sport, emoji: '🏅' };

  const stTxt = ((ev.strStatus ?? '') + ' ' + (ev.strProgress ?? '')).toLowerCase();
  const isLive     = stTxt.includes('live') || stTxt.includes('inning') || stTxt.includes('progress') || stTxt.includes('quarter') || stTxt.includes('half') || stTxt.includes('set ');
  const isDoneText = !isLive && (stTxt.includes('finish') || stTxt.includes('complet') || stTxt.includes('result') || stTxt.includes('final') || stTxt.includes('won'));
  const hasBothScores = ev.intHomeScore != null && ev.intAwayScore != null;

  const dateStr = ev.strTimestamp
    ?? (ev.dateEvent && ev.strTime ? `${ev.dateEvent}T${ev.strTime}+00:00` : null)
    ?? (ev.dateEvent ? `${ev.dateEvent}T00:00:00Z` : null);
  const evTime = dateStr ? new Date(dateStr).getTime() : null;
  const isPast = evTime != null && evTime < NOW - H1;

  // Key fix: completed matches with empty status but past date → 'post'
  const state = isLive ? 'in'
    : (isDoneText || hasBothScores || isPast) ? 'post'
    : 'pre';

  const preMax  = sport === 'Cricket' ? H7D  : H48;
  const postMax = sport === 'Cricket' ? H72  : H48;
  if (!inWindow(dateStr, state, preMax, postMax)) return null;

  const hs = ev.intHomeScore != null ? String(ev.intHomeScore) : '';
  const as = ev.intAwayScore != null ? String(ev.intAwayScore) : '';
  const hw = state === 'post' && Number(ev.intHomeScore) > Number(ev.intAwayScore);
  const aw = state === 'post' && Number(ev.intAwayScore) > Number(ev.intHomeScore);

  // Fix "?" names: parse from strEvent for individual sports (tennis, badminton, boxing)
  const [homeName, awayName] = parseVsNames(ev.strEvent, ev.strHomeTeam, ev.strAwayTeam);

  const searchT = [homeName, awayName, ev.strLeague, ev.strSport].join(' ');

  return {
    id:       `sdb_${ev.idEvent}`,
    sport:    meta.key,
    sportName: meta.name,
    emoji:    meta.emoji,
    match:    ev.strEvent || `${homeName} vs ${awayName}`,
    league:   ev.strLeague || ev.strSeason || '',
    state, date: dateStr,
    summary:  ev.strResult || (isLive ? ev.strProgress || 'Live' : ev.strStatus || ''),
    detail:   ev.strProgress || '',
    clock:    isLive ? '🔴 Live' : '',
    period:   null,
    venue:    ev.strVenue || ev.strCountry || '',
    competitors: [
      { name: homeName, score: hs, winner: hw },
      { name: awayName, score: as, winner: aw },
    ],
    isIndia: isIndia(searchT),
    source:  'sdb',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// CRICKET E+F — Sports DB cricket: today ±1 day + India team events
// ─────────────────────────────────────────────────────────────────────────
async function fetchSDBCricket() {
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(NOW - 86400000).toISOString().slice(0, 10);
  const tmrw  = new Date(NOW + 86400000).toISOString().slice(0, 10);

  // Day-based fetches for cricket (7-day window used in sdbToMatch)
  const dayFetches = [yest, today, tmrw].map(d =>
    safeJson(`${SDB}/eventsday.php?d=${d}&s=Cricket`).then(r => r?.events ?? [])
  );

  // India cricket team specific
  const teamData  = await safeJson(`${SDB}/searchteams.php?t=India`);
  const indiaTeam = (teamData?.teams ?? []).find(t => {
    const n = (t.strTeam ?? '').toLowerCase();
    return (n === 'india' || n === 'india cricket') && (t.strSport ?? '').toLowerCase() === 'cricket';
  });

  const teamFetches = indiaTeam ? [
    safeJson(`${SDB}/eventsnext.php?id=${indiaTeam.idTeam}`).then(r => r?.events ?? []),
    safeJson(`${SDB}/eventslast.php?id=${indiaTeam.idTeam}`).then(r => r?.events ?? []),
  ] : [];

  const results = await Promise.allSettled([...dayFetches, ...teamFetches]);
  const seen = new Set();
  const events = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const ev of r.value) {
      if (!ev?.idEvent || seen.has(ev.idEvent)) continue;
      seen.add(ev.idEvent);
      const m = sdbToMatch(ev, 'Cricket');
      if (m) events.push(m);
    }
  }

  console.log(`SDB Cricket: ${events.length}`);
  return events;
}

// ─────────────────────────────────────────────────────────────────────────
// OTHER SPORTS G — Sports DB India team search (all sports except cricket)
// ─────────────────────────────────────────────────────────────────────────
async function fetchIndiaSportsDB() {
  const data  = await safeJson(`${SDB}/searchteams.php?t=India`);
  const teams = (data?.teams ?? []).filter(t => {
    const n    = (t.strTeam ?? '').toLowerCase();
    const sport = (t.strSport ?? '').toLowerCase();
    return sport !== 'cricket' && // Cricket handled separately above
      (n === 'india' || n.startsWith('india ') || n.endsWith(' india') || n.includes(' india '));
  }).slice(0, 25);

  console.log(`SDB India non-cricket teams: ${teams.length}`);

  const fetches = teams.flatMap(team => [
    safeJson(`${SDB}/eventsnext.php?id=${team.idTeam}`).then(r => r?.events ?? []),
    safeJson(`${SDB}/eventslast.php?id=${team.idTeam}`).then(r => r?.events ?? []),
  ]);
  const results = await Promise.allSettled(fetches);
  const seen = new Set();
  const events = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const ev of r.value) {
      if (!ev?.idEvent || seen.has(ev.idEvent)) continue;
      seen.add(ev.idEvent);
      const m = sdbToMatch(ev);
      if (m) events.push(m);
    }
  }

  console.log(`SDB India non-cricket events: ${events.length}`);
  return events;
}

// ─────────────────────────────────────────────────────────────────────────
// OTHER SPORTS H — Sports DB today ±1 day (non-cricket broad coverage)
// ─────────────────────────────────────────────────────────────────────────
async function fetchSportsDBToday() {
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(NOW - 86400000).toISOString().slice(0, 10);
  const tmrw  = new Date(NOW + 86400000).toISOString().slice(0, 10);

  const SPORTS = ['Soccer', 'Field Hockey', 'Badminton', 'Kabaddi', 'Tennis', 'Rugby', 'Basketball', 'Wrestling', 'Table Tennis', 'Volleyball', 'Boxing'];
  const fetches = SPORTS.flatMap(sport =>
    [yest, today, tmrw].map(d =>
      safeJson(`${SDB}/eventsday.php?d=${d}&s=${encodeURIComponent(sport)}`).then(r => ({ sport, evs: r?.events ?? [] }))
    )
  );

  const results = await Promise.allSettled(fetches);
  const seen = new Set();
  const events = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const ev of r.value.evs) {
      if (!ev?.idEvent || seen.has(ev.idEvent)) continue;
      seen.add(ev.idEvent);
      const m = sdbToMatch(ev, r.value.sport);
      if (m) events.push(m);
    }
  }

  console.log(`SDB today: ${events.length}`);
  return events;
}

// ─────────────────────────────────────────────────────────────────────────
// OTHER SPORTS I — ESPN F1 + Golf (10-day window)
// ─────────────────────────────────────────────────────────────────────────
async function fetchESPN() {
  const SPORTS = [
    { key: 'f1',   path: 'racing/f1', name: 'Formula 1', emoji: '🏎️' },
    { key: 'golf', path: 'golf',      name: 'Golf',       emoji: '⛳' },
  ];
  const events = [];

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
        .map(c => ({ name: c.athlete?.shortName || c.athlete?.displayName || c.team?.shortDisplayName || c.team?.abbreviation || '?', score: c.score ?? '', winner: c.winner === 'true' || c.winner === true, order: Number(c.order ?? 99) }))
        .sort((a, b) => a.order - b.order).slice(0, 10);
      events.push({
        id: `espn_${ev.id}`, sport: s.key, sportName: s.name, emoji: s.emoji,
        match: ev.shortName || ev.name || '', league: ev.season?.displayName || '',
        state, date,
        summary: comp.status?.summary ?? '', detail: comp.status?.type?.detail ?? '',
        clock: state === 'in' ? '🔴 Live' : '', period: comp.status?.period ?? null,
        venue: comp.venue?.fullName ?? '', competitors, isIndia: false, source: 'espn',
      });
    }
  }

  console.log(`ESPN F1+Golf: ${events.length}`);
  return events;
}

// ─────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=360');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // All sources in parallel
  const [
    ciHtmlEvents,   // A: ESPNCricinfo HTML page
    ciApiEvents,    // B: ESPNCricinfo consumer API
    espnCricket,    // C: ESPN cricket API
    cbEvents,       // D: Cricbuzz HTML
    sdbCricket,     // E+F: SportsDB cricket
    indiaSDB,       // G: SportsDB India non-cricket
    todaySDB,       // H: SportsDB today broad
    espnEvents,     // I: ESPN F1 + Golf
  ] = await Promise.all([
    fetchCricketHTMLPage(),
    fetchESPNCricinfoAPI(),
    fetchESPNCricketAPI(),
    fetchCricbuzz(),
    fetchSDBCricket(),
    fetchIndiaSportsDB(),
    fetchSportsDBToday(),
    fetchESPN(),
  ]);

  const seen = new Set();
  const all  = [];
  const add  = (evs) => { for (const ev of evs) { if (!ev?.id || seen.has(ev.id)) continue; seen.add(ev.id); all.push(ev); } };

  // Cricket first — best source wins, dedup prevents duplicates
  add(ciHtmlEvents);
  add(ciApiEvents);
  add(espnCricket);
  add(cbEvents);
  add(sdbCricket);

  // Other sports
  add(indiaSDB);
  add(todaySDB);
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

  const live     = all.filter(m => m.state === 'in');
  const upcoming = all.filter(m => m.state === 'pre');
  const completed = all.filter(m => m.state === 'post');
  const india    = all.filter(m => m.isIndia);

  const sc = {};
  all.forEach(m => { sc[m.sport] = (sc[m.sport] ?? 0) + 1; });
  console.log(`TOTAL: ${all.length} | India: ${india.length} | live:${live.length} upcoming:${upcoming.length} completed:${completed.length}`);
  console.log(`Sports: ${Object.entries(sc).map(([k,v])=>`${k}:${v}`).join(' ')}`);

  return res.status(200).json({
    matches: all, live, upcoming, completed,
    counts: { live: live.length, upcoming: upcoming.length, completed: completed.length },
  });
}
