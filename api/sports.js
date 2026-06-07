/**
 * /api/sports — India-first multi-source sports data
 *
 * Cricket sources (in priority order):
 *  1. Cricbuzz HTML API  — /api/html/livescores + /upcoming + /recent
 *     The same feed that powers cricbuzz.com — most complete India coverage
 *  2. ESPNCricinfo live  — /v1/pages/matches/home?slug=live-cricket-score
 *     Same data that powers espncricinfo.com/live-cricket-score
 *  3. ESPNCricinfo series list — all active series → matches per series
 *
 * Other sports:
 *  4. Sports DB: search all "India" teams → next+last 5 events each team
 *     Covers Hockey, Football, Kabaddi, Badminton, Wrestling, etc.
 *  5. Sports DB: today ±1 day for 12 sports (broad international fallback)
 *  6. ESPN: F1 + Golf only
 *
 * India matches sorted first in every tab. CDN cache: 3 min.
 */

const ESPNCI = 'https://hs-consumer-api.espncricinfo.com/v1/pages';
const ESPN   = 'https://site.api.espn.com/apis/site/v2/sports';
const SDB    = 'https://www.thesportsdb.com/api/v1/json/3';
const CB     = 'https://www.cricbuzz.com/api/html/livescores';

// ── Shared fetch helpers ───────────────────────────────────────────────────
const JSON_HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
};
const HTML_HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,*/*',
  'Accept-Language': 'en-IN,en;q=0.9',
  Referer: 'https://www.cricbuzz.com/',
};

async function safeJson(url, ms = 10000) {
  try {
    const r = await fetch(url, { headers: JSON_HDR, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function safeText(url, ms = 10000) {
  try {
    const r = await fetch(url, { headers: HTML_HDR, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

// ── India detection ────────────────────────────────────────────────────────
const INDIA_KW = [
  'india', 'indian', ' ind ', 'ipl ', 'ipl2', 'bcci',
  'csk', 'chennai super', 'mumbai indians', 'kolkata knight', 'kkr',
  'royal challengers', 'rcb', 'delhi capitals', 'pbks', 'punjab kings',
  'gujarat titans', 'gt ', 'sunrisers hyderabad', 'srh', 'lucknow super', 'lsg',
  'rajasthan royals', 'rr ',
  'isl', 'i-league', 'hockeyindia', 'fih india',
  'pro kabaddi', 'pkl', 'premier badminton league',
  'india women', 'india a', 'india u19', 'india u23',
];

function isIndia(text = '') {
  const t = (' ' + text + ' ').toLowerCase();
  return INDIA_KW.some(k => t.includes(k));
}

// ── HTML strip helper ──────────────────────────────────────────────────────
function strip(html = '') {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

// ── Time helpers ───────────────────────────────────────────────────────────
const NOW = Date.now();
const H48 = 48 * 60 * 60 * 1000;

function withinWindow(dateStr, state) {
  if (!dateStr) return true;
  const t = new Date(dateStr).getTime();
  if (isNaN(t)) return true;
  if (state === 'post' && NOW - t > H48) return false;
  if (state === 'pre'  && t - NOW > H48) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 1: Cricbuzz HTML scraping
// Endpoints:
//   /api/html/livescores          → live now
//   /api/html/livescores/upcoming → upcoming / scheduled
//   /api/html/livescores/recent   → completed
// ─────────────────────────────────────────────────────────────────────────
function parseCricbuzzHtml(html, fallbackState) {
  if (!html || html.length < 100) return [];
  const matches = [];

  // Find all series headers
  const seriesHeaderRe = /class="[^"]*cb-lst-mtch-hdr[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g;
  const seriesPositions = [];
  let sh;
  while ((sh = seriesHeaderRe.exec(html)) !== null) {
    seriesPositions.push({ pos: sh.index, name: strip(sh[1]) });
  }

  // Find all match blocks (block-element anchors)
  const blockRe = /<a[^>]+class="[^"]*block-element[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let bm;
  while ((bm = blockRe.exec(html)) !== null) {
    const href    = bm[1];
    const inner   = bm[2];
    const matchPos = bm.index;

    // Pick the most recent series header before this match
    const series = seriesPositions.filter(s => s.pos < matchPos).at(-1)?.name ?? '';

    // Extract match ID from href
    const idMatch = href.match(/\/(\d+)\//);
    if (!idMatch) continue;
    const matchId = idMatch[1];

    // Extract team name + score pairs
    // Pattern: cb-col-60 (team name) ... cb-tms-scr (score)
    const teamRe  = /class="[^"]*cb-col-60[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]{0,400}?class="[^"]*cb-tms-scr[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    const teams   = [];
    let tm;
    while ((tm = teamRe.exec(inner)) !== null && teams.length < 2) {
      const name  = strip(tm[1]);
      const score = strip(tm[2]);
      if (name) teams.push({ name, score });
    }

    // Extract status text + state class
    const statusRe    = /class="[^"]*cb-min-stts[^"]*"[^>]*>([\s\S]*?)<\/div>/;
    const statusMatch  = statusRe.exec(inner);
    const statusText   = strip(statusMatch?.[1] ?? '');
    const stateClassM  = /cb-text-(\w+)/.exec(inner);
    const stateClass   = stateClassM?.[1] ?? '';

    const state = stateClass === 'inprogress' ? 'in'
      : (stateClass === 'complete' || stateClass === 'winning') ? 'post'
      : stateClass === 'scheduled' ? 'pre'
      : fallbackState;

    if (!teams.length) continue;

    const matchTitle = teams.length >= 2
      ? `${teams[0].name} vs ${teams[1].name}`
      : teams[0].name;

    const searchTxt = teams.map(t => t.name).join(' ') + ' ' + series;

    matches.push({
      id:          `cb_${matchId}`,
      sport:       'cricket',
      sportName:   'Cricket',
      emoji:       '🏏',
      match:       matchTitle,
      league:      series,
      state,
      date:        null,
      summary:     statusText,
      detail:      statusText,
      clock:       state === 'in' ? '🔴 Live' : '',
      period:      null,
      venue:       '',
      competitors: teams.map(t => ({
        name:   t.name,
        score:  t.score,
        winner: false,
      })),
      isIndia: isIndia(searchTxt),
      source:  'cricbuzz',
    });
  }

  return matches;
}

async function fetchCricbuzz() {
  const [liveHtml, upcomingHtml, recentHtml] = await Promise.all([
    safeText(CB),
    safeText(`${CB}/upcoming`),
    safeText(`${CB}/recent`),
  ]);

  const liveMatches     = parseCricbuzzHtml(liveHtml, 'in');
  const upcomingMatches = parseCricbuzzHtml(upcomingHtml, 'pre');
  const recentMatches   = parseCricbuzzHtml(recentHtml, 'post');

  const all = [...liveMatches, ...upcomingMatches, ...recentMatches];
  console.log(`Cricbuzz: ${liveMatches.length} live | ${upcomingMatches.length} upcoming | ${recentMatches.length} recent`);
  return all;
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 2+3: ESPNCricinfo
// ─────────────────────────────────────────────────────────────────────────
function ciMatchToInternal(m, seriesName = '') {
  const state = m.status?.type?.id === 'InProgress' ? 'in'
    : m.status?.type?.id === 'Finished' ? 'post' : 'pre';
  const date  = m.startTime ?? null;
  if (!withinWindow(date, state)) return null;

  const competitors = (m.teams ?? []).map(t => ({
    name:   t.team?.longName ?? t.team?.name ?? '?',
    score:  t.score ? `${t.score.runs ?? ''}/${t.score.wickets ?? ''}${t.score.overs ? ` (${t.score.overs} ov)` : ''}` : '',
    winner: state === 'post' && !!t.isWinner,
  }));

  const searchTxt = competitors.map(c => c.name).join(' ') + ' ' + seriesName;

  return {
    id:          `ci_${m.objectId ?? m.id ?? Math.random()}`,
    sport:       'cricket',
    sportName:   'Cricket',
    emoji:       '🏏',
    match:       m.description ?? m.title ?? seriesName ?? 'Cricket',
    league:      seriesName || m.series?.name || '',
    state,
    date,
    summary:     m.status?.displayText ?? '',
    detail:      m.status?.displayText ?? '',
    clock:       state === 'in' ? '🔴 Live' : '',
    period:      null,
    venue:       m.venue?.name ?? m.ground?.longName ?? '',
    competitors,
    isIndia:     isIndia(searchTxt),
    source:      'espncricinfo',
  };
}

async function fetchESPNCricinfo() {
  const all = [];

  // Live page (same feed as espncricinfo.com/live-cricket-score)
  const livePage = await safeJson(`${ESPNCI}/matches/home?slug=live-cricket-score`);
  const liveMatches = livePage?.content?.matches ?? livePage?.matches ?? [];
  for (const m of liveMatches) {
    const match = ciMatchToInternal(m, '');
    if (match) all.push(match);
  }
  console.log(`ESPNCricinfo live page: ${liveMatches.length} matches`);

  // Series list → fetch matches for each active series
  const seriesData = await safeJson(`${ESPNCI}/series/list?lang=en&hasFixtures=true`);
  const seriesList = seriesData?.content?.series ?? seriesData?.series ?? [];
  console.log(`ESPNCricinfo series list: ${seriesList.length} active series`);

  if (seriesList.length > 0) {
    const fetches = seriesList.slice(0, 20).map(s =>
      safeJson(`${ESPNCI}/series/matches?lang=en&seriesId=${s.objectId}`)
        .then(r => ({ name: s.description || s.name || '', matches: r?.content?.matches ?? r?.matches ?? [] }))
    );
    const results = await Promise.allSettled(fetches);
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const m of r.value.matches) {
        const match = ciMatchToInternal(m, r.value.name);
        if (match) all.push(match);
      }
    }
  }

  return all;
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 4: Sports DB — all "India" named teams → their events
// ─────────────────────────────────────────────────────────────────────────
const SDB_SPORT_META = {
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

function sdbEventToMatch(ev, overrideSport) {
  const sport = overrideSport ?? ev.strSport ?? 'Unknown';
  const meta  = SDB_SPORT_META[sport] ?? { key: sport.toLowerCase().replace(/\s+/g, ''), name: sport, emoji: '🏅' };

  const s = ((ev.strStatus ?? '') + ' ' + (ev.strProgress ?? '')).toLowerCase();
  const isLive = s.includes('live') || s.includes('inning') || s.includes(' ov') || s.includes('progress') || s.includes('quarter') || s.includes('half') || s.includes('set ');
  const isDone = !isLive && (s.includes('finish') || s.includes('complet') || s.includes('result') || s.includes('final') || (ev.intHomeScore != null && ev.intAwayScore != null && (ev.strStatus ?? '').length > 1));
  const state  = isLive ? 'in' : isDone ? 'post' : 'pre';

  const dateStr = ev.strTimestamp
    ?? (ev.dateEvent && ev.strTime ? `${ev.dateEvent}T${ev.strTime}+00:00` : null)
    ?? (ev.dateEvent ? `${ev.dateEvent}T00:00:00Z` : null);

  if (!withinWindow(dateStr, state)) return null;

  const hs = ev.intHomeScore != null ? String(ev.intHomeScore) : '';
  const as = ev.intAwayScore != null ? String(ev.intAwayScore) : '';
  const hw = state === 'post' && Number(ev.intHomeScore) > Number(ev.intAwayScore);
  const aw = state === 'post' && Number(ev.intAwayScore) > Number(ev.intHomeScore);

  const searchTxt = [ev.strHomeTeam, ev.strAwayTeam, ev.strLeague, ev.strSport].join(' ');

  return {
    id:          `sdb_${ev.idEvent}`,
    sport:       meta.key,
    sportName:   meta.name,
    emoji:       meta.emoji,
    match:       ev.strEvent || `${ev.strHomeTeam || '?'} vs ${ev.strAwayTeam || '?'}`,
    league:      ev.strLeague || ev.strSeason || '',
    state,
    date:        dateStr,
    summary:     ev.strResult || (isLive ? (ev.strProgress || 'Live') : ev.strStatus || ''),
    detail:      ev.strProgress || '',
    clock:       isLive ? '🔴 Live' : '',
    period:      null,
    venue:       ev.strVenue || ev.strCountry || '',
    competitors: [
      { name: ev.strHomeTeam || '?', score: hs, winner: hw },
      { name: ev.strAwayTeam || '?', score: as, winner: aw },
    ],
    isIndia: isIndia(searchTxt),
    source:  'sdb',
  };
}

async function fetchIndiaSportsDB() {
  const data  = await safeJson(`${SDB}/searchteams.php?t=India`);
  const teams = (data?.teams ?? []).filter(t => {
    const n = (t.strTeam ?? '').toLowerCase();
    return n === 'india' || n.startsWith('india ') || n.endsWith(' india') || n.includes(' india ');
  }).slice(0, 25);

  console.log(`SportsDB India teams: ${teams.length}`);

  const fetches = teams.flatMap(team => [
    safeJson(`${SDB}/eventsnext.php?id=${team.idTeam}`).then(r => r?.events ?? []),
    safeJson(`${SDB}/eventslast.php?id=${team.idTeam}`).then(r => r?.events ?? []),
  ]);

  const results = await Promise.allSettled(fetches);
  const seen    = new Set();
  const events  = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const ev of r.value) {
      if (!ev?.idEvent || seen.has(ev.idEvent)) { seen.add(ev?.idEvent); continue; }
      seen.add(ev.idEvent);
      const m = sdbEventToMatch(ev);
      if (m) events.push(m);
    }
  }

  console.log(`SportsDB India events: ${events.length}`);
  return events;
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 5: Sports DB — today ±1 day broad coverage
// ─────────────────────────────────────────────────────────────────────────
async function fetchSportsDBToday() {
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(NOW - 86400000).toISOString().slice(0, 10);
  const tmrw  = new Date(NOW + 86400000).toISOString().slice(0, 10);

  const SPORTS_TODAY = ['Soccer', 'Field Hockey', 'Badminton', 'Kabaddi', 'Tennis', 'Rugby', 'Basketball', 'Wrestling', 'Table Tennis', 'Volleyball', 'Boxing'];
  const dates = [yest, today, tmrw];

  const fetches = SPORTS_TODAY.flatMap(sport =>
    dates.map(d => safeJson(`${SDB}/eventsday.php?d=${d}&s=${encodeURIComponent(sport)}`).then(r => ({ sport, events: r?.events ?? [] })))
  );

  const results = await Promise.allSettled(fetches);
  const seen    = new Set();
  const events  = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const ev of r.value.events) {
      if (!ev?.idEvent || seen.has(ev.idEvent)) { seen.add(ev?.idEvent); continue; }
      seen.add(ev.idEvent);
      const m = sdbEventToMatch(ev, r.value.sport);
      if (m) events.push(m);
    }
  }

  console.log(`SportsDB today: ${events.length}`);
  return events;
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 6: ESPN cricket — same feed as espn.com/cricket/scores
// Try India region first, then general scoreboard, then discover leagues
// ─────────────────────────────────────────────────────────────────────────
function espnCricketToMatch(ev) {
  const comp = ev?.competitions?.[0];
  if (!comp) return null;
  const state  = comp.status?.type?.state ?? 'post';
  const date   = comp.date ?? ev.date ?? null;
  if (!withinWindow(date, state)) return null;

  const competitors = (comp.competitors ?? []).map(c => ({
    name:   c.team?.displayName || c.team?.abbreviation || '?',
    score:  c.score ?? '',
    winner: c.winner === 'true' || c.winner === true,
  }));

  const searchTxt = competitors.map(c => c.name).join(' ') + ' ' + (ev.name || '');

  return {
    id:          `espn_c_${ev.id}`,
    sport:       'cricket',
    sportName:   'Cricket',
    emoji:       '🏏',
    match:       ev.shortName || ev.name || '',
    league:      ev.season?.displayName || comp.notes?.[0]?.headline || '',
    state,
    date,
    summary:     comp.status?.summary ?? '',
    detail:      comp.status?.type?.detail ?? '',
    clock:       state === 'in' ? '🔴 Live' : '',
    period:      comp.status?.period ?? null,
    venue:       comp.venue?.fullName ?? '',
    competitors,
    isIndia:     isIndia(searchTxt),
    source:      'espn_cricket',
  };
}

async function fetchESPNCricketScores() {
  const BASE = `${ESPN}/cricket`;

  // Try India-region scoreboard (same data as espn.in/cricket)
  const [indiaReg, general] = await Promise.all([
    safeJson(`${BASE}/scoreboard?region=in&lang=en-in`),
    safeJson(`${BASE}/scoreboard`),
  ]);

  let events = [
    ...(indiaReg?.events ?? []),
    ...(general?.events ?? []),
  ];

  // If still empty, discover leagues and fetch each
  if (events.length === 0) {
    const lg  = await safeJson(`${BASE}/leagues`);
    const ids = (lg?.leagues ?? []).map(l => l.id).filter(Boolean);
    if (ids.length) {
      const rs = await Promise.allSettled(ids.slice(0, 12).map(id => safeJson(`${BASE}/${id}/scoreboard`)));
      events = rs.flatMap(r => r.status === 'fulfilled' ? r.value?.events ?? [] : []);
    }
  }

  const matches = events.map(espnCricketToMatch).filter(Boolean);
  console.log(`ESPN cricket: ${matches.length} matches`);
  return matches;
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 7: ESPN — F1 + Golf
// ─────────────────────────────────────────────────────────────────────────
async function fetchESPN() {
  const SPORTS = [
    { key: 'f1', path: 'racing/f1', name: 'Formula 1', emoji: '🏎️' },
    { key: 'golf', path: 'golf', name: 'Golf', emoji: '⛳' },
  ];
  const events = [];

  for (const s of SPORTS) {
    const base = `${ESPN}/${s.path}`;
    let raw = await safeJson(`${base}/scoreboard`);
    if (!raw?.events?.length) {
      const lg  = await safeJson(`${base}/leagues`);
      const ids = (lg?.leagues ?? []).map(l => l.id).filter(Boolean).slice(0, 4);
      if (ids.length) {
        const rs = await Promise.allSettled(ids.map(id => safeJson(`${base}/${id}/scoreboard`)));
        raw = { events: rs.flatMap(r => r.status === 'fulfilled' ? r.value?.events ?? [] : []) };
      }
    }
    for (const ev of raw?.events ?? []) {
      const comp = ev?.competitions?.[0];
      if (!comp) continue;
      const state  = comp.status?.type?.state ?? 'post';
      const date   = comp.date ?? ev.date ?? null;
      if (!withinWindow(date, state)) continue;
      const competitors = (comp.competitors ?? [])
        .map(c => ({
          name:   c.athlete?.shortName || c.team?.shortDisplayName || c.team?.abbreviation || '?',
          score:  c.score ?? '',
          winner: c.winner === 'true' || c.winner === true,
          order:  Number(c.order ?? 99),
        }))
        .sort((a, b) => a.order - b.order)
        .slice(0, 5);
      events.push({
        id: `espn_${ev.id}`, sport: s.key, sportName: s.name, emoji: s.emoji,
        match: ev.shortName || ev.name || '', league: ev.season?.displayName || '',
        state, date, summary: comp.status?.summary ?? '', detail: comp.status?.type?.detail ?? '',
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
  const [cricbuzzEvents, cricInfoEvents, espnCricketEvents, indiaSDBEvents, todaySDBEvents, espnEvents] = await Promise.all([
    fetchCricbuzz(),
    fetchESPNCricinfo(),
    fetchESPNCricketScores(),
    fetchIndiaSportsDB(),
    fetchSportsDBToday(),
    fetchESPN(),
  ]);

  // Merge — deduplicate by id, cricket first
  const seen = new Set();
  const all  = [];

  const add = (evs) => {
    for (const ev of evs) {
      if (!ev?.id || seen.has(ev.id)) continue;
      seen.add(ev.id);
      all.push(ev);
    }
  };

  // Cricket: Cricbuzz first (most complete) → ESPNCricinfo → ESPN cricket
  add(cricbuzzEvents);
  add(cricInfoEvents);
  add(espnCricketEvents);

  // Other sports
  add(indiaSDBEvents);
  add(todaySDBEvents);
  add(espnEvents);

  // Sort: live → upcoming(soonest) → completed(most-recent)
  //       within each state: India first, then by date
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

  const sportCounts = {};
  all.forEach(m => { sportCounts[m.sport] = (sportCounts[m.sport] ?? 0) + 1; });
  const indiaCount = all.filter(m => m.isIndia).length;

  console.log(`TOTAL: ${all.length} | India: ${indiaCount} | live:${live.length} upcoming:${upcoming.length} completed:${completed.length}`);
  console.log(`Sports: ${Object.entries(sportCounts).map(([k,v]) => `${k}:${v}`).join(' ')}`);

  return res.status(200).json({
    matches: all, live, upcoming, completed,
    counts:  { live: live.length, upcoming: upcoming.length, completed: completed.length },
  });
}
