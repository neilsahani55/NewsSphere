/**
 * /api/sports — India-first multi-source sports data
 *
 * Cricket (priority order — first non-empty wins then all are merged):
 *  1. ESPNCricinfo consumer API — live / upcoming / results slugs
 *     (powers espncricinfo.com/live-cricket-score — same feed)
 *  2. ESPNCricinfo series list  — all active series → per-series matches
 *  3. ESPN cricket scoreboard   — India region + general + league discovery
 *     (powers espn.com/cricket/scores)
 *  4. Cricbuzz HTML scraping    — if accessible (may be blocked from DC IPs)
 *
 * Other sports:
 *  5. Sports DB: "India" team search → next+last 5 events each team
 *  6. Sports DB: today ±1 day for 11 sports
 *  7. ESPN: F1 + Golf
 *
 * State-detection fix:
 *  Sports DB events with no strStatus text but a past date → 'post'
 *  (prevents completed matches appearing in Upcoming tab)
 */

const ESPNCI = 'https://hs-consumer-api.espncricinfo.com/v1/pages';
const ESPN   = 'https://site.api.espn.com/apis/site/v2/sports';
const SDB    = 'https://www.thesportsdb.com/api/v1/json/3';
const CB     = 'https://www.cricbuzz.com/api/html/livescores';

const JSON_HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-IN,en;q=0.9',
};
const CI_HDR = {
  ...JSON_HDR,
  Origin:  'https://www.espncricinfo.com',
  Referer: 'https://www.espncricinfo.com/',
};
const HTML_HDR = {
  'User-Agent': JSON_HDR['User-Agent'],
  Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  Referer: 'https://www.cricbuzz.com/',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
};

async function safeJson(url, hdrs = JSON_HDR, ms = 10000) {
  try {
    const r = await fetch(url, { headers: hdrs, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function safeText(url, ms = 10000) {
  try {
    const r = await fetch(url, { headers: HTML_HDR, signal: AbortSignal.timeout(ms) });
    if (!r.ok) { console.log(`safeText ${r.status}: ${url}`); return null; }
    return await r.text();
  } catch (e) { console.log(`safeText err: ${url} — ${e.message}`); return null; }
}

// ── India detection ────────────────────────────────────────────────────────
const INDIA_KW = [
  'india', 'indian', ' ind ', 'ipl ', 'ipl2', 'bcci',
  'csk', 'chennai super', 'mumbai indians', 'kolkata knight', 'kkr',
  'royal challengers', 'rcb', 'delhi capitals', 'pbks', 'punjab kings',
  'gujarat titans', 'gt ', 'sunrisers', 'srh', 'lucknow super', 'lsg',
  'rajasthan royals', 'rr ',
  'isl', 'i-league', 'hockeyindia', 'fih india',
  'pro kabaddi', 'pkl', 'premier badminton league',
  'india women', 'india a', 'india u19', 'india u23',
];
function isIndia(text = '') {
  const t = (' ' + text + ' ').toLowerCase();
  return INDIA_KW.some(k => t.includes(k));
}

// ── HTML strip ─────────────────────────────────────────────────────────────
function strip(html = '') {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

// ── Time window ────────────────────────────────────────────────────────────
const NOW = Date.now();
const H48 = 48 * 60 * 60 * 1000;
const H1  = 60 * 60 * 1000;

function inWindow(dateStr, state) {
  if (!dateStr) return true;
  const t = new Date(dateStr).getTime();
  if (isNaN(t)) return true;
  if (state === 'post' && NOW - t > H48) return false;
  if (state === 'pre'  && t - NOW > H48) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 1-2: ESPNCricinfo (consumer API — same feed as espncricinfo.com)
// ─────────────────────────────────────────────────────────────────────────
function ciState(m) {
  const id  = m.status?.type?.id ?? '';
  const txt = (m.status?.type?.displayText ?? m.status?.displayText ?? '').toLowerCase();
  if (id === 'InProgress' || txt.includes('live') || txt.includes('in progress')) return 'in';
  if (id === 'Finished'   || txt.includes('won') || txt.includes('draw') || txt.includes('abandon') || txt.includes('no result')) return 'post';
  return 'pre';
}

function ciToMatch(m, seriesName = '') {
  const state = ciState(m);
  const date  = m.startTime ?? null;
  if (!inWindow(date, state)) return null;

  const competitors = (m.teams ?? []).map(t => ({
    name:   t.team?.longName ?? t.team?.name ?? '?',
    score:  t.score
      ? `${t.score.runs ?? ''}/${t.score.wickets ?? ''}${t.score.overs != null ? ` (${t.score.overs} ov)` : ''}`
      : '',
    winner: state === 'post' && !!t.isWinner,
  }));

  const searchTxt = competitors.map(c => c.name).join(' ') + ' ' + seriesName;
  const id = m.objectId ?? m.id ?? m.matchId;

  return {
    id:          `ci_${id ?? Math.random()}`,
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

// Walk any response shape looking for a matches array
function extractCIMatches(json) {
  if (!json) return [];
  // Common shapes: content.matches, matches, content.typeMatches[].seriesMatches[].seriesAdWrapper.matches
  if (json.content?.matches?.length)        return json.content.matches;
  if (json.matches?.length)                 return json.matches;
  if (Array.isArray(json.content?.typeMatches)) {
    return json.content.typeMatches.flatMap(t =>
      (t.seriesMatches ?? []).flatMap(s =>
        s.seriesAdWrapper?.matches ?? []
      )
    );
  }
  return [];
}

async function fetchESPNCricinfo() {
  const all  = [];
  const seen = new Set();

  const addMatch = (m, name) => {
    const match = ciToMatch(m, name);
    if (!match || seen.has(match.id)) return;
    seen.add(match.id);
    all.push(match);
  };

  // Slug-based pages: live, upcoming, results
  const SLUGS = [
    'live-cricket-score',
    'upcoming-cricket-matches',
    'cricket-results',
    'cricket-ipl',
    'india-cricket',
  ];

  const slugResults = await Promise.allSettled(
    SLUGS.map(slug => safeJson(`${ESPNCI}/matches/home?slug=${slug}`, CI_HDR))
  );

  for (const r of slugResults) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    const matches = extractCIMatches(r.value);
    for (const m of matches) addMatch(m, '');
  }

  console.log(`ESPNCricinfo slugs: ${all.length} matches so far`);

  // Series list → per-series matches (gives IPL, India internationals, Women's, etc.)
  const seriesData = await safeJson(`${ESPNCI}/series/list?lang=en&hasFixtures=true`, CI_HDR);
  const seriesList = seriesData?.content?.series ?? seriesData?.series ?? [];
  console.log(`ESPNCricinfo series: ${seriesList.length} active`);

  if (seriesList.length > 0) {
    const seriesFetches = seriesList.slice(0, 20).map(s =>
      safeJson(`${ESPNCI}/series/matches?lang=en&seriesId=${s.objectId}`, CI_HDR)
        .then(r => ({ name: s.description || s.name || '', matches: extractCIMatches(r) }))
    );
    const seriesResults = await Promise.allSettled(seriesFetches);
    for (const r of seriesResults) {
      if (r.status !== 'fulfilled') continue;
      for (const m of r.value.matches) addMatch(m, r.value.name);
    }
  }

  console.log(`ESPNCricinfo total: ${all.length}`);
  return all;
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 3: ESPN cricket (espn.com/cricket/scores)
// ─────────────────────────────────────────────────────────────────────────
function espnCricketToMatch(ev) {
  const comp = ev?.competitions?.[0];
  if (!comp) return null;
  const state  = comp.status?.type?.state ?? 'post';
  const date   = comp.date ?? ev.date ?? null;
  if (!inWindow(date, state)) return null;

  const competitors = (comp.competitors ?? []).map(c => ({
    name:   c.team?.displayName || c.team?.abbreviation || '?',
    score:  c.score ?? '',
    winner: c.winner === 'true' || c.winner === true,
  }));
  const searchTxt = competitors.map(c => c.name).join(' ') + ' ' + (ev.name || '');

  return {
    id:          `espnc_${ev.id}`,
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
  const [indiaReg, general] = await Promise.all([
    safeJson(`${BASE}/scoreboard?region=in&lang=en-in`),
    safeJson(`${BASE}/scoreboard`),
  ]);

  let events = [...(indiaReg?.events ?? []), ...(general?.events ?? [])];

  if (events.length === 0) {
    const lg  = await safeJson(`${BASE}/leagues`);
    const ids = (lg?.leagues ?? []).map(l => l.id).filter(Boolean).slice(0, 12);
    if (ids.length) {
      const rs = await Promise.allSettled(ids.map(id => safeJson(`${BASE}/${id}/scoreboard`)));
      events = rs.flatMap(r => r.status === 'fulfilled' ? r.value?.events ?? [] : []);
    }
  }

  const seen    = new Set();
  const matches = [];
  for (const ev of events) {
    if (!ev?.id || seen.has(ev.id)) continue;
    seen.add(ev.id);
    const m = espnCricketToMatch(ev);
    if (m) matches.push(m);
  }

  console.log(`ESPN cricket: ${matches.length}`);
  return matches;
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 4: Cricbuzz HTML (may be blocked from Vercel datacenter IPs)
// ─────────────────────────────────────────────────────────────────────────
function parseCricbuzzHtml(html, fallbackState) {
  if (!html || html.length < 200) return [];
  const matches = [];

  // Series header positions
  const seriesRe = /class="[^"]*cb-lst-mtch-hdr[^"]*"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g;
  const seriesPosns = [];
  let sh;
  while ((sh = seriesRe.exec(html)) !== null) {
    seriesPosns.push({ pos: sh.index, name: strip(sh[1]) });
  }

  // Match anchor blocks
  const blockRe = /<a[^>]+class="[^"]*block-element[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let bm;
  while ((bm = blockRe.exec(html)) !== null) {
    const href     = bm[1];
    const inner    = bm[2];
    const matchPos = bm.index;

    const idM = href.match(/\/(\d+)\//);
    if (!idM) continue;
    const matchId = idM[1];

    const series = seriesPosns.filter(s => s.pos < matchPos).at(-1)?.name ?? '';

    // Teams: cb-col-60 = name, cb-tms-scr = score
    const teamRe = /class="[^"]*cb-col-60[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]{0,500}?class="[^"]*cb-tms-scr[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    const teams = [];
    let tm;
    while ((tm = teamRe.exec(inner)) !== null && teams.length < 2) {
      const name  = strip(tm[1]);
      const score = strip(tm[2]);
      if (name) teams.push({ name, score });
    }
    if (!teams.length) continue;

    const statusM    = /class="[^"]*cb-min-stts[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(inner);
    const statusText = strip(statusM?.[1] ?? '');
    const classM     = /cb-text-(\w+)/.exec(inner);
    const cls        = classM?.[1] ?? '';

    const state = cls === 'inprogress' ? 'in'
      : (cls === 'complete' || cls === 'winning') ? 'post'
      : cls === 'scheduled' ? 'pre'
      : fallbackState;

    const searchTxt = teams.map(t => t.name).join(' ') + ' ' + series;

    matches.push({
      id: `cb_${matchId}`, sport: 'cricket', sportName: 'Cricket', emoji: '🏏',
      match:   teams.length >= 2 ? `${teams[0].name} vs ${teams[1].name}` : teams[0].name,
      league:  series, state, date: null,
      summary: statusText, detail: statusText,
      clock:   state === 'in' ? '🔴 Live' : '',
      period:  null, venue: '',
      competitors: teams.map(t => ({ name: t.name, score: t.score, winner: false })),
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

  const live     = parseCricbuzzHtml(liveHtml, 'in');
  const upcoming = parseCricbuzzHtml(upcomingHtml, 'pre');
  const recent   = parseCricbuzzHtml(recentHtml, 'post');

  console.log(`Cricbuzz: ${live.length} live | ${upcoming.length} upcoming | ${recent.length} recent`);
  return [...live, ...upcoming, ...recent];
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 5: Sports DB — India team search
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
  const meta  = SDB_META[sport] ?? { key: sport.toLowerCase().replace(/\s+/g, ''), name: sport, emoji: '🏅' };

  const statusTxt = ((ev.strStatus ?? '') + ' ' + (ev.strProgress ?? '')).toLowerCase();
  const isLive = statusTxt.includes('live') || statusTxt.includes('inning') || statusTxt.includes(' ov') ||
                 statusTxt.includes('progress') || statusTxt.includes('quarter') || statusTxt.includes('half') || statusTxt.includes('set ');
  const isDoneByText = !isLive && (statusTxt.includes('finish') || statusTxt.includes('complet') || statusTxt.includes('result') || statusTxt.includes('final') || statusTxt.includes('won'));
  const hasBothScores = ev.intHomeScore != null && ev.intAwayScore != null;

  // Date for state inference (key fix: past events with no status → 'post')
  const dateStr = ev.strTimestamp
    ?? (ev.dateEvent && ev.strTime ? `${ev.dateEvent}T${ev.strTime}+00:00` : null)
    ?? (ev.dateEvent ? `${ev.dateEvent}T00:00:00Z` : null);
  const evTime  = dateStr ? new Date(dateStr).getTime() : null;
  const isPast  = evTime != null && evTime < NOW - H1;   // event was > 1h ago

  // State: live > done-by-text > has-scores > past-by-date > upcoming
  const state = isLive           ? 'in'
    : isDoneByText || hasBothScores || isPast ? 'post'
    : 'pre';

  if (!inWindow(dateStr, state)) return null;

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
      if (!ev?.idEvent || seen.has(ev.idEvent)) continue;
      seen.add(ev.idEvent);
      const m = sdbToMatch(ev);
      if (m) events.push(m);
    }
  }

  console.log(`SportsDB India events: ${events.length}`);
  return events;
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 6: Sports DB — today ±1 day broad coverage
// ─────────────────────────────────────────────────────────────────────────
async function fetchSportsDBToday() {
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(NOW - 86400000).toISOString().slice(0, 10);
  const tmrw  = new Date(NOW + 86400000).toISOString().slice(0, 10);

  const SPORTS = ['Soccer', 'Field Hockey', 'Badminton', 'Kabaddi', 'Tennis', 'Rugby', 'Basketball', 'Wrestling', 'Table Tennis', 'Volleyball', 'Boxing'];
  const fetches = SPORTS.flatMap(sport =>
    [yest, today, tmrw].map(d =>
      safeJson(`${SDB}/eventsday.php?d=${d}&s=${encodeURIComponent(sport)}`).then(r => ({ sport, events: r?.events ?? [] }))
    )
  );

  const results = await Promise.allSettled(fetches);
  const seen    = new Set();
  const events  = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const ev of r.value.events) {
      if (!ev?.idEvent || seen.has(ev.idEvent)) continue;
      seen.add(ev.idEvent);
      const m = sdbToMatch(ev, r.value.sport);
      if (m) events.push(m);
    }
  }

  console.log(`SportsDB today: ${events.length}`);
  return events;
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCE 7: ESPN — F1 + Golf
// F1/Golf races happen every 2-3 weeks, so use a 10-day window instead of
// the standard 48-hour window so we always show the last race + next race.
// ─────────────────────────────────────────────────────────────────────────
const H10D = 10 * 24 * 60 * 60 * 1000; // 10 days

async function fetchESPN() {
  const SPORTS = [
    { key: 'f1',   path: 'racing/f1', name: 'Formula 1', emoji: '🏎️' },
    { key: 'golf', path: 'golf',      name: 'Golf',       emoji: '⛳' },
  ];
  const events = [];

  for (const s of SPORTS) {
    const base = `${ESPN}/${s.path}`;

    // Try the general scoreboard first, then league-specific scoreboards
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

      // Wide window for F1/Golf (races are infrequent — show last 10 days + next 10 days)
      if (date) {
        const t = new Date(date).getTime();
        if (!isNaN(t)) {
          if (state === 'post' && NOW - t > H10D) continue;
          if (state === 'pre'  && t - NOW > H10D) continue;
        }
      }

      const competitors = (comp.competitors ?? [])
        .map(c => ({
          name:   c.athlete?.shortName || c.athlete?.displayName || c.team?.shortDisplayName || c.team?.abbreviation || '?',
          score:  c.score ?? '',
          winner: c.winner === 'true' || c.winner === true,
          order:  Number(c.order ?? 99),
        }))
        .sort((a, b) => a.order - b.order)
        .slice(0, 10); // Top 10 for F1 standings

      events.push({
        id:       `espn_${ev.id}`,
        sport:    s.key,
        sportName: s.name,
        emoji:    s.emoji,
        match:    ev.shortName || ev.name || '',
        league:   ev.season?.displayName || '',
        state,
        date,
        summary:  comp.status?.summary ?? '',
        detail:   comp.status?.type?.detail ?? '',
        clock:    state === 'in' ? '🔴 Live' : '',
        period:   comp.status?.period ?? null,
        venue:    comp.venue?.fullName ?? '',
        competitors,
        isIndia:  false,
        source:   'espn',
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

  const [ciEvents, espnCricket, cbEvents, indiaSDB, todaySDB, espnEvents] = await Promise.all([
    fetchESPNCricinfo(),
    fetchESPNCricketScores(),
    fetchCricbuzz(),
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

  // Cricket: ESPNCricinfo (best data) → ESPN cricket → Cricbuzz
  add(ciEvents);
  add(espnCricket);
  add(cbEvents);

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

  const live      = all.filter(m => m.state === 'in');
  const upcoming  = all.filter(m => m.state === 'pre');
  const completed = all.filter(m => m.state === 'post');
  const india     = all.filter(m => m.isIndia);

  const sportCounts = {};
  all.forEach(m => { sportCounts[m.sport] = (sportCounts[m.sport] ?? 0) + 1; });

  console.log(`TOTAL: ${all.length} | India: ${india.length} | live:${live.length} upcoming:${upcoming.length} completed:${completed.length}`);
  console.log(`Sports: ${Object.entries(sportCounts).map(([k,v]) => `${k}:${v}`).join(' ')}`);

  return res.status(200).json({
    matches: all, live, upcoming, completed,
    counts:  { live: live.length, upcoming: upcoming.length, completed: completed.length },
  });
}
