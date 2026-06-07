/**
 * /api/sports — India-first sports data
 *
 * Strategy:
 *  1. ESPNCricinfo series list → all active cricket series (IPL + international)
 *     → fetch matches from EVERY active series
 *  2. Sports DB team search "India" → all India national/franchise teams
 *     → fetch next 5 + last 5 events per team (cricket, hockey, football,
 *        badminton, kabaddi, wrestling, etc.)
 *  3. Sports DB live scores → any sport that has live data today
 *  4. ESPN F1 + Golf → only these two (ESPN excels at them)
 *
 * India matches are automatically detected and sorted first within each
 * Live/Upcoming/Results tab.
 */

const ESPNCI = 'https://hs-consumer-api.espncricinfo.com/v1/pages';
const ESPN   = 'https://site.api.espn.com/apis/site/v2/sports';
const SDB    = 'https://www.thesportsdb.com/api/v1/json/3';

const HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
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
  'india', ' ind ', 'indian', 'ipl ', 'bcci',
  'csk', 'mumbai indians', 'kkr', 'kolkata knight', 'rcb', 'royal challengers',
  'delhi capitals', 'pbks', 'punjab kings', 'gujarat titans', 'srh', 'sunrisers',
  'lucknow super', 'lsg', 'rajasthan royals', 'rr ',
  'isl', 'i-league', 'hockeyindia', 'fih india',
  'pro kabaddi', 'pkl', 'premier badminton',
  'india women', 'india a', 'india u19', 'india u23',
];

function isIndia(text = '') {
  const t = (' ' + text + ' ').toLowerCase();
  return INDIA_KW.some(k => t.includes(k));
}

// ── SportsDB sport → our internal key ────────────────────────────────────
const SDB_SPORT_KEY = {
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
  'Swimming':     { key: 'swimming',    name: 'Swimming',     emoji: '🏊' },
  'Motorsport':   { key: 'f1',          name: 'Motorsport',   emoji: '🏎️' },
};

const NOW = Date.now();
const H48 = 48 * 60 * 60 * 1000;

// ── Convert SportsDB event ────────────────────────────────────────────────
function sdbToMatch(ev, overrideSport) {
  const sport = overrideSport ?? ev.strSport ?? 'Unknown';
  const meta  = SDB_SPORT_KEY[sport] ?? { key: sport.toLowerCase().replace(/\s/g,''), name: sport, emoji: '🏅' };

  const s = ((ev.strStatus ?? '') + ' ' + (ev.strProgress ?? '')).toLowerCase();
  const isLive   = s.includes('live') || s.includes('inning') || s.includes(' ov') || s.includes('progress') || s.includes('quarter') || s.includes('half') || s.includes('set ');
  const isDone   = !isLive && (s.includes('finish') || s.includes('complet') || s.includes('result') || s.includes('final') || (ev.intHomeScore != null && ev.intAwayScore != null && (ev.strStatus || '').length > 2));
  const state    = isLive ? 'in' : isDone ? 'post' : 'pre';

  const dateStr = ev.strTimestamp
    ?? (ev.dateEvent && ev.strTime ? `${ev.dateEvent}T${ev.strTime}+00:00` : null)
    ?? (ev.dateEvent ? `${ev.dateEvent}T00:00:00Z` : null);

  const evTime = dateStr ? new Date(dateStr).getTime() : null;
  if (state === 'post' && evTime && NOW - evTime > H48) return null;
  if (state === 'pre'  && evTime && evTime - NOW > H48) return null;

  const homeScore = ev.intHomeScore != null ? String(ev.intHomeScore) : '';
  const awayScore = ev.intAwayScore != null ? String(ev.intAwayScore) : '';
  const homeWin   = state === 'post' && Number(ev.intHomeScore) > Number(ev.intAwayScore);
  const awayWin   = state === 'post' && Number(ev.intAwayScore) > Number(ev.intHomeScore);
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
    clock:       '',
    period:      null,
    venue:       ev.strVenue || ev.strCountry || '',
    competitors: [
      { name: ev.strHomeTeam || '?', score: homeScore, winner: homeWin },
      { name: ev.strAwayTeam || '?', score: awayScore, winner: awayWin },
    ],
    isIndia: isIndia(searchTxt),
    source:  'sdb',
  };
}

// ── ESPNCricinfo converter ────────────────────────────────────────────────
function ciToMatch(m, seriesName = '') {
  const state = m.status?.type?.id === 'InProgress' ? 'in'
    : m.status?.type?.id === 'Finished' ? 'post' : 'pre';
  const date  = m.startTime ?? null;
  const evTime = date ? new Date(date).getTime() : null;
  if (state === 'post' && evTime && NOW - evTime > H48) return null;
  if (state === 'pre'  && evTime && evTime - NOW > H48) return null;

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
    clock:       '',
    period:      null,
    venue:       m.venue?.name ?? m.ground?.longName ?? '',
    competitors,
    isIndia:     isIndia(searchTxt),
    source:      'espncricinfo',
  };
}

// ── SOURCE 1: ESPNCricinfo — all active cricket series ────────────────────
async function fetchCricketSeriesList() {
  const allMatches = [];

  // Get all active cricket series
  const seriesData = await safeJson(`${ESPNCI}/series/list?lang=en&hasFixtures=true`);
  const seriesList = seriesData?.content?.series ?? seriesData?.series ?? [];
  console.log(`Cricket series list: ${seriesList.length} active series`);

  // Also try the live page as a quick first pass
  const livePage = await safeJson(`${ESPNCI}/matches/home?slug=live-cricket-score`);
  const liveMatches = livePage?.content?.matches ?? livePage?.matches ?? [];
  for (const m of liveMatches) {
    const match = ciToMatch(m, '');
    if (match) allMatches.push(match);
  }
  console.log(`Cricket live page: ${liveMatches.length} matches`);

  // Fetch matches from all active series in parallel (up to 15)
  if (seriesList.length > 0) {
    const seriesFetches = seriesList.slice(0, 15).map(s =>
      safeJson(`${ESPNCI}/series/matches?lang=en&seriesId=${s.objectId}`)
        .then(r => ({ name: s.description || s.name || '', matches: r?.content?.matches ?? r?.matches ?? [] }))
    );
    const seriesResults = await Promise.allSettled(seriesFetches);
    for (const r of seriesResults) {
      if (r.status !== 'fulfilled') continue;
      const { name, matches } = r.value;
      for (const m of matches) {
        const match = ciToMatch(m, name);
        if (match) allMatches.push(match);
      }
    }
    console.log(`Cricket series matches fetched from ${seriesList.length} series`);
  }

  return allMatches;
}

// ── SOURCE 2: Sports DB — all "India" teams → their events ────────────────
async function fetchIndiaSportsDB() {
  // Search for all India-named teams
  const data = await safeJson(`${SDB}/searchteams.php?t=India`);
  const allTeams = data?.teams ?? [];

  // Filter to national teams + major Indian franchises
  const indiaTeams = allTeams.filter(t => {
    const name = (t.strTeam ?? '').toLowerCase();
    // Include: national teams (India, India Women, India A, India U19)
    // Exclude: random clubs that happen to have "India" in name
    return name === 'india' || name.startsWith('india ') ||
           name.endsWith(' india') || name.includes(' india ');
  }).slice(0, 25);

  console.log(`Sports DB India teams: ${indiaTeams.length} found`);

  // For each team, fetch next 5 and last 5 events
  const eventFetches = indiaTeams.flatMap(team => [
    safeJson(`${SDB}/eventsnext.php?id=${team.idTeam}`).then(r => ({ team, data: r })),
    safeJson(`${SDB}/eventslast.php?id=${team.idTeam}`).then(r => ({ team, data: r })),
  ]);

  const results = await Promise.allSettled(eventFetches);
  const events  = [];
  const seen    = new Set();

  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value?.data?.events) continue;
    for (const ev of r.value.data.events) {
      if (!ev?.idEvent || seen.has(ev.idEvent)) continue;
      seen.add(ev.idEvent);
      const m = sdbToMatch(ev, ev.strSport);
      if (m) events.push(m);
    }
  }

  console.log(`Sports DB India events: ${events.length} from ${indiaTeams.length} teams`);
  return events;
}

// ── SOURCE 3: Sports DB today's events for key sports ────────────────────
async function fetchSportsDBToday() {
  const today    = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const yest     = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Key sports that ESPN/SDB cover for international events involving India
  const sports = ['Cricket', 'Soccer', 'Field Hockey', 'Badminton', 'Kabaddi', 'Tennis', 'Rugby', 'Basketball', 'Wrestling', 'Boxing', 'Table Tennis', 'Volleyball'];
  const dates  = [yest, today, tomorrow];

  const fetches = sports.flatMap(sport =>
    dates.map(d => safeJson(`${SDB}/eventsday.php?d=${d}&s=${encodeURIComponent(sport)}`).then(r => ({ sport, events: r?.events ?? [] })))
  );

  const results = await Promise.allSettled(fetches);
  const events  = [];
  const seen    = new Set();

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { sport, events: evs } = r.value;
    for (const ev of evs) {
      if (!ev?.idEvent || seen.has(ev.idEvent)) continue;
      seen.add(ev.idEvent);
      const m = sdbToMatch(ev, sport);
      if (m) events.push(m);
    }
  }

  console.log(`Sports DB today: ${events.length} events across ${sports.length} sports`);
  return events;
}

// ── SOURCE 4: ESPN for F1 and Golf only ──────────────────────────────────
async function fetchESPNSpecific() {
  const DIRECT = [
    { key: 'f1', path: 'racing/f1', name: 'Formula 1', emoji: '🏎️' },
    { key: 'golf', path: 'golf', name: 'Golf', emoji: '⛳' },
  ];
  const events = [];

  for (const s of DIRECT) {
    const base = `${ESPN}/${s.path}`;
    let raw = await safeJson(`${base}/scoreboard`);
    if (!raw?.events?.length) {
      const lg = await safeJson(`${base}/leagues`);
      const ids = (lg?.leagues ?? []).map(l => l.id).filter(Boolean).slice(0, 4);
      if (ids.length) {
        const res = await Promise.allSettled(ids.map(id => safeJson(`${base}/${id}/scoreboard`)));
        raw = { events: res.flatMap(r => r.status === 'fulfilled' ? r.value?.events ?? [] : []) };
      }
    }
    for (const ev of raw?.events ?? []) {
      const comp   = ev?.competitions?.[0];
      if (!comp) continue;
      const state  = comp.status?.type?.state ?? 'post';
      const date   = comp.date ?? ev.date ?? null;
      const evTime = date ? new Date(date).getTime() : null;
      if (state === 'post' && evTime && NOW - evTime > H48) continue;
      if (state === 'pre'  && evTime && evTime - NOW > H48) continue;
      const competitors = (comp.competitors ?? [])
        .map(c => ({ name: c.athlete?.shortName || c.team?.shortDisplayName || c.team?.abbreviation || '?', score: c.score ?? '', winner: c.winner === 'true' || c.winner === true, order: Number(c.order ?? 99) }))
        .sort((a, b) => a.order - b.order).slice(0, 5);
      events.push({
        id: `espn_${ev.id}`, sport: s.key, sportName: s.name, emoji: s.emoji,
        match: ev.shortName || ev.name || '', league: ev.season?.displayName || '',
        state, date, summary: comp.status?.summary ?? '', detail: comp.status?.type?.detail ?? '',
        clock: comp.status?.displayClock ?? '', period: comp.status?.period ?? null,
        venue: comp.venue?.fullName ?? '', competitors, isIndia: false, source: 'espn',
      });
    }
  }

  console.log(`ESPN F1+Golf: ${events.length} events`);
  return events;
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=360');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // All four sources in parallel
  const [cricketMatches, indiaSDB, todaySDB, espnDirect] = await Promise.all([
    fetchCricketSeriesList(),
    fetchIndiaSportsDB(),
    fetchSportsDBToday(),
    fetchESPNSpecific(),
  ]);

  // Merge — cricket first, then India SDB, then today SDB, then ESPN
  const seen = new Set();
  const all  = [];

  const add = (events) => {
    for (const ev of events) {
      if (!ev?.id || seen.has(ev.id)) continue;
      seen.add(ev.id);
      all.push(ev);
    }
  };

  add(cricketMatches);  // Cricket with full scores (ESPNCricinfo)
  add(indiaSDB);        // All India team events across all sports
  add(todaySDB);        // Today's events from Sports DB (catches everything else)
  add(espnDirect);      // F1 + Golf

  // Sort: live → upcoming soonest → completed most-recent
  //       within each state: India first
  all.sort((a, b) => {
    const so = { in: 0, pre: 1, post: 2 };
    const sd = (so[a.state] ?? 9) - (so[b.state] ?? 9);
    if (sd !== 0) return sd;
    const id = (a.isIndia ? 0 : 1) - (b.isIndia ? 0 : 1);
    if (id !== 0) return id;
    if (!a.date || !b.date) return 0;
    return a.state === 'pre'
      ? new Date(a.date).getTime() - new Date(b.date).getTime()
      : new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const live      = all.filter(m => m.state === 'in');
  const upcoming  = all.filter(m => m.state === 'pre');
  const completed = all.filter(m => m.state === 'post');
  const indiaTotal = all.filter(m => m.isIndia).length;

  const sportCounts = {};
  all.forEach(m => { sportCounts[m.sport] = (sportCounts[m.sport] ?? 0) + 1; });
  console.log(`TOTAL: ${all.length} | India: ${indiaTotal} | live:${live.length} upcoming:${upcoming.length} completed:${completed.length}`);
  console.log(`Sports: ${Object.entries(sportCounts).map(([k,v])=>`${k}:${v}`).join(' ')}`);

  return res.status(200).json({
    matches: all, live, upcoming, completed,
    counts: { live: live.length, upcoming: upcoming.length, completed: completed.length },
  });
}
