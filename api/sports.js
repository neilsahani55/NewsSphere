/**
 * /api/sports
 *
 * Merges the standalone `score` Express service into the main NewsSphere app.
 * Primary providers now come from the score service logic:
 * - Cricbuzz scrape for cricket
 * - ESPN site API for football / basketball / tennis / rugby / volleyball
 * - ProKabaddi scrape for kabaddi
 * - F1 live timing + Jolpica/Ergast-compatible API for Formula 1
 * - BWF match-centre read-through proxy for badminton
 *
 * The previous SportsDB/ESPN implementation remains as a fallback layer so the
 * home widget still surfaces extra sports when the richer providers do not.
 */

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2';
const SPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';
const CRICBUZZ_BASE = 'https://www.cricbuzz.com';
const PRO_KABADDI_BASE = 'https://www.prokabaddi.com';
const F1_LIVE_BASE = 'https://livetiming.formula1.com/static/';
const F1_RESULTS_BASE = 'https://api.jolpi.ca/ergast/f1';
const BWF_HOME_URL = 'https://match-centre.bwfbadminton.com/';

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
};

const CACHE_TTL_MS = 15_000;
const cache = new Map();

const H1 = 60 * 60 * 1000;
const H24 = 24 * H1;
const H1D = 24 * H1;

const SPORT_META = {
  cricket: { key: 'cricket', name: 'Cricket', emoji: '🏏' },
  football: { key: 'football', name: 'Football', emoji: '⚽' },
  basketball: { key: 'basketball', name: 'Basketball', emoji: '🏀' },
  tennis: { key: 'tennis', name: 'Tennis', emoji: '🎾' },
  rugby: { key: 'rugby', name: 'Rugby', emoji: '🏉' },
  volleyball: { key: 'volleyball', name: 'Volleyball', emoji: '🏐' },
  kabaddi: { key: 'kabaddi', name: 'Kabaddi', emoji: '🤸' },
  badminton: { key: 'badminton', name: 'Badminton', emoji: '🏸' },
  f1: { key: 'f1', name: 'Formula 1', emoji: '🏎️' },
  fieldhockey: { key: 'fieldhockey', name: 'Field Hockey', emoji: '🏑' },
  golf: { key: 'golf', name: 'Golf', emoji: '⛳' },
  athletics: { key: 'athletics', name: 'Athletics', emoji: '🏃' },
  boxing: { key: 'boxing', name: 'Boxing', emoji: '🥊' },
  mma: { key: 'mma', name: 'MMA', emoji: '🥊' },
  wrestling: { key: 'wrestling', name: 'Wrestling', emoji: '🤼' },
  tabletennis: { key: 'tabletennis', name: 'Table Tennis', emoji: '🏓' },
  squash: { key: 'squash', name: 'Squash', emoji: '🎱' },
  swimming: { key: 'swimming', name: 'Swimming', emoji: '🏊' },
};

const PRIMARY_ESPN_SPORTS = [
  { key: 'football', sport: 'soccer', leagues: ['fifa.worldq.afc'] },
  { key: 'tennis', sport: 'tennis', leagues: ['atp', 'wta'] },
];

const INDIA_KW = [
  'india', 'indian', ' ind ', 'ipl ', 'bcci',
  'csk', 'chennai super', 'mumbai indians', 'kolkata knight', 'kkr',
  'royal challengers', 'rcb', 'delhi capitals', 'pbks', 'punjab kings',
  'gujarat titans', 'gt ', 'sunrisers', 'srh', 'lucknow super', 'lsg',
  'rajasthan royals', 'rr ',
  'isl', 'i-league', 'hockeyindia', 'fih india',
  'pro kabaddi', 'pkl', 'india women', 'india a', 'india u19', 'india u23',
];

const INDIA_DOMESTIC_KW = [
  'india', 'indian', 'india a', 'india women', 'india u19', 'india u23',
  'ipl', 'ranji', 'syed mushtaq', 'vijay hazare', 'duleep', 'devdhar', 'irani',
  'pro kabaddi', 'pkl', 't20 mumbai', 'maharaja trophy', 'tnpl', 'ksca', 'saurashtra',
  'mumbai', 'delhi', 'karnataka', 'tamil nadu', 'punjab', 'haryana', 'kerala', 'bengal',
  'uttar pradesh', 'rajasthan', 'gujarat', 'assam', 'hyderabad', 'vidarbha', 'jharkhand',
  'railways', 'services', 'chennai', 'kolkata', 'lucknow', 'andhra', 'odisha', 'goa',
  'madhya pradesh', 'tripura', 'nagaland', 'mizoram', 'meghalaya', 'manipur', 'sikkim',
  'pondicherry', 'jammu', 'kashmir', 'chhattisgarh', 'bihar', 'arunachal',
];

const COUNTRY_NAMES = [
  'india', 'afghanistan', 'australia', 'bangladesh', 'england', 'new zealand', 'pakistan',
  'south africa', 'sri lanka', 'west indies', 'zimbabwe', 'ireland', 'netherlands',
  'united states of america', 'united states', 'usa', 'canada', 'nepal', 'oman', 'uae',
  'united arab emirates', 'scotland', 'namibia', 'hong kong', 'papua new guinea',
  'japan', 'thailand', 'mongolia', 'philippines', 'saudi arabia', 'china', 'qatar',
  'bahrain', 'kuwait', 'jordan', 'iraq', 'iran', 'uzbekistan', 'tajikistan',
  'turkmenistan', 'kyrgyzstan', 'malaysia', 'singapore', 'indonesia', 'vietnam',
  'south korea', 'korea republic', 'north korea', 'mexico', 'argentina', 'brazil',
  'france', 'germany', 'italy', 'spain', 'portugal', 'belgium', 'netherlands',
  'switzerland', 'croatia', 'serbia', 'poland', 'ukraine', 'turkey', 'morocco',
  'tunisia', 'egypt', 'nigeria', 'kenya',
];

const COUNTRY_CODES = [
  'ind', 'inda', 'indw', 'afg', 'aus', 'ban', 'eng', 'enga', 'engw', 'nz', 'pak', 'sa',
  'saa', 'saw', 'sl', 'sla', 'slw', 'wi', 'wiw', 'zim', 'ire', 'ned', 'usa', 'can',
  'nep', 'oman', 'uae', 'uaew', 'sco', 'nam', 'hkg', 'png', 'jpn', 'thaiw', 'jpnw',
  'mglw', 'mmrw', 'phiw', 'chnw', 'sauw', 'rsaa', 'rsaw', 'nedw',
];

const TENNIS_GLOBAL_KW = [
  'atp', 'wta', 'grand slam', 'wimbledon', 'us open', 'french open',
  'roland garros', 'australian open', 'davis cup', 'billie jean king cup',
  'men\'s singles', 'women\'s singles', 'men\'s doubles', 'women\'s doubles',
  'mixed doubles',
];

const BADMINTON_GLOBAL_KW = ['bwf', 'super 1000', 'super 750', 'super 500', 'super 300', 'world championships', 'thomas cup', 'uber cup', 'sudirman cup'];
const GOLF_ALLOWED_KW = ['masters', 'open championship', 'u.s. open', 'us open', 'pga championship', 'ryder cup', 'presidents cup', 'olympic', 'world golf', 'indian open'];

const SPORTSDB_META = {
  Cricket: SPORT_META.cricket,
  Soccer: SPORT_META.football,
  Football: SPORT_META.football,
  'Field Hockey': SPORT_META.fieldhockey,
  Hockey: { key: 'fieldhockey', name: 'Hockey', emoji: '🏒' },
  Badminton: SPORT_META.badminton,
  Kabaddi: SPORT_META.kabaddi,
  Basketball: SPORT_META.basketball,
  Tennis: SPORT_META.tennis,
  Rugby: SPORT_META.rugby,
  Volleyball: SPORT_META.volleyball,
  Athletics: SPORT_META.athletics,
  Boxing: SPORT_META.boxing,
  MMA: SPORT_META.mma,
  Wrestling: SPORT_META.wrestling,
  'Table Tennis': SPORT_META.tabletennis,
  Squash: SPORT_META.squash,
  Golf: SPORT_META.golf,
  Motorsport: { key: 'f1', name: 'Motorsport', emoji: '🏎️' },
  Swimming: SPORT_META.swimming,
};

function nowMs() {
  return Date.now();
}

async function remember(key, loader, ttlMs = CACHE_TTL_MS) {
  const entry = cache.get(key);
  if (entry?.value !== undefined && entry.expiresAt > nowMs()) return entry.value;
  if (entry?.promise) return entry.promise;

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      cache.set(key, { value, expiresAt: nowMs() + ttlMs });
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, { promise, expiresAt: 0 });
  return promise;
}

async function fetchJson(url, { timeoutMs = 15_000, ttlMs = CACHE_TTL_MS } = {}) {
  return remember(`json:${url}`, async () => {
    const res = await fetch(url, {
      headers: HTTP_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }, ttlMs);
}

async function fetchText(url, { timeoutMs = 15_000, ttlMs = CACHE_TTL_MS } = {}) {
  return remember(`text:${url}`, async () => {
    const res = await fetch(url, {
      headers: HTTP_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  }, ttlMs);
}

async function safeJson(url, options) {
  try {
    return await fetchJson(url, options);
  } catch {
    return null;
  }
}

async function safeText(url, options) {
  try {
    return await fetchText(url, options);
  } catch {
    return null;
  }
}

async function promisePool(items, worker, concurrency = 4) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const runner = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  };

  const limit = Math.max(1, Math.min(Number(concurrency) || 1, items.length || 1));
  await Promise.all(Array.from({ length: limit }, runner));
  return results;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value) {
  return normalizeWhitespace(String(value || '').replace(/<[^>]+>/g, ' '));
}

function decodeBasicHtmlEntities(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

function cleanDisplayText(value) {
  return normalizeWhitespace(decodeBasicHtmlEntities(String(value || '')));
}

function stripHtml(value) {
  return normalizeWhitespace(decodeBasicHtmlEntities(String(value || '').replace(/<[^>]+>/g, ' ')));
}

function toNumberOrUndefined(value) {
  if (value === null || value === undefined) return undefined;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : undefined;
}

function toNumberOrString(value) {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : s;
}

function buildAbsoluteUrl(baseUrl, href) {
  if (!href) return undefined;
  if (/^https?:\/\//i.test(href)) return href;
  return String(baseUrl).replace(/\/$/, '') + (String(href).startsWith('/') ? href : `/${href}`);
}

function isIndia(text = '') {
  const t = (` ${text} `).toLowerCase();
  return INDIA_KW.some((kw) => t.includes(kw));
}

function includesKeyword(text, keywords) {
  const haystack = (` ${normalizeWhitespace(text)} `).toLowerCase();
  return keywords.some((kw) => haystack.includes(` ${kw.toLowerCase()} `) || haystack.includes(kw.toLowerCase()));
}

function isIndiaDomesticText(text = '') {
  return includesKeyword(text, INDIA_DOMESTIC_KW);
}

function isCountrySideName(name = '') {
  const clean = normalizeWhitespace(name).toLowerCase();
  if (!clean) return false;
  return COUNTRY_NAMES.includes(clean) || COUNTRY_CODES.includes(clean.replace(/[^a-z]/g, ''));
}

function isInternationalNationalMatch(names = []) {
  const normalized = names
    .map((name) => normalizeWhitespace(name))
    .filter(Boolean);
  if (normalized.length < 2) return false;
  return normalized.every((name) => isCountrySideName(name));
}

function keepForFocusedFeed(match) {
  if (!match) return false;
  if (match.state !== 'in' && !inWindow(match.date, match.state, H1D, H1D)) return false;
  if (/\bTBD\b/i.test(match.match || '')) return false;

  const text = [
    match.match,
    match.league,
    match.matchType,
    match.summary,
    match.result,
    match.venue,
    ...(match.competitors || []).map((c) => c.name),
  ].join(' ');

  if (match.sport === 'kabaddi') return true;
  if (match.sport === 'cricket') {
    const competitorNames = (match.competitors || []).map((c) => c.name);
    return isInternationalNationalMatch(competitorNames) || isIndiaDomesticText(text);
  }
  if (match.sport === 'football' || match.sport === 'fieldhockey') {
    const competitorNames = (match.competitors || []).map((c) => c.name);
    return isInternationalNationalMatch(competitorNames) || isIndia(text);
  }
  if (match.sport === 'tennis') return includesKeyword(text, TENNIS_GLOBAL_KW) || isIndia(text);
  if (match.sport === 'badminton') return includesKeyword(text, BADMINTON_GLOBAL_KW) || isIndia(text);
  if (match.sport === 'f1') return true;
  if (match.sport === 'golf') return includesKeyword(text, GOLF_ALLOWED_KW) || isIndia(text);

  return false;
}

function inWindow(dateStr, state, preMax = H24, postMax = H24) {
  if (!dateStr) return true;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return true;
  const now = nowMs();
  if (state === 'post' && now - t > postMax) return false;
  if (state === 'pre' && t - now > preMax) return false;
  return true;
}

function uniqueById(matches) {
  const seen = new Set();
  const out = [];
  for (const match of matches) {
    if (!match?.id || seen.has(match.id)) continue;
    seen.add(match.id);
    out.push(match);
  }
  return out;
}

function sortMatches(matches) {
  return [...matches].sort((a, b) => {
    const order = { in: 0, pre: 1, post: 2 };
    const stateDelta = (order[a.state] ?? 9) - (order[b.state] ?? 9);
    if (stateDelta !== 0) return stateDelta;

    const abandonedDelta = (a.isAbandoned ? 1 : 0) - (b.isAbandoned ? 1 : 0);
    if (abandonedDelta !== 0) return abandonedDelta;

    const indiaDelta = (a.isIndia ? 0 : 1) - (b.isIndia ? 0 : 1);
    if (indiaDelta !== 0) return indiaDelta;

    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;

    return a.state === 'pre'
      ? new Date(a.date).getTime() - new Date(b.date).getTime()
      : new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

function yyyymmddFromOffset(offsetDays) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function isoDateFromOffset(offsetDays) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function parseVsNames(strEvent, rawHome, rawAway) {
  const home = normalizeWhitespace(rawHome);
  const away = normalizeWhitespace(rawAway);
  if (home && away) return [home, away];
  const parts = String(strEvent || '').split(/\s+vs\.?\s+/i);
  if (parts.length < 2) return [home || '?', away || '?'];
  const homeWords = parts[0].trim().split(/\s+/);
  const awayWords = parts[1].trim().split(/\s+/);
  return [
    home || (homeWords.length > 2 ? homeWords.slice(-2).join(' ') : homeWords.join(' ')) || '?',
    away || awayWords.slice(0, 2).join(' ') || '?',
  ];
}

function stateFromKind(kind) {
  if (kind === 'live') return 'in';
  if (kind === 'upcoming') return 'pre';
  return 'post';
}

function buildHomeMatch({
  id,
  sport,
  match,
  league = '',
  matchType = '',
  state = 'post',
  date = null,
  summary = '',
  result = '',
  detail = '',
  clock = '',
  venue = '',
  competitors = [],
  isIndiaMatch = false,
  isAbandoned = false,
  source,
}) {
  const meta = SPORT_META[sport] || { key: sport, name: sport, emoji: '🏅' };
  return {
    id,
    sport: meta.key,
    sportName: meta.name,
    emoji: meta.emoji,
    match: cleanDisplayText(match) || meta.name,
    league: cleanDisplayText(league),
    matchType: cleanDisplayText(matchType),
    state,
    date,
    summary: cleanDisplayText(summary),
    result: cleanDisplayText(result),
    detail: cleanDisplayText(detail),
    clock: cleanDisplayText(clock),
    period: null,
    venue: cleanDisplayText(venue),
    competitors: Array.isArray(competitors)
      ? competitors.map((competitor) => ({
          ...competitor,
          name: cleanDisplayText(competitor?.name),
          score: competitor?.score ?? '',
        }))
      : [],
    isIndia: Boolean(isIndiaMatch),
    isAbandoned: Boolean(isAbandoned),
    source,
  };
}

function buildProxyUrl(url) {
  const u = String(url || '').trim();
  if (!u) return undefined;
  const stripped = u.replace(/^https?:\/\//i, '');
  return `https://r.jina.ai/http://${stripped}`;
}

function parseTournamentIdFromHome(text) {
  const match = String(text || '').match(/https:\/\/match-centre\.bwfbadminton\.com\/(\d{3,6})/i);
  return match ? match[1] : undefined;
}

function parseTournamentTitle(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => normalizeWhitespace(line));
  const idx = lines.findIndex((line) => line.startsWith('## ') && !line.toLowerCase().includes('bwf match centre'));
  return idx >= 0 ? lines[idx].replace(/^##\s+/, '') : undefined;
}

function parseNextLiveTournamentTitle(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => normalizeWhitespace(line));
  const idx = lines.findIndex((line) => /^##\s+Next Live Tournament$/i.test(line));
  if (idx < 0) return undefined;
  for (let i = idx + 1; i < Math.min(lines.length, idx + 12); i += 1) {
    const line = lines[i];
    if (!line) continue;
    if (line.startsWith('[')) continue;
    if (/(live scores|draws|stay updated|download)/i.test(line)) continue;
    return line;
  }
  return undefined;
}

function parseTournamentDateRange(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => normalizeWhitespace(line));
  return lines.find((line) => /^\d{1,2}\s*-\s*\d{1,2}\s+[A-Za-z]{3,}$/i.test(line));
}

function parseLiveMatchesFromTournament(text) {
  if (/currently no live matches/i.test(String(text || ''))) return [];
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const matches = [];
  for (const line of lines) {
    if (!/^Court\s+\d+/i.test(line)) continue;
    const courtMatch = line.match(/^Court\s+(\d+)/i);
    const court = toNumberOrUndefined(courtMatch?.[1]);
    const scoreDash = line.match(/\b(\d{1,2})\s*-\s*(\d{1,2})\b/);
    matches.push({
      id: `court-${court ?? 'x'}-${matches.length + 1}`,
      court,
      state: 'in',
      scoreLine: scoreDash ? `${scoreDash[1]} - ${scoreDash[2]}` : '',
      raw: line,
    });
  }

  return matches;
}

function parseGmtOffsetToMs(offset) {
  const match = String(offset || '').match(/^([+-]?)(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  const seconds = Number(match[4]);
  return sign * ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

function parseIsoLocalToUtcMs(isoLocal, gmtOffset) {
  const match = String(isoLocal || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const localAsUtcMs = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  );
  return localAsUtcMs - parseGmtOffsetToMs(gmtOffset);
}

function buildSessionTitle({ meetingName, sessionType, sessionName }) {
  return [meetingName, sessionType, sessionName !== sessionType ? sessionName : '']
    .filter(Boolean)
    .join(' - ');
}

function normalizeDriver(driver) {
  if (!driver) return undefined;
  return {
    racingNumber: driver.RacingNumber,
    fullName: driver.FullName,
    lastName: driver.LastName,
    teamName: driver.TeamName,
    countryCode: driver.CountryCode,
  };
}

function extractMatchIdFromHref(href) {
  const match = String(href || '').match(/\/live-cricket-scores\/(\d+)\b/);
  return match ? match[1] : undefined;
}

function classifyCricbuzzKind(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('preview') || s.includes('starts') || s.includes('scheduled') || s.includes('toss') || s.includes('match starts')) return 'upcoming';
  if (s.includes('won') || s.includes('complete') || s.includes('abandoned') || s.includes('no result') || s.includes('cancelled') || s.includes('canceled') || s.includes('draw') || s.includes('tie')) return 'recent';
  return 'live';
}

function splitCricketTeams(title) {
  const core = normalizeWhitespace(String(title || '').split(',')[0]);
  const parts = core.split(/\s+vs\.?\s+|\s+v\s+/i).map((part) => normalizeWhitespace(part));
  if (parts.length >= 2) return [parts[0], parts[1]];
  return [core || 'Team 1', 'Team 2'];
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitCricketTitleAndStatus(rawTitle, rawStatus) {
  const titleText = normalizeWhitespace(rawTitle);
  const statusText = normalizeWhitespace(rawStatus);
  let matchTitle = titleText || statusText;
  let resultText = statusText;

  if (matchTitle.includes(' - ')) {
    const parts = matchTitle.split(/\s+-\s+/);
    const tail = normalizeWhitespace(parts.slice(1).join(' - '));
    if (tail && /\b(won|lead|need|trail|stumps|day\s*\d|live|complete|result|abandoned|draw|tie|no result)\b/i.test(tail)) {
      matchTitle = normalizeWhitespace(parts[0]);
      if (!resultText) resultText = tail;
    }
  }

  return {
    matchTitle: matchTitle || titleText || statusText,
    resultText,
  };
}

function cleanCricbuzzMarketingText(text) {
  return normalizeWhitespace(decodeBasicHtmlEntities(String(text || ''))
    .replace(/\|\s*Cricbuzz.*$/i, '')
    .replace(/\bLive Cricket Stream\b/gi, '')
    .replace(/\blive scores?\b/gi, '')
    .replace(/\bball-by-ball commentary\b/gi, '')
    .replace(/\bhighlights?\b/gi, '')
    .replace(/\bvideos?\b/gi, '')
    .replace(/\bnews\b/gi, '')
    .replace(/\band more\b/gi, '')
    .replace(/,?\s*in USA\s*&\s*Canada\b/gi, '')
    .replace(/,?\s*in USA & Canada\b/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*$/g, ''));
}

function stripCricketMatchLead(text) {
  const clean = cleanCricbuzzMarketingText(text).replace(/^Cricket commentary\s*\|\s*/i, '');
  const parts = clean.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean);
  if (parts.length >= 2 && /\s+vs\.?\s+/i.test(parts[0])) return parts.slice(1).join(', ');
  return clean;
}

function expandCricketCompetitionLabel(competition, matchType, matchTitle) {
  const cleanCompetition = cleanCricbuzzMarketingText(competition);
  if (!cleanCompetition) return '';
  if (/^group\s+[a-z0-9]+$/i.test(cleanCompetition)) {
    return [matchType, cleanCompetition, matchTitle].filter(Boolean).join(' · ');
  }
  return cleanCompetition;
}

function extractCricketMeta(...texts) {
  for (const text of texts) {
    let clean = stripCricketMatchLead(text).replace(/\s+-\s+.*$/, '');
    clean = cleanCricbuzzMarketingText(clean);
    const parts = clean.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean);
    if (parts.length >= 2 && /\s+vs\.?\s+/i.test(parts[0])) {
      return {
        matchType: parts[1] || '',
        competition: parts.slice(2).join(', '),
      };
    }
    if (parts.length >= 1 && !/\bcommentary\b/i.test(parts[0])) {
      return {
        matchType: parts[0] || '',
        competition: parts.slice(1).join(', '),
      };
    }
  }
  return { matchType: '', competition: '' };
}

function extractCricketReadableTeams(...texts) {
  for (const text of texts) {
    let clean = cleanCricbuzzMarketingText(text).replace(/^Cricket commentary\s*\|\s*/i, '');
    clean = clean.replace(/\s+-\s+.*$/, '');
    const head = normalizeWhitespace(clean.split(',')[0]);
    if (/\d/.test(head)) continue;
    if (!/\s+vs\.?\s+/i.test(head)) continue;
    const [home, away] = splitCricketTeams(head);
    if (home && away) return { home, away };
  }
  return null;
}

function extractCricketVenue(...texts) {
  for (const text of texts) {
    const clean = normalizeWhitespace(text);
    if (!clean) continue;
    const match = clean.match(/\bat\s+(.+?)(?:,\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|,\s*\d{1,2}:\d{2}|\s+-\s+|$)/i);
    if (match?.[1]) return normalizeWhitespace(match[1]);
  }
  return '';
}

function cricketAliases(name) {
  const clean = normalizeWhitespace(name);
  if (!clean) return [];
  const aliases = new Set([clean.toLowerCase()]);
  const compact = clean.replace(/[^A-Za-z]/g, '');
  if (compact && compact.length <= 5) aliases.add(compact.toLowerCase());
  const initials = clean.split(/\s+/).map((part) => part[0]).join('').toLowerCase();
  if (initials.length >= 2) aliases.add(initials);
  return Array.from(aliases);
}

function cricketTeamMatchesName(left, right) {
  const leftAliases = cricketAliases(left);
  const rightAliases = new Set(cricketAliases(right));
  return leftAliases.some((alias) => rightAliases.has(alias));
}

function cricketWinnerFromText(text, sideName) {
  const haystack = normalizeWhitespace(text).toLowerCase();
  if (!haystack || !sideName) return false;
  return cricketAliases(sideName).some((alias) => haystack.includes(`${alias} won`));
}

function cricketWinnerFromCode(text, sideName) {
  const code = normalizeWhitespace(text).match(/\b([A-Z]{2,5})\s+won\b/i)?.[1]?.toLowerCase();
  if (!code || !sideName) return false;
  const clean = normalizeWhitespace(sideName).toLowerCase();
  const compact = clean.replace(/[^a-z]/g, '');
  const initials = clean.split(/\s+/).map((part) => part[0]).join('');
  const code2 = code.slice(0, 2);
  return compact.startsWith(code) || compact.startsWith(code2) || initials === code || initials === code2;
}

function compactCricketResult(summary, resultText) {
  const text = normalizeWhitespace(resultText || summary);
  if (!text) return '';
  if (/\bwon\b/i.test(text) || /\b(stumps|trail|need|draw|tie|abandoned|no result)\b/i.test(text)) return text;
  return '';
}

function deriveCricketState(match, summaryData, fallbackKind) {
  const text = normalizeWhitespace([
    match?.status,
    match?.title,
    match?.matchInfo,
    summaryData?.title,
    summaryData?.summary,
  ].join(' ')).toLowerCase();

  if (/\b(abandon|abandoned|cancelled|canceled|no result|match drawn|drawn|draw|complete|completed|won|tie)\b/.test(text)) {
    return 'post';
  }
  if (/\b(upcoming|preview|scheduled|schedule|match starts|starts at|start time|toss at)\b/.test(text)) {
    return 'pre';
  }
  if (/\b(live|in progress|need|trail|stumps|day\s*\d|innings break)\b/.test(text)) {
    return 'in';
  }
  return stateFromKind(fallbackKind);
}

function isCricketAbandoned(...texts) {
  const text = normalizeWhitespace(texts.join(' ')).toLowerCase();
  return /\b(abandon|abandoned|no result|cancelled|canceled)\b/.test(text);
}

function parseScoreSummaryFromHtml(html) {
  const match = String(html || '').match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  if (!match) return undefined;
  const content = normalizeWhitespace(decodeBasicHtmlEntities(match[1]));
  const followIdx = content.toLowerCase().indexOf('follow ');
  if (followIdx !== -1) {
    const afterFollow = content.slice(followIdx + 'follow '.length);
    const pipeIdx = afterFollow.indexOf('|');
    const summary = normalizeWhitespace(pipeIdx === -1 ? afterFollow : afterFollow.slice(0, pipeIdx));
    return summary || content;
  }
  return content;
}

function parseTitleFromHtml(html) {
  const match = String(html || '').match(/<title>([^<]+)<\/title>/i);
  return match ? normalizeWhitespace(match[1]) : undefined;
}

function parseCricketTeamSegment(segment, fallbackName) {
  const clean = normalizeWhitespace(segment);
  const match = clean.match(/^(.+?)\s+(\d+(?:\/\d+)?(?:\s*\(\d+(?:\.\d+)?\))?)/);
  if (!match) return null;
  return { name: normalizeWhitespace(match[1]) || fallbackName, score: normalizeWhitespace(match[2]) };
}

function splitCricketSummary(summary, homeName, awayName) {
  const clean = normalizeWhitespace(summary);
  if (!/\s+vs\.?\s+/i.test(clean) || !/\d/.test(clean)) return null;
  const parts = clean.split(/\s+vs\.?\s+/i);
  if (parts.length !== 2) return null;
  const home = parseCricketTeamSegment(parts[0], homeName);
  const away = parseCricketTeamSegment(parts[1], awayName);
  if (!home || !away) return null;
  return {
    home,
    away,
  };
}

function cricketPrimaryScore(scoreText) {
  const match = String(scoreText || '').match(/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function resolveCricketDisplayName(parsedName, fallbackName) {
  if (!parsedName) return fallbackName;
  if (fallbackName && cricketTeamMatchesName(parsedName, fallbackName)) return fallbackName;
  return parsedName;
}

function alignCricketSides(parsedSummary, fallbackHome, fallbackAway) {
  if (!parsedSummary) return null;
  const direct =
    cricketTeamMatchesName(parsedSummary.home?.name, fallbackHome) ||
    cricketTeamMatchesName(parsedSummary.away?.name, fallbackAway);
  const reversed =
    cricketTeamMatchesName(parsedSummary.home?.name, fallbackAway) ||
    cricketTeamMatchesName(parsedSummary.away?.name, fallbackHome);

  if (!direct && reversed) {
    return {
      home: parsedSummary.away,
      away: parsedSummary.home,
    };
  }
  return parsedSummary;
}

function parseCricbuzzMatchListPage({ html, baseUrl }) {
  const matches = new Map();

  const attrValue = (attrs, name) => {
    const match = String(attrs || '').match(new RegExp(`${name}="([^"]*)"`, 'i'));
    return match ? decodeBasicHtmlEntities(match[1]) : '';
  };

  const anchorRegex = /<a\b([^>]*href="\/live-cricket-scores\/[^"]+"[^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(String(html || '')))) {
    const attrs = match[1];
    const inner = match[2];
    const href = attrValue(attrs, 'href');
    const matchId = extractMatchIdFromHref(href);
    if (!matchId || matches.has(matchId)) continue;

    const titleAttr = normalizeWhitespace(attrValue(attrs, 'title'));
    const titleText = stripHtml((inner.match(/<div[^>]*text-white[^>]*>([\s\S]*?)<\/div>/i) || [])[1]) || stripHtml(inner);
    const matchInfoText = stripHtml((inner.match(/<div[^>]*text-xs[^>]*>([\s\S]*?)<\/div>/i) || [])[1]);
    const status = titleAttr || titleText;

    matches.set(matchId, {
      matchId,
      url: buildAbsoluteUrl(baseUrl, href),
      title: titleText || titleAttr,
      matchInfo: matchInfoText,
      status,
      kind: classifyCricbuzzKind(status),
      series: '',
      category: '',
    });
  }

  return Array.from(matches.values());
}

function getCricbuzzListUrl(kind) {
  if (kind === 'upcoming') return buildAbsoluteUrl(CRICBUZZ_BASE, '/cricket-match/live-scores/upcoming-matches');
  if (kind === 'recent') return buildAbsoluteUrl(CRICBUZZ_BASE, '/cricket-match/live-scores/recent-matches');
  return buildAbsoluteUrl(CRICBUZZ_BASE, '/cricket-match/live-scores');
}

async function fetchCricbuzzList(kind) {
  const html = await safeText(getCricbuzzListUrl(kind), { ttlMs: CACHE_TTL_MS });
  if (!html) return [];
  return parseCricbuzzMatchListPage({ html, baseUrl: CRICBUZZ_BASE }).filter((match) => match.kind === kind);
}

async function fetchCricbuzzScoreSummary(matchId) {
  const url = buildAbsoluteUrl(CRICBUZZ_BASE, `/live-cricket-scores/${encodeURIComponent(matchId)}`);
  const html = await safeText(url, { ttlMs: CACHE_TTL_MS });
  if (!html) return null;
  return {
    title: parseTitleFromHtml(html),
    summary: parseScoreSummaryFromHtml(html),
  };
}

function toHomeCricketMatch(rawMatch, kind, summaryData) {
  const state = deriveCricketState(rawMatch, summaryData, kind);
  const { matchTitle, resultText } = splitCricketTitleAndStatus(rawMatch.title, rawMatch.status);
  const [shortHome, shortAway] = splitCricketTeams(matchTitle || rawMatch.matchInfo || rawMatch.status);
  const fallbackHome = shortHome;
  const fallbackAway = shortAway;
  const parsedSummary = alignCricketSides(
    splitCricketSummary(summaryData?.summary, fallbackHome, fallbackAway),
    fallbackHome,
    fallbackAway,
  );
  const home = resolveCricketDisplayName(parsedSummary?.home?.name, fallbackHome);
  const away = resolveCricketDisplayName(parsedSummary?.away?.name, fallbackAway);
  const cricketMeta = extractCricketMeta(rawMatch.matchInfo, summaryData?.title, summaryData?.summary);
  const venue = extractCricketVenue(summaryData?.title, rawMatch.matchInfo);
  const resultSummary = compactCricketResult(summaryData?.summary, resultText);
  const readableTeams = extractCricketReadableTeams(resultSummary, summaryData?.title, summaryData?.summary);
  const summary = resultSummary || summaryData?.summary || rawMatch.status || rawMatch.matchInfo;
  const result = resultSummary || (state === 'post' ? summary : '');
  const isAbandonedMatch = state === 'post' && isCricketAbandoned(summaryData?.summary || '', resultText, rawMatch.status);
  const winnerText = `${summaryData?.summary || ''} ${resultText}`;
  let homeWinner = state === 'post' && (cricketWinnerFromText(winnerText, home) || cricketWinnerFromCode(winnerText, home));
  let awayWinner = state === 'post' && (cricketWinnerFromText(winnerText, away) || cricketWinnerFromCode(winnerText, away));
  if (!homeWinner && !awayWinner && state === 'post' && parsedSummary?.home?.score && parsedSummary?.away?.score) {
    const homeRuns = cricketPrimaryScore(parsedSummary.home.score);
    const awayRuns = cricketPrimaryScore(parsedSummary.away.score);
    if (homeRuns != null && awayRuns != null && homeRuns !== awayRuns) {
      homeWinner = homeRuns > awayRuns;
      awayWinner = awayRuns > homeRuns;
    }
  }
  const searchText = [home, away, rawMatch.series, rawMatch.category, rawMatch.title].join(' ');

  return buildHomeMatch({
    id: `cricbuzz_${kind}_${rawMatch.matchId}`,
    sport: 'cricket',
    match: readableTeams ? `${readableTeams.home} vs ${readableTeams.away}` : (matchTitle || `${home} vs ${away}`),
    league: expandCricketCompetitionLabel(rawMatch.series || cricketMeta.competition || rawMatch.category, cricketMeta.matchType, readableTeams ? `${readableTeams.home} vs ${readableTeams.away}` : matchTitle),
    matchType: cricketMeta.matchType,
    state,
    summary,
    result,
    detail: rawMatch.matchInfo || cricketMeta.matchType,
    clock: state === 'in' ? rawMatch.status || 'Live' : '',
    venue,
    competitors: [
      { name: home, score: parsedSummary?.home?.score || '', winner: isAbandonedMatch ? false : homeWinner },
      { name: away, score: parsedSummary?.away?.score || '', winner: isAbandonedMatch ? false : awayWinner },
    ],
    isIndiaMatch: isIndia(searchText),
    isAbandoned: isAbandonedMatch,
    source: 'cricbuzz',
  });
}

async function fetchCricketMatches() {
  const [liveRaw, upcomingRaw, recentRaw] = await Promise.all([
    fetchCricbuzzList('live'),
    fetchCricbuzzList('upcoming'),
    fetchCricbuzzList('recent'),
  ]);

  const enrichCricketList = async (matches, kind) => promisePool(
    matches,
    async (match) => toHomeCricketMatch(match, kind, await fetchCricbuzzScoreSummary(match.matchId)),
    4,
  );

  const [liveMatches, upcomingMatches, recentMatches] = await Promise.all([
    enrichCricketList(liveRaw, 'live'),
    enrichCricketList(upcomingRaw, 'upcoming'),
    enrichCricketList(recentRaw, 'recent'),
  ]);

  return [
    ...liveMatches,
    ...upcomingMatches,
    ...recentMatches,
  ];
}

function classifyKabaddiState(event) {
  const state = String(event?.event_state || '').toUpperCase();
  if (state === 'L') return 'live';
  if (state === 'U') return 'upcoming';
  if (state === 'R') return 'recent';
  const status = String(event?.event_status || '').toLowerCase();
  if (status.includes('completed') || status.includes('result')) return 'recent';
  if (status.includes('live') || status.includes('in progress')) return 'live';
  if (status.includes('upcoming') || status.includes('scheduled')) return 'upcoming';
  return 'unknown';
}

function extractWindowObject({ html, variableName }) {
  const marker = `window.${variableName} = `;
  const start = html.indexOf(marker);
  if (start === -1) return undefined;

  let i = start + marker.length;
  while (i < html.length && /\s/.test(html[i])) i += 1;
  if (html[i] !== '{') return undefined;

  let depth = 0;
  let inString = false;
  let quote = null;
  let escaped = false;
  const begin = i;

  for (; i < html.length; i += 1) {
    const ch = html[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return html.slice(begin, i + 1);
  }

  return undefined;
}

async function fetchKabaddiMatches() {
  const html = await safeText(buildAbsoluteUrl(PRO_KABADDI_BASE, '/schedule-fixtures-results'));
  if (!html) return [];

  const jsonText = extractWindowObject({ html, variableName: 'fixtureWidgetData' });
  if (!jsonText) return [];

  const widget = JSON.parse(jsonText);
  const rawEvents = Object.values(widget?.fixtureByDate || {}).flat();
  const matches = [];

  for (const event of rawEvents) {
    const kind = classifyKabaddiState(event);
    if (!['live', 'upcoming', 'recent'].includes(kind)) continue;
    const state = stateFromKind(kind);

    const participants = asArray(event?.participants).map((item) => ({
      name: normalizeWhitespace(item?.name || item?.short_name),
      score: item?.value ?? item?.score ?? '',
      numericScore: toNumberOrUndefined(item?.value ?? item?.score),
    }));
    const homeScore = participants[0]?.numericScore;
    const awayScore = participants[1]?.numericScore;
    const searchText = [
      event?.event_name,
      event?.event_sub_status,
      event?.series_name,
      ...participants.map((team) => team.name),
    ].join(' ');

    matches.push(buildHomeMatch({
      id: `kabaddi_${event?.game_id || event?.event_id || event?.id || matches.length}`,
      sport: 'kabaddi',
      match: event?.event_name,
      league: event?.series_name || event?.league_code || 'Pro Kabaddi',
      matchType: event?.event_name?.split(',')[1] || '',
      state,
      date: event?.start_date || null,
      summary: event?.event_sub_status || event?.event_status,
      result: state === 'post' ? (event?.event_sub_status || event?.event_status) : '',
      detail: event?.event_status,
      clock: kind === 'live' ? event?.event_status || 'Live' : '',
      venue: event?.venue_name,
      competitors: participants.slice(0, 2).map((team, index) => ({
        name: team.name,
        score: team.score,
        winner: state === 'post' && homeScore != null && awayScore != null
          ? (index === 0 ? homeScore > awayScore : awayScore > homeScore)
          : false,
      })),
      isIndiaMatch: isIndia(searchText) || true,
      source: 'prokabaddi',
    }));
  }

  return matches;
}

function pickRecordSummary(records) {
  return asArray(records).map((record) => record?.summary).find(Boolean);
}

function buildScoreLine({ home, away, separator = ' - ' }) {
  if (!home || !away) return undefined;
  if (home.score === undefined || away.score === undefined) return undefined;
  const homeLabel = home.abbreviation || home.name || 'HOME';
  const awayLabel = away.abbreviation || away.name || 'AWAY';
  return `${homeLabel} ${home.score}${separator}${away.score} ${awayLabel}`;
}

function normalizeEspnEvent(event) {
  const competition = event?.competitions?.[0];
  const competitors = asArray(competition?.competitors);

  const participants = competitors
    .map((item) => {
      const team = item?.team || {};
      return {
        id: team.id,
        name: team.displayName || team.name,
        abbreviation: team.abbreviation,
        score: toNumberOrString(item?.score),
        record: pickRecordSummary(item?.records),
        winner: Boolean(item?.winner),
        homeAway: item?.homeAway,
      };
    })
    .filter(Boolean);

  const home =
    participants.find((participant) => participant.homeAway === 'home') ||
    participants.find((participant) => participant.homeAway === 'away') ||
    participants[0];
  const away =
    participants.find((participant) => participant.homeAway === 'away') ||
    participants.find((participant) => participant.homeAway === 'home') ||
    participants[1];

  const status = competition?.status || event?.status;
  const statusText = status?.type?.shortDetail || status?.type?.detail || status?.type?.description || undefined;

  return {
    eventId: event?.id,
    name: event?.name,
    shortName: event?.shortName,
    date: event?.date,
    status,
    statusText,
    state: status?.type?.state,
    clock: status?.displayClock,
    period: status?.period,
    competition: {
      id: competition?.id,
      venue: competition?.venue,
    },
    participants,
    home,
    away,
    scoreLine: buildScoreLine({ home, away }),
  };
}

function normalizeEspnTennisCompetition({ tournament, grouping, competition }) {
  const participants = asArray(competition?.competitors)
    .map((item) => {
      const athlete = item?.athlete;
      const team = item?.team;
      const name = athlete?.displayName || athlete?.fullName || team?.displayName || team?.name;
      const abbreviation = athlete?.shortName || team?.abbreviation;
      return {
        id: athlete?.id || team?.id,
        name,
        abbreviation,
        score: toNumberOrUndefined(item?.score),
        winner: Boolean(item?.winner),
        homeAway: item?.homeAway,
        linescores: asArray(item?.linescores).map((score) => toNumberOrUndefined(score?.value)),
      };
    })
    .filter((participant) => participant?.name);

  const home =
    participants.find((participant) => participant.homeAway === 'home') ||
    participants.find((participant) => participant.homeAway === 'away') ||
    participants[0];
  const away =
    participants.find((participant) => participant.homeAway === 'away') ||
    participants.find((participant) => participant.homeAway === 'home') ||
    participants[1];

  const status = competition?.status;
  const statusText = status?.type?.shortDetail || status?.type?.detail || status?.type?.description || undefined;

  const maxSets = Math.max(home?.linescores?.length || 0, away?.linescores?.length || 0);
  const sets = maxSets > 0
    ? Array.from({ length: maxSets }, (_, index) => ({
        home: home?.linescores?.[index],
        away: away?.linescores?.[index],
      }))
    : undefined;

  const computedSetWins = sets
    ? sets.reduce((acc, set) => {
        if (typeof set.home === 'number' && typeof set.away === 'number') {
          if (set.home > set.away) acc.home += 1;
          if (set.away > set.home) acc.away += 1;
        }
        return acc;
      }, { home: 0, away: 0 })
    : undefined;

  if (home && away && (home.score === undefined || away.score === undefined) && computedSetWins) {
    home.score = computedSetWins.home;
    away.score = computedSetWins.away;
  }

  const setScoreText = sets
    ? sets
        .map((set) => (set.home !== undefined && set.away !== undefined ? `${set.home}-${set.away}` : undefined))
        .filter(Boolean)
        .join(' ')
    : undefined;

  const scoreLineBase = buildScoreLine({ home, away, separator: '-' });

  return {
    eventId: competition?.id,
    name: home && away ? `${home.name} vs ${away.name}` : tournament?.name,
    shortName: home && away ? `${home.abbreviation || home.name} vs ${away.abbreviation || away.name}` : tournament?.shortName,
    date: competition?.date || tournament?.date,
    status,
    statusText,
    state: status?.type?.state,
    participants,
    home,
    away,
    grouping: grouping?.displayName,
    scoreLine: setScoreText && scoreLineBase ? `${scoreLineBase} (${setScoreText})` : scoreLineBase || setScoreText,
  };
}

function flattenEspnTennisEvents(events) {
  const matches = [];
  for (const tournament of asArray(events)) {
    for (const groupingEntry of asArray(tournament?.groupings)) {
      for (const competition of asArray(groupingEntry?.competitions)) {
        matches.push(normalizeEspnTennisCompetition({
          tournament,
          grouping: groupingEntry?.grouping,
          competition,
        }));
      }
    }
  }
  return matches.filter((match) => match?.eventId);
}

async function fetchEspnScoreboard({ sport, league, dates }) {
  const url = `${ESPN_BASE}/sports/${sport}/${league}/scoreboard?dates=${dates}`;
  const data = await safeJson(url);
  if (!data) return [];

  const rawEvents = asArray(data?.events);
  const normalized = sport === 'tennis' && rawEvents.some((event) => Array.isArray(event?.groupings))
    ? flattenEspnTennisEvents(rawEvents)
    : rawEvents.map(normalizeEspnEvent);

  const leagueInfo = data?.leagues?.[0];
  return normalized.map((event) => ({
    ...event,
    leagueSlug: league,
    leagueName: leagueInfo?.name || league,
  }));
}

function toHomeEspnMatch(event, sportKey) {
  const participants = event?.participants || [];
  if (participants.length < 2) return null;
  const leagueLabel = [event?.leagueName, sportKey === 'tennis' ? event?.grouping : '']
    .filter(Boolean)
    .join(' · ') || event?.leagueName || event?.grouping || SPORT_META[sportKey]?.name || '';
  const searchText = [
    event?.name,
    event?.shortName,
    leagueLabel,
    ...participants.map((participant) => participant?.name),
  ].join(' ');

  return buildHomeMatch({
    id: `espn_${sportKey}_${event.eventId}`,
    sport: sportKey,
    match: event?.name || event?.shortName,
    league: leagueLabel,
    matchType: event?.status?.type?.description || '',
    state: event?.state || 'post',
    date: event?.date || null,
    summary: event?.scoreLine || event?.statusText,
    result: event?.state === 'post' ? (event?.scoreLine || event?.statusText) : '',
    detail: event?.status?.type?.detail || event?.statusText,
    clock: event?.state === 'in' ? [event?.clock, event?.statusText].filter(Boolean).join(' · ') : '',
    venue: event?.competition?.venue?.fullName,
    competitors: participants.map((participant) => ({
      name: participant.name || participant.abbreviation || '?',
      score: participant.score ?? '',
      winner: Boolean(participant.winner),
    })),
    isIndiaMatch: isIndia(searchText),
    source: 'espn',
  });
}

async function fetchEspnPrimaryMatches() {
  const dates = [yyyymmddFromOffset(-1), yyyymmddFromOffset(0), yyyymmddFromOffset(1)];
  const tasks = PRIMARY_ESPN_SPORTS.flatMap((cfg) =>
    cfg.leagues.flatMap((league) => dates.map((date) => ({ cfg, league, date })))
  );

  const boards = await promisePool(
    tasks,
    async ({ cfg, league, date }) => ({ cfg, events: await fetchEspnScoreboard({ sport: cfg.sport, league, dates: date }) }),
    6,
  );

  const byEventId = new Map();
  for (const board of boards) {
    for (const event of board.events) {
      const key = `${board.cfg.key}:${event.eventId}`;
      if (!event?.eventId || byEventId.has(key)) continue;
      const normalized = toHomeEspnMatch(event, board.cfg.key);
      if (normalized) byEventId.set(key, normalized);
    }
  }

  return Array.from(byEventId.values());
}

async function getLatestF1Year() {
  const index = await safeJson(`${F1_LIVE_BASE}Index.json`);
  const year = index?.Years?.[0]?.Year;
  return year ? String(year) : undefined;
}

async function listF1SessionsForYear(year) {
  const data = await safeJson(`${F1_LIVE_BASE}${year}/Index.json`);
  const meetings = asArray(data?.Meetings);
  const sessions = [];

  for (const meeting of meetings) {
    for (const session of asArray(meeting?.Sessions)) {
      sessions.push({
        meetingKey: meeting?.Key,
        meetingName: meeting?.Name,
        meetingOfficialName: meeting?.OfficialName,
        circuit: meeting?.Circuit,
        country: meeting?.Country,
        sessionKey: session?.Key,
        sessionType: session?.Type,
        sessionName: session?.Name,
        startUtcMs: parseIsoLocalToUtcMs(session?.StartDate, session?.GmtOffset),
        endUtcMs: parseIsoLocalToUtcMs(session?.EndDate, session?.GmtOffset),
        path: session?.Path,
      });
    }
  }

  return sessions
    .filter((session) => session.path && session.startUtcMs !== undefined)
    .sort((a, b) => a.startUtcMs - b.startUtcMs);
}

function pickF1Session(sessions, referenceMs = nowMs()) {
  const active = sessions.find((session) => {
    if (session.startUtcMs === undefined || session.endUtcMs === undefined) return false;
    return referenceMs >= session.startUtcMs - 2 * H1 && referenceMs <= session.endUtcMs + 3 * H1;
  });
  if (active) return active;
  return undefined;
}

async function getF1Keyframe(sessionPath, feedName) {
  const index = await safeJson(`${F1_LIVE_BASE}${sessionPath}Index.json`);
  const keyPath = index?.Feeds?.[feedName]?.KeyFramePath;
  if (!keyPath) return undefined;
  return safeJson(`${F1_LIVE_BASE}${sessionPath}${keyPath}`);
}

async function fetchF1LiveMatch() {
  const year = await getLatestF1Year();
  if (!year) return [];

  const session = pickF1Session(await listF1SessionsForYear(year));
  if (!session?.path) return [];

  const sessionPath = session.path.endsWith('/') ? session.path : `${session.path}/`;
  const [sessionStatus, driverList, timing] = await Promise.all([
    getF1Keyframe(sessionPath, 'SessionStatus'),
    getF1Keyframe(sessionPath, 'DriverList'),
    getF1Keyframe(sessionPath, 'TimingDataF1'),
  ]);

  const state =
    sessionStatus?.Started === 'Started' && sessionStatus?.Status !== 'Ends'
      ? 'in'
      : sessionStatus?.Started === 'Finished' || sessionStatus?.Status === 'Ends'
        ? 'post'
        : 'pre';

  if (state !== 'in') return [];

  const lines = timing?.Lines || {};
  const drivers = driverList || {};
  const standings = Object.values(lines)
    .map((line) => {
      const position = toNumberOrUndefined(line?.Position);
      const racingNumber = String(line?.RacingNumber || '');
      const driver = normalizeDriver(drivers?.[racingNumber]) || { fullName: racingNumber, lastName: racingNumber };
      return {
        position,
        driver,
        gapToLeader: line?.GapToLeader,
      };
    })
    .filter((row) => typeof row.position === 'number')
    .sort((a, b) => a.position - b.position);

  const title = buildSessionTitle({
    meetingName: session.meetingName,
    sessionType: session.sessionType,
    sessionName: session.sessionName,
  });

  return [
    buildHomeMatch({
      id: `f1_live_${session.sessionKey || session.meetingKey}`,
      sport: 'f1',
      match: title,
      league: session.meetingOfficialName || session.meetingName,
      state: 'in',
      date: session.startUtcMs ? new Date(session.startUtcMs).toISOString() : null,
      summary: standings[0]?.driver?.fullName ? `Leader: ${standings[0].driver.fullName}` : sessionStatus?.Status || 'Live',
      detail: session.sessionType,
      clock: sessionStatus?.Status || 'Live',
      venue: session.circuit?.ShortName || session.circuit?.Name || session.country?.Name,
      competitors: standings.slice(0, 5).map((row) => ({
        name: row.driver?.lastName || row.driver?.fullName || '?',
        score: row.position === 1 ? 'Leader' : row.gapToLeader || '',
        winner: row.position === 1,
      })),
      isIndiaMatch: false,
      source: 'f1livetiming',
    }),
  ];
}

function normalizeF1Race(race) {
  const season = String(race?.season || '');
  const round = String(race?.round || '');
  const eventId = season && round ? `${season}-${round}` : undefined;
  const whenIso = race?.date && race?.time
    ? `${race.date}T${String(race.time).replace('Z', '')}Z`
    : race?.date
      ? `${race.date}T00:00:00Z`
      : undefined;

  return {
    eventId,
    name: race?.raceName,
    date: whenIso,
    circuitName: race?.Circuit?.circuitName,
    country: race?.Circuit?.Location?.country,
    locality: race?.Circuit?.Location?.locality,
    results: asArray(race?.Results).map((result) => ({
      position: toNumberOrUndefined(result?.position),
      driverName: [result?.Driver?.givenName, result?.Driver?.familyName].filter(Boolean).join(' '),
    })),
  };
}

async function fetchF1UpcomingAndResults() {
  const [nextRaw, lastRaw] = await Promise.all([
    safeJson(`${F1_RESULTS_BASE}/current/next.json`),
    safeJson(`${F1_RESULTS_BASE}/current/last/results.json`),
  ]);

  const out = [];
  const nextRace = normalizeF1Race(nextRaw?.MRData?.RaceTable?.Races?.[0]);
  if (nextRace?.eventId) {
    out.push(buildHomeMatch({
      id: `f1_next_${nextRace.eventId}`,
      sport: 'f1',
      match: nextRace.name,
      league: 'Formula 1',
      matchType: 'Upcoming Race',
      state: 'pre',
      date: nextRace.date,
      summary: [nextRace.locality, nextRace.country].filter(Boolean).join(', ') || 'Upcoming race',
      venue: nextRace.circuitName,
      competitors: [],
      isIndiaMatch: false,
      source: 'ergast',
    }));
  }

  const lastRace = normalizeF1Race(lastRaw?.MRData?.RaceTable?.Races?.[0]);
  if (lastRace?.eventId) {
    out.push(buildHomeMatch({
      id: `f1_last_${lastRace.eventId}`,
      sport: 'f1',
      match: lastRace.name,
      league: 'Formula 1',
      matchType: 'Race Result',
      state: 'post',
      date: lastRace.date,
      summary: lastRace.results?.[0]?.driverName ? `${lastRace.results[0].driverName} won` : 'Result',
      result: lastRace.results?.[0]?.driverName ? `${lastRace.results[0].driverName} won` : 'Result',
      venue: lastRace.circuitName,
      competitors: lastRace.results.slice(0, 3).map((row) => ({
        name: row.driverName || '?',
        score: '',
        winner: row.position === 1,
      })),
      isIndiaMatch: false,
      source: 'ergast',
    }));
  }

  return out;
}

async function fetchF1Matches() {
  const [liveMatches, scheduleMatches] = await Promise.all([
    fetchF1LiveMatch(),
    fetchF1UpcomingAndResults(),
  ]);
  return [...liveMatches, ...scheduleMatches];
}

async function fetchBadmintonMatches() {
  const homeText = await safeText(buildProxyUrl(BWF_HOME_URL), { ttlMs: CACHE_TTL_MS });
  if (!homeText) return [];

  const tournamentId = parseTournamentIdFromHome(homeText);
  const homeTitle = parseNextLiveTournamentTitle(homeText) || parseTournamentTitle(homeText);
  const homeDateRange = parseTournamentDateRange(homeText);
  if (!tournamentId) {
    return homeTitle
      ? [buildHomeMatch({
          id: 'bwf_home',
          sport: 'badminton',
          match: homeTitle,
          league: 'BWF Match Centre',
          matchType: 'Upcoming Tournament',
          state: 'pre',
          summary: homeDateRange || 'Upcoming tournament',
          competitors: [],
          isIndiaMatch: isIndia(homeTitle),
          source: 'bwf-proxy',
        })]
      : [];
  }

  const tournamentText = await safeText(buildProxyUrl(`${BWF_HOME_URL}${tournamentId}`), { ttlMs: CACHE_TTL_MS });
  const title = parseTournamentTitle(tournamentText) || homeTitle;
  const dateRange = parseTournamentDateRange(tournamentText) || homeDateRange;
  const liveMatches = parseLiveMatchesFromTournament(tournamentText);

  if (liveMatches.length > 0) {
    return liveMatches.map((match, index) => buildHomeMatch({
      id: `bwf_live_${tournamentId}_${match.id || index}`,
      sport: 'badminton',
      match: title ? `${title} · Court ${match.court ?? '?'}` : `Badminton · Court ${match.court ?? '?'}`,
      league: 'BWF Match Centre',
      matchType: `Court ${match.court ?? '?'}`,
      state: 'in',
      summary: match.scoreLine || 'Live',
      detail: match.raw,
      clock: 'Live',
      competitors: [],
      isIndiaMatch: isIndia(`${title} ${match.raw}`),
      source: 'bwf-proxy',
    }));
  }

  return title
    ? [buildHomeMatch({
        id: `bwf_tournament_${tournamentId}`,
        sport: 'badminton',
        match: title,
        league: 'BWF Match Centre',
        matchType: 'Tournament',
        state: 'pre',
        summary: dateRange || 'Upcoming tournament',
        competitors: [],
        isIndiaMatch: isIndia(title),
        source: 'bwf-proxy',
      })]
    : [];
}

function parseWinner(resultText, homeName, awayName) {
  if (!resultText || !homeName || !awayName) return { homeWin: false, awayWin: false };
  const result = resultText.toLowerCase();
  const home = homeName.toLowerCase();
  const away = awayName.toLowerCase();
  return {
    homeWin: result.includes(`${home} won`) || result.includes(`${home} win`) || result.startsWith(`${home} `),
    awayWin: result.includes(`${away} won`) || result.includes(`${away} win`) || result.startsWith(`${away} `),
  };
}

function sportsDbToMatch(event, overrideSport) {
  const sport = overrideSport ?? event.strSport ?? 'Unknown';
  const meta = SPORTSDB_META[sport] ?? { key: sport.toLowerCase().replace(/\s+/g, ''), name: sport, emoji: '🏅' };
  const rawStatus = normalizeWhitespace(event.strStatus);
  const statusText = `${rawStatus} ${event.strProgress || ''}`.toLowerCase();

  const explicitlyNotStarted =
    rawStatus === 'NS' || rawStatus === '' ||
    statusText.includes('not started') ||
    statusText.includes('fixture') ||
    statusText.includes('scheduled') ||
    statusText.includes('postponed');

  const live =
    statusText.includes('live') ||
    statusText.includes('inning') ||
    statusText.includes('progress') ||
    statusText.includes('quarter') ||
    statusText.includes('half') ||
    statusText.includes('set ');

  const doneText =
    !live &&
    !explicitlyNotStarted &&
    (statusText.includes('finish') ||
      statusText.includes('complet') ||
      statusText.includes('result') ||
      statusText.includes('final') ||
      statusText.includes('won') ||
      statusText.includes(' win'));

  const hasBothScores = event.intHomeScore != null && event.intAwayScore != null;
  const dateStr = event.strTimestamp
    ?? (event.dateEvent && event.strTime ? `${event.dateEvent}T${event.strTime}+00:00` : null)
    ?? (event.dateEvent ? `${event.dateEvent}T00:00:00Z` : null);
  const eventTime = dateStr ? new Date(dateStr).getTime() : null;
  const state = live
    ? 'in'
    : (doneText || hasBothScores || (eventTime != null && eventTime < nowMs() - H1 && !explicitlyNotStarted))
      ? 'post'
      : 'pre';

  const preMax = H1D;
  const postMax = H1D;
  if (!inWindow(dateStr, state, preMax, postMax)) return null;

  const [homeName, awayName] = parseVsNames(event.strEvent, event.strHomeTeam, event.strAwayTeam);
  const cleanResult = stripTags(event.strResult);
  const cleanProgress = stripTags(event.strProgress);
  const summary = cleanResult || (state === 'in' ? cleanProgress || 'Live' : rawStatus === 'NS' ? '' : rawStatus);

  let homeWin = state === 'post' && hasBothScores && Number(event.intHomeScore) > Number(event.intAwayScore);
  let awayWin = state === 'post' && hasBothScores && Number(event.intAwayScore) > Number(event.intHomeScore);
  if (state === 'post' && !homeWin && !awayWin && event.strResult) {
    const parsed = parseWinner(event.strResult, homeName, awayName);
    homeWin = parsed.homeWin;
    awayWin = parsed.awayWin;
  }

  return buildHomeMatch({
    id: `sdb_${event.idEvent}`,
    sport: meta.key,
    match: event.strEvent || `${homeName} vs ${awayName}`,
    league: event.strLeague || event.strSeason || event.strSeries || sportName || meta.name,
    state,
    date: dateStr,
    summary,
    detail: cleanProgress,
    clock: state === 'in' ? 'Live' : '',
    venue: event.strVenue || event.strCountry,
    competitors: [
      { name: homeName, score: event.intHomeScore != null ? String(event.intHomeScore) : '', winner: homeWin },
      { name: awayName, score: event.intAwayScore != null ? String(event.intAwayScore) : '', winner: awayWin },
    ],
    isIndiaMatch: isIndia([homeName, awayName, event.strLeague, event.strSport].join(' ')),
    source: 'sportsdb',
  });
}

async function fetchSportsDbIndia() {
  const data = await safeJson(`${SPORTSDB_BASE}/searchteams.php?t=India`);
  const teams = asArray(data?.teams)
    .filter((team) => {
      const name = String(team?.strTeam || '').toLowerCase();
      return name === 'india' || name.startsWith('india ') || name.endsWith(' india') || name.includes(' india ');
    })
    .slice(0, 30);

  const eventLists = await Promise.allSettled(
    teams.flatMap((team) => [
      safeJson(`${SPORTSDB_BASE}/eventsnext.php?id=${team.idTeam}`).then((response) => response?.events ?? []),
      safeJson(`${SPORTSDB_BASE}/eventslast.php?id=${team.idTeam}`).then((response) => response?.events ?? []),
    ]),
  );

  const events = [];
  const seen = new Set();
  for (const result of eventLists) {
    if (result.status !== 'fulfilled') continue;
    for (const event of result.value) {
      if (!event?.idEvent || seen.has(event.idEvent)) continue;
      seen.add(event.idEvent);
      const match = sportsDbToMatch(event);
      if (match) events.push(match);
    }
  }

  return events;
}

async function fetchSportsDbToday() {
  const sports = ['Cricket', 'Soccer', 'Field Hockey', 'Kabaddi', 'Badminton', 'Tennis', 'Golf'];
  const dates = [isoDateFromOffset(-1), isoDateFromOffset(0), isoDateFromOffset(1)];

  const resultSets = await Promise.allSettled(
    sports.flatMap((sport) =>
      dates.map((date) =>
        safeJson(`${SPORTSDB_BASE}/eventsday.php?d=${date}&s=${encodeURIComponent(sport)}`)
          .then((response) => ({ sport, events: response?.events ?? [] }))
      )
    ),
  );

  const seen = new Set();
  const matches = [];
  for (const result of resultSets) {
    if (result.status !== 'fulfilled') continue;
    for (const event of result.value.events) {
      if (!event?.idEvent || seen.has(event.idEvent)) continue;
      seen.add(event.idEvent);
      const match = sportsDbToMatch(event, result.value.sport);
      if (match) matches.push(match);
    }
  }

  return matches;
}

async function fetchLegacyGolfEspn() {
  const scoreboard = await safeJson(`${ESPN_BASE}/sports/golf/scoreboard`);
  if (!scoreboard?.events?.length) return [];

  const matches = [];
  for (const event of scoreboard.events) {
    const competition = event?.competitions?.[0];
    if (!competition) continue;
    const state = competition?.status?.type?.state ?? 'post';
    const date = competition?.date ?? event?.date ?? null;
    if (!inWindow(date, state, H1D, H1D)) continue;
    matches.push(buildHomeMatch({
      id: `golf_${event.id}`,
      sport: 'golf',
      match: event.shortName || event.name || 'Golf',
      league: event.season?.displayName || event.name || competition?.type?.text || 'Golf',
      matchType: competition?.status?.type?.description || '',
      state,
      date,
      summary: competition?.status?.summary || '',
      result: state === 'post' ? (competition?.status?.summary || '') : '',
      detail: competition?.status?.type?.detail || '',
      clock: state === 'in' ? 'Live' : '',
      venue: competition?.venue?.fullName,
      competitors: asArray(competition?.competitors).slice(0, 6).map((competitor) => ({
        name: competitor?.athlete?.shortName || competitor?.athlete?.displayName || competitor?.team?.shortDisplayName || '?',
        score: competitor?.score ?? '',
        winner: competitor?.winner === true || competitor?.winner === 'true',
      })),
      isIndiaMatch: false,
      source: 'espn',
    }));
  }

  return matches;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const forceFresh = req.query?.refresh === '1';

  const results = await Promise.allSettled([
    fetchCricketMatches(),
    fetchEspnPrimaryMatches(),
    fetchKabaddiMatches(),
    fetchF1Matches(),
    fetchBadmintonMatches(),
    fetchSportsDbIndia(),
    fetchSportsDbToday(),
    fetchLegacyGolfEspn(),
  ]);

  const primary = uniqueById([
    ...(results[0].status === 'fulfilled' ? results[0].value : []),
    ...(results[1].status === 'fulfilled' ? results[1].value : []),
    ...(results[2].status === 'fulfilled' ? results[2].value : []),
    ...(results[3].status === 'fulfilled' ? results[3].value : []),
    ...(results[4].status === 'fulfilled' ? results[4].value : []),
  ]);

  const primarySports = new Set(primary.map((match) => match.sport));
  const fallbackCandidates = uniqueById([
    ...(results[5].status === 'fulfilled' ? results[5].value : []),
    ...(results[6].status === 'fulfilled' ? results[6].value : []),
    ...(results[7].status === 'fulfilled' ? results[7].value : []),
  ]);

  const fallback = fallbackCandidates.filter((match) => !primarySports.has(match.sport));
  const all = sortMatches(uniqueById([...primary, ...fallback]).filter(keepForFocusedFeed));
  const live = all.filter((match) => match.state === 'in');
  const upcoming = all.filter((match) => match.state === 'pre');
  const completed = all.filter((match) => match.state === 'post');
  res.setHeader(
    'Cache-Control',
    forceFresh
      ? 'no-store'
      : live.length > 0
        ? 'public, max-age=0, s-maxage=15, must-revalidate'
        : 'public, max-age=0, s-maxage=45, must-revalidate',
  );

  return res.status(200).json({
    matches: all,
    live,
    upcoming,
    completed,
    counts: {
      live: live.length,
      upcoming: upcoming.length,
      completed: completed.length,
    },
  });
}
