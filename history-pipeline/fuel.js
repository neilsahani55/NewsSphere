/**
 * Fuel price pipeline — ported from the rate/ project which was verified working.
 *
 * Providers (same as rate/src/providers/):
 *   PRIMARY   indiatoday.in       — individual state pages, #render_today_price
 *   FALLBACK  hindustantimes.com  — state-wise table (petrol + diesel)
 *   CNG       pricekeeda.com      — state-wise CNG table
 *
 * Uses cheerio for HTML parsing (no regex fragility).
 * Stores petrol_{state} / diesel_{state} / cng_{state} in Supabase market_data.
 * Zero baseline / static values — only real scraped prices are stored.
 *
 * Runs every 6 hours via .github/workflows/fuel.yml
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { load as $ } from 'cheerio';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

// ── Utilities ──────────────────────────────────────────────────────────────

async function fetchText(url, timeoutMs = 15_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET', redirect: 'follow', signal: ctrl.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeKey(input) {
  const key = String(input ?? '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  return ({ pondicherry: 'puducherry' })[key] ?? key;
}

function toSupabaseKey(stateKey) { return stateKey.replace(/\s+/g, '_'); }

function parseInr(text) {
  const n = parseFloat(String(text ?? '').replace(/[^0-9.]+/g, ''));
  return isFinite(n) ? n : null;
}

// Concurrency-limited map (same as rate/src/providers/indiatoday/shared.js)
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ── Provider: indiatoday.in ────────────────────────────────────────────────
// Ported from rate/src/providers/indiatoday/shared.js

const IT_BASE = 'https://www.indiatoday.in/fuel-price';
let _cachedStates = null;

function toTitleCase(s) {
  return String(s ?? '').trim().toLowerCase().split(/\s+/g).filter(Boolean)
    .map(w => w === 'and' ? 'and' : w[0].toUpperCase() + w.slice(1)).join(' ');
}

async function getIndiaToday_StateList() {
  if (_cachedStates) return _cachedStates;
  const html = await fetchText(`${IT_BASE}/petrol-price-in-andhra-pradesh-today`);
  const doc  = $(html);
  const best = doc('select').toArray()
    .map(s => {
      const opts = doc(s).find('option').toArray()
        .map(o => doc(o).text().trim()).filter(Boolean);
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
  _cachedStates = uniq;
  return uniq;
}

async function getIndiaToday(fuel, unit) {
  const states = await getIndiaToday_StateList();
  const concurrency = Number(process.env.UPSTREAM_CONCURRENCY ?? 6);
  console.log(`  IndiaToday ${fuel}: ${states.length} states, concurrency=${concurrency}`);

  const rows = await mapLimit(states, concurrency, async state => {
    try {
      const slug = normalizeKey(state).replace(/\s+/g, '-');
      const url  = `${IT_BASE}/${fuel}-price-in-${slug}-today`;
      const html = await fetchText(url, 12_000);
      const doc  = $(html);
      const rate = parseFloat(doc('#render_today_price').first().text().trim());
      if (!isFinite(rate)) return null;
      return { state, stateKey: normalizeKey(state), rate, unit };
    } catch { return null; }
  });

  const out = rows.filter(Boolean);
  console.log(`  IndiaToday ${fuel}: ${out.length} states fetched`);
  return out;
}

// ── Provider: hindustantimes.com ───────────────────────────────────────────
// Ported from rate/src/providers/hindustanTimes/shared.js

async function getHindustanTimes(fuel, unit) {
  const url  = `https://www.hindustantimes.com/fuel-prices/${fuel}-rates-state-wise`;
  const html = await fetchText(url);
  const doc  = $(html);

  const target = doc('table').toArray().find(t => {
    const headers = doc(t).find('tr').first().find('th,td').toArray()
      .map(c => doc(c).text().trim().toLowerCase());
    return headers.includes('state') && headers.some(h => h.includes(fuel));
  });

  if (!target) throw new Error('HindustanTimes: state-wise table not found');

  const rows = doc(target).find('tr').slice(1).toArray().map(r => {
    const cols = doc(r).find('td').toArray().map(c => doc(c).text().trim());
    if (cols.length < 2) return null;
    const rate = parseInr(cols[1]);
    if (!cols[0] || rate == null) return null;
    return { state: cols[0], stateKey: normalizeKey(cols[0]), rate, unit };
  }).filter(Boolean);

  console.log(`  HindustanTimes ${fuel}: ${rows.length} states`);
  return rows;
}

// ── Provider: pricekeeda.com (CNG) ─────────────────────────────────────────
// Ported from rate/src/providers/pricekeeda/cng.js

async function getPricekeeda() {
  const url  = 'https://www.pricekeeda.com/fuel/cng-price-in-india/';
  const html = await fetchText(url);
  const doc  = $(html);

  const candidates = doc('table').toArray()
    .map(t => {
      const headers = doc(t).find('tr').first().find('th,td').toArray()
        .map(c => doc(c).text().trim().toLowerCase()).join(' | ');
      if (!headers.includes('cng') || !headers.includes('kg')) return null;
      const rows = doc(t).find('tr').slice(1).toArray().map(r => {
        const cols = doc(r).find('td').toArray().map(c => doc(c).text().trim());
        if (cols.length < 2) return null;
        const rate = parseInr(cols[1]);
        return cols[0] && rate != null
          ? { state: cols[0], stateKey: normalizeKey(cols[0]), rate, unit: 'INR/kg' }
          : null;
      }).filter(Boolean);
      if (rows.length < 5) return null;
      const score = rows.length +
        (rows.some(r => r.stateKey.includes('pradesh') || r.stateKey === 'delhi') ? 1000 : 0);
      return { rows, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const out = candidates[0]?.rows ?? [];
  console.log(`  Pricekeeda CNG: ${out.length} states`);
  return out;
}

// ── Merge: primary → fill gaps with fallback ───────────────────────────────

async function merged(primaryFn, fallbackFn, minRows = 30) {
  let primary = [];
  try { primary = await primaryFn(); } catch (e) { console.warn(`  Primary failed: ${e.message}`); }

  const byKey = new Map(primary.map(r => [r.stateKey, r]));

  if (primary.length < minRows) {
    let fallback = [];
    try { fallback = await fallbackFn(); } catch (e) { console.warn(`  Fallback failed: ${e.message}`); }
    for (const r of fallback) {
      if (!byKey.has(r.stateKey)) byKey.set(r.stateKey, r);
    }
  }

  return Array.from(byKey.values());
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  console.log(`=== Fuel pipeline: ${now} ===\n`);

  // Fetch state list first (shared across all fuels, cached in memory)
  console.log('Getting state list from IndiaToday...');
  await getIndiaToday_StateList();

  // Fetch all three fuels in sequence (IndiaToday is 36 per-state requests)
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

  console.log(`\n── Results ──`);
  console.log(`Petrol: ${petrolRows.length} states | Diesel: ${dieselRows.length} states | CNG: ${cngRows.length} states`);

  if (petrolRows.length === 0 && dieselRows.length === 0) {
    console.error('No data fetched — both providers failed. Supabase not updated.');
    process.exit(1);
  }

  // Build Supabase upsert rows — ONLY real scraped data, no baseline
  const rows = [];
  for (const r of petrolRows) rows.push({ key: `petrol_${toSupabaseKey(r.stateKey)}`, price: r.rate, change_pct: null, updated_at: now });
  for (const r of dieselRows) rows.push({ key: `diesel_${toSupabaseKey(r.stateKey)}`, price: r.rate, change_pct: null, updated_at: now });
  for (const r of cngRows)    rows.push({ key: `cng_${toSupabaseKey(r.stateKey)}`,    price: r.rate, change_pct: null, updated_at: now });

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('market_data')
      .upsert(rows.slice(i, i + 100), { onConflict: 'key' });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  console.log(`\nUpserted ${rows.length} rows to Supabase`);

  // Spot-check
  for (const key of ['maharashtra', 'delhi', 'andhra pradesh', 'karnataka']) {
    const p = petrolRows.find(r => r.stateKey === key);
    const d = dieselRows.find(r => r.stateKey === key);
    if (p || d) console.log(`  ${key}: petrol=₹${p?.rate ?? '—'}  diesel=₹${d?.rate ?? '—'}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
