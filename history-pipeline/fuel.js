/**
 * Fuel price pipeline — IndiaToday (primary) + HindustanTimes (fallback)
 * + Pricekeeda (CNG fallback). Uses cheerio for HTML parsing.
 *
 * Fixes vs previous version:
 *  - Retry with exponential backoff (3 attempts per state)
 *  - 200 ms delay between each request to avoid rate limiting
 *  - Concurrency reduced from 6 → 4
 *  - Maharashtra: tries #render_today_price first, then broader selectors
 *    (some state pages render the price in a different element)
 *  - Verbose per-state logging so the job log shows every failure reason
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { load as $load } from 'cheerio';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── HTTP ──────────────────────────────────────────────────────────────────

async function fetchText(url, timeoutMs = 15_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET', redirect: 'follow', signal: ctrl.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'accept-language': 'en-IN,en-US;q=0.9,en;q=0.8',
        'accept-encoding': 'gzip, deflate, br',
        'cache-control': 'no-cache',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Retry with exponential backoff
async function fetchWithRetry(url, maxAttempts = 3, timeoutMs = 15_000) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchText(url, timeoutMs);
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts) await sleep(500 * attempt);
    }
  }
  throw lastErr;
}

// ── Utilities ─────────────────────────────────────────────────────────────

function normalizeKey(input) {
  const key = String(input ?? '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  return ({ pondicherry: 'puducherry' })[key] ?? key;
}

function toSupabaseKey(k) { return k.replace(/\s+/g, '_'); }

function parseInr(text) {
  const n = parseFloat(String(text ?? '').replace(/[^0-9.]+/g, ''));
  return isFinite(n) && n > 10 && n < 300 ? n : null;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
      await sleep(200);          // polite delay between every request
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ── Provider: indiatoday.in ────────────────────────────────────────────────

const IT_BASE = 'https://www.indiatoday.in/fuel-price';
let _states = null;

function toTitleCase(s) {
  return String(s ?? '').trim().toLowerCase().split(/\s+/g).filter(Boolean)
    .map(w => (w === 'and' ? 'and' : w[0].toUpperCase() + w.slice(1))).join(' ');
}

async function getStateList() {
  if (_states) return _states;
  const html = await fetchWithRetry(`${IT_BASE}/petrol-price-in-andhra-pradesh-today`);
  const doc  = $load(html);
  const best = doc('select').toArray()
    .map(s => {
      const opts = doc(s).find('option').toArray().map(o => doc(o).text().trim()).filter(Boolean);
      const keys = opts.map(normalizeKey);
      const score = opts.length +
        (keys.includes('andhra pradesh') && keys.includes('delhi') ? 1000 : 0);
      return { opts, score };
    })
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.opts.length < 10) throw new Error('Could not extract state list from indiatoday.in');

  const uniq = []; const seen = new Set();
  for (const s of best.opts.filter(o => !/^select\s+/i.test(o)).map(toTitleCase)) {
    const k = normalizeKey(s);
    if (!seen.has(k)) { seen.add(k); uniq.push(s); }
  }
  _states = uniq;
  console.log(`  State list: ${uniq.length} states (${uniq.slice(0,5).join(', ')} ...)`);
  return uniq;
}

/**
 * Extract price from an IndiaToday state fuel-price page.
 * Tries multiple selectors because some state pages render the price
 * in different elements (#render_today_price, .fuel-price, data attrs, etc.).
 */
function extractITPrice(html, label) {
  const doc = $load(html);

  // Selector 1: primary (used by most states)
  const el1 = doc('#render_today_price').first().text().trim();
  const v1  = parseInr(el1);
  if (v1) return v1;

  // Selector 2: common alternative
  const el2 = doc('[id*="today_price"]').first().text().trim();
  const v2  = parseInr(el2);
  if (v2) return v2;

  // Selector 3: any element with class containing "price" near a ₹ sign
  for (const el of doc('[class*="price"], [class*="rate"]').toArray()) {
    const txt = doc(el).text().trim();
    if (txt.includes('₹') || /^\d{2,3}\.\d{2}$/.test(txt)) {
      const v = parseInr(txt);
      if (v) return v;
    }
  }

  // Selector 4: find ₹XX.XX pattern anywhere in the page body text
  const bodyText = doc('body').text();
  const m = bodyText.match(/₹\s*(\d{2,3}\.\d{2})/);
  const v4 = m ? parseInr(m[1]) : null;

  if (label === 'maharashtra') {
    console.log(`    Maharashtra debug:`);
    console.log(`      #render_today_price text: "${el1}"`);
    console.log(`      [id*=today_price] text: "${el2}"`);
    console.log(`      body ₹ match: ${m ? m[0] : 'none'}`);
    console.log(`      Parsed: ${v4 ?? 'null'}`);
  }

  return v4;
}

async function getIndiaToday(fuel, unit) {
  const states = await getStateList();
  const concurrency = Math.min(4, Number(process.env.UPSTREAM_CONCURRENCY ?? 4));
  console.log(`  IndiaToday ${fuel}: ${states.length} states, concurrency=${concurrency}`);

  const rows = await mapLimit(states, concurrency, async state => {
    const stateKey = normalizeKey(state);
    const slug     = stateKey.replace(/\s+/g, '-');
    const url      = `${IT_BASE}/${fuel}-price-in-${slug}-today`;
    try {
      const html = await fetchWithRetry(url, 3, 12_000);
      const rate = extractITPrice(html, stateKey);
      if (!rate) {
        console.log(`    ✗ ${state} (${stateKey}): no price found`);
        return null;
      }
      return { state, stateKey, rate, unit };
    } catch (e) {
      console.log(`    ✗ ${state}: ${e.message}`);
      return null;
    }
  });

  const out = rows.filter(Boolean);
  const missing = states.filter((s, i) => !rows[i]);
  console.log(`  IndiaToday ${fuel}: ${out.length}/${states.length} fetched`);
  if (missing.length) console.log(`  Missing: ${missing.join(', ')}`);
  return out;
}

// ── Provider: hindustantimes.com (fallback petrol/diesel) ─────────────────

async function getHindustanTimes(fuel, unit) {
  const url  = `https://www.hindustantimes.com/fuel-prices/${fuel}-rates-state-wise`;
  const html = await fetchWithRetry(url);
  const doc  = $load(html);

  const target = doc('table').toArray().find(t => {
    const headers = doc(t).find('tr').first().find('th,td').toArray()
      .map(c => doc(c).text().trim().toLowerCase());
    return headers.includes('state') && headers.some(h => h.includes(fuel));
  });

  if (!target) throw new Error('HindustanTimes: state table not found');

  const rows = doc(target).find('tr').slice(1).toArray().map(r => {
    const cols = doc(r).find('td').toArray().map(c => doc(c).text().trim());
    if (cols.length < 2) return null;
    const rate = parseInr(cols[1]);
    if (!cols[0] || !rate) return null;
    return { state: cols[0], stateKey: normalizeKey(cols[0]), rate, unit };
  }).filter(Boolean);

  console.log(`  HindustanTimes ${fuel}: ${rows.length} states`);
  return rows;
}

// ── Provider: pricekeeda.com (CNG fallback) ───────────────────────────────

async function getPricekeeda() {
  const url  = 'https://www.pricekeeda.com/fuel/cng-price-in-india/';
  const html = await fetchWithRetry(url);
  const doc  = $load(html);

  const candidates = doc('table').toArray().map(t => {
    const headers = doc(t).find('tr').first().find('th,td').toArray()
      .map(c => doc(c).text().trim().toLowerCase()).join(' | ');
    if (!headers.includes('cng') || !headers.includes('kg')) return null;
    const rows = doc(t).find('tr').slice(1).toArray().map(r => {
      const cols = doc(r).find('td').toArray().map(c => doc(c).text().trim());
      const rate = cols.length >= 2 ? parseInr(cols[1]) : null;
      return cols[0] && rate ? { state: cols[0], stateKey: normalizeKey(cols[0]), rate, unit: 'INR/kg' } : null;
    }).filter(Boolean);
    if (rows.length < 5) return null;
    const score = rows.length + (rows.some(r => r.stateKey.includes('pradesh')) ? 1000 : 0);
    return { rows, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score);

  const out = candidates[0]?.rows ?? [];
  console.log(`  Pricekeeda CNG: ${out.length} states`);
  return out;
}

// ── Merge: primary fills first, fallback fills gaps ────────────────────────

async function merged(primaryFn, fallbackFn, minRows = 30) {
  let primary = [];
  try { primary = await primaryFn(); } catch (e) { console.warn(`  Primary error: ${e.message}`); }

  const byKey = new Map(primary.map(r => [r.stateKey, r]));

  if (primary.length < minRows) {
    console.log(`  Primary returned ${primary.length} < ${minRows}, running fallback...`);
    try {
      const fallback = await fallbackFn();
      for (const r of fallback) {
        if (!byKey.has(r.stateKey)) byKey.set(r.stateKey, r);
      }
    } catch (e) { console.warn(`  Fallback error: ${e.message}`); }
  }

  return Array.from(byKey.values());
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  console.log(`=== Fuel pipeline: ${now} ===\n`);

  // Fetch state list once (shared across all fuels)
  console.log('Getting state list...');
  await getStateList();

  // Fetch fuels sequentially to reduce total concurrent load on IndiaToday
  console.log('\n── Petrol ──');
  const petrolRows = await merged(
    () => getIndiaToday('petrol', 'INR/L'),
    () => getHindustanTimes('petrol', 'INR/L'),
  );

  console.log('\n── Diesel ──');
  const dieselRows = await merged(
    () => getIndiaToday('diesel', 'INR/L'),
    () => getHindustanTimes('diesel', 'INR/L'),
  );

  console.log('\n── CNG ──');
  const cngRows = await merged(
    () => getIndiaToday('cng', 'INR/kg'),
    () => getPricekeeda(),
    20,
  );

  console.log(`\n── Summary ──`);
  console.log(`Petrol: ${petrolRows.length} | Diesel: ${dieselRows.length} | CNG: ${cngRows.length}`);

  if (petrolRows.length === 0 && dieselRows.length === 0) {
    console.error('Nothing fetched — aborting Supabase write.');
    process.exit(1);
  }

  // Build rows — only real scraped data
  const rows = [];
  for (const r of petrolRows) rows.push({ key: `petrol_${toSupabaseKey(r.stateKey)}`, price: r.rate, change_pct: null, updated_at: now });
  for (const r of dieselRows) rows.push({ key: `diesel_${toSupabaseKey(r.stateKey)}`, price: r.rate, change_pct: null, updated_at: now });
  for (const r of cngRows)    rows.push({ key: `cng_${toSupabaseKey(r.stateKey)}`,    price: r.rate, change_pct: null, updated_at: now });

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('market_data').upsert(rows.slice(i, i + 100), { onConflict: 'key' });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  console.log(`\nUpserted ${rows.length} rows`);

  // Spot-check important states
  const check = ['maharashtra', 'delhi', 'andhra pradesh', 'karnataka', 'gujarat'];
  for (const key of check) {
    const p = petrolRows.find(r => r.stateKey === key);
    const d = dieselRows.find(r => r.stateKey === key);
    console.log(`  ${key.padEnd(20)} petrol=₹${p?.rate ?? '—'}  diesel=₹${d?.rate ?? '—'}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
