/**
 * cricket.js — Cricket data pipeline
 *
 * Runs in GitHub Actions (Azure IPs, not Vercel AWS IPs).
 * Azure IPs have better chance of reaching ESPNCricinfo + Cricbuzz.
 *
 * Sources tried in order (all parallel):
 *  1. ESPNCricinfo consumer API  — live / upcoming / results slugs
 *  2. Cricbuzz HTML              — live + upcoming + recent API fragments
 *
 * Stores matches in Supabase `cricket_matches` table.
 * Vercel /api/sports reads from this table — no scraping from Vercel.
 *
 * Run: node cricket.js
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { load as $ } from 'cheerio';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const ESPNCI = 'https://hs-consumer-api.espncricinfo.com/v1/pages';
const CB     = 'https://www.cricbuzz.com/api/html/livescores';
const NOW    = Date.now();
const H7D    = 7  * 24 * 3600000;
const H72    = 72 * 3600000;

// ── India detection ───────────────────────────────────────────────────────
const INDIA_KW = [
  'india', 'indian', ' ind ', 'ipl ', 'bcci',
  'csk', 'chennai super', 'mumbai indians', 'kolkata knight', 'kkr',
  'royal challengers', 'rcb', 'delhi capitals', 'pbks', 'punjab kings',
  'gujarat titans', 'sunrisers', 'srh', 'lucknow super', 'lsg',
  'rajasthan royals', 'india women', 'india a', 'india u19',
];
function isIndia(text = '') {
  const t = (' ' + text + ' ').toLowerCase();
  return INDIA_KW.some(k => t.includes(k));
}

// ── HTTP helpers ──────────────────────────────────────────────────────────
const CI_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-IN,en;q=0.9',
  Origin: 'https://www.espncricinfo.com',
  Referer: 'https://www.espncricinfo.com/',
};
const CB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,*/*',
  'Accept-Language': 'en-IN,en;q=0.9',
  Referer: 'https://www.cricbuzz.com/',
  'sec-fetch-site': 'same-origin',
};

async function safeJson(url, headers = CI_HEADERS) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
    if (!r.ok) { console.warn(`  HTTP ${r.status}: ${url}`); return null; }
    return await r.json();
  } catch (e) { console.warn(`  fetch error ${url}: ${e.message}`); return null; }
}

async function safeText(url, headers = CB_HEADERS) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
    if (!r.ok) { console.warn(`  HTTP ${r.status}: ${url}`); return null; }
    return await r.text();
  } catch (e) { console.warn(`  fetch error ${url}: ${e.message}`); return null; }
}

// ── Date helpers ──────────────────────────────────────────────────────────
function inWindow(dateStr, state) {
  if (!dateStr) return true;
  const t = new Date(dateStr).getTime();
  if (isNaN(t)) return true;
  if (state === 'post' && NOW - t > H72) return false;
  if (state === 'pre'  && t - NOW > H7D)  return false;
  return true;
}

// ── ESPNCricinfo state detection ──────────────────────────────────────────
function ciState(m) {
  const id  = m.status?.type?.id ?? '';
  const txt = (m.status?.displayText ?? '').toLowerCase();
  if (id === 'InProgress' || txt.includes('live'))  return 'in';
  if (id === 'Finished'   || txt.includes('won') || txt.includes('draw') || txt.includes('abandon')) return 'post';
  return 'pre';
}

function ciToRow(m, seriesName = '') {
  const state = ciState(m);
  const date  = m.startTime ?? null;
  if (!inWindow(date, state)) return null;

  const teams = (m.teams ?? []).map(t => {
    const runs    = t.score?.runs;
    const wickets = t.score?.wickets;
    const overs   = t.score?.overs;
    return {
      name:  t.team?.longName ?? t.team?.name ?? '?',
      score: (runs != null) ? `${runs}/${wickets ?? ''}${overs != null ? ` (${overs} ov)` : ''}` : '',
      winner: state === 'post' && !!t.isWinner,
    };
  });

  const league   = seriesName || m.series?.name || '';
  const searchTx = teams.map(t => t.name).join(' ') + ' ' + league;
  const matchId  = String(m.objectId ?? m.id ?? m.matchId ?? Math.random());

  return {
    match_id:    `ci_${matchId}`,
    series_name: league,
    match_title: m.description ?? m.title ?? league ?? 'Cricket',
    match_format: m.matchType ?? '',
    state,
    status_text: m.status?.displayText ?? '',
    venue:       m.venue?.name ?? m.ground?.longName ?? '',
    match_date:  date,
    teams,
    is_india:    isIndia(searchTx),
    source:      'espncricinfo',
    updated_at:  new Date().toISOString(),
  };
}

// ── SOURCE 1: ESPNCricinfo consumer API ───────────────────────────────────
function extractMatches(json) {
  if (!json) return [];
  if (json.content?.matches?.length) return json.content.matches;
  if (json.matches?.length) return json.matches;
  if (Array.isArray(json.content?.typeMatches)) {
    return json.content.typeMatches.flatMap(t =>
      (t.seriesMatches ?? []).flatMap(s => s.seriesAdWrapper?.matches ?? [])
    );
  }
  return [];
}

async function fetchESPNCricinfo() {
  const SLUGS = [
    'live-cricket-score',
    'upcoming-cricket-matches',
    'cricket-results',
    'cricket-ipl',
    'india-cricket',
    'women-cricket',
  ];

  const seen = new Set();
  const rows = [];

  const addMatch = (m, name) => {
    const id = m.objectId ?? m.id;
    if (id && seen.has(String(id))) return;
    if (id) seen.add(String(id));
    const row = ciToRow(m, name);
    if (row) rows.push(row);
  };

  // Slug pages
  const slugResults = await Promise.allSettled(
    SLUGS.map(slug => safeJson(`${ESPNCI}/matches/home?slug=${slug}`))
  );
  for (const r of slugResults) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    for (const m of extractMatches(r.value)) addMatch(m, '');
  }
  console.log(`  ESPNCricinfo slugs: ${rows.length} matches`);

  // Series list
  const seriesData = await safeJson(`${ESPNCI}/series/list?lang=en&hasFixtures=true`);
  const seriesList = seriesData?.content?.series ?? seriesData?.series ?? [];
  console.log(`  ESPNCricinfo series: ${seriesList.length} active`);

  if (seriesList.length) {
    const fetches = seriesList.slice(0, 25).map(s =>
      safeJson(`${ESPNCI}/series/matches?lang=en&seriesId=${s.objectId}`)
        .then(r => ({ name: s.description || s.name || '', matches: extractMatches(r) }))
    );
    const results = await Promise.allSettled(fetches);
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const m of r.value.matches) addMatch(m, r.value.name);
    }
  }

  console.log(`  ESPNCricinfo total: ${rows.length}`);
  return rows;
}

// ── SOURCE 2: Cricbuzz HTML scraping ─────────────────────────────────────
function parseCricbuzz(html, fallbackState) {
  if (!html || html.length < 200) return [];
  const rows = [];

  // Series positions for context
  const seriesRe = /class="[^"]*cb-lst-mtch-hdr[^"]*"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g;
  const seriesPos = [];
  let sh;
  while ((sh = seriesRe.exec(html)) !== null) {
    const name = html.slice(sh.index, sh.index + sh[0].length)
      .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    seriesPos.push({ pos: sh.index, name });
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

    const series = seriesPos.filter(s => s.pos < matchPos).at(-1)?.name ?? '';

    // Team name + score
    const teamRe = /class="[^"]*cb-col-60[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]{0,500}?class="[^"]*cb-tms-scr[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    const teams = [];
    let tm;
    while ((tm = teamRe.exec(inner)) !== null && teams.length < 2) {
      const name  = tm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const score = tm[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (name) teams.push({ name, score, winner: false });
    }
    if (!teams.length) continue;

    const stM   = /class="[^"]*cb-min-stts[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(inner);
    const stTxt = (stM?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
    const cls   = (/cb-text-(\w+)/.exec(inner))?.[1] ?? '';

    const state = cls === 'inprogress' ? 'in'
      : (cls === 'complete' || cls === 'winning') ? 'post'
      : cls === 'scheduled' ? 'pre'
      : fallbackState;

    const searchTx = teams.map(t => t.name).join(' ') + ' ' + series;
    rows.push({
      match_id:    `cb_${idM[1]}`,
      series_name: series,
      match_title: teams.length >= 2 ? `${teams[0].name} vs ${teams[1].name}` : teams[0].name,
      match_format: '',
      state,
      status_text: stTxt,
      venue:       '',
      match_date:  null,
      teams,
      is_india:    isIndia(searchTx),
      source:      'cricbuzz',
      updated_at:  new Date().toISOString(),
    });
  }
  return rows;
}

async function fetchCricbuzz() {
  const [lHtml, uHtml, rHtml] = await Promise.all([
    safeText(CB),
    safeText(`${CB}/upcoming`),
    safeText(`${CB}/recent`),
  ]);
  const live = parseCricbuzz(lHtml, 'in');
  const up   = parseCricbuzz(uHtml, 'pre');
  const rec  = parseCricbuzz(rHtml, 'post');
  console.log(`  Cricbuzz: ${live.length} live | ${up.length} upcoming | ${rec.length} recent`);
  return [...live, ...up, ...rec];
}

// ── Supabase upsert ───────────────────────────────────────────────────────
async function upsertMatches(rows) {
  if (!rows.length) { console.log('  No rows to upsert'); return; }

  // Store teams as JSONB
  const records = rows.map(r => ({
    match_id:    r.match_id,
    series_name: r.series_name,
    match_title: r.match_title,
    match_format: r.match_format,
    state:       r.state,
    status_text: r.status_text,
    venue:       r.venue,
    match_date:  r.match_date,
    teams:       r.teams,         // JSONB array
    is_india:    r.is_india,
    source:      r.source,
    updated_at:  r.updated_at,
  }));

  const { error } = await supabase
    .from('cricket_matches')
    .upsert(records, { onConflict: 'match_id' });

  if (error) {
    console.error('  Supabase upsert error:', error.message);
  } else {
    console.log(`  Upserted ${records.length} cricket matches`);
  }
}

async function cleanupStale() {
  // Delete matches older than 3 days from Supabase
  const cutoff = new Date(NOW - 3 * 24 * 3600000).toISOString();
  const { error } = await supabase
    .from('cricket_matches')
    .delete()
    .lt('updated_at', cutoff);
  if (error) console.warn('  Cleanup error:', error.message);
  else console.log('  Cleaned up stale matches');
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('Cricket pipeline started:', new Date().toISOString());

  const [ciRows, cbRows] = await Promise.all([
    fetchESPNCricinfo(),
    fetchCricbuzz(),
  ]);

  // Merge — ESPNCricinfo first (richer data), Cricbuzz fills gaps
  const seen = new Set();
  const all  = [];
  for (const row of [...ciRows, ...cbRows]) {
    if (seen.has(row.match_id)) continue;
    seen.add(row.match_id);
    all.push(row);
  }

  console.log(`Total: ${all.length} cricket matches (India: ${all.filter(r => r.is_india).length})`);
  await upsertMatches(all);
  await cleanupStale();

  console.log('Cricket pipeline done:', new Date().toISOString());
}

main().catch(e => { console.error(e); process.exit(1); });
