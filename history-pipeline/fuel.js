/**
 * Fuel price pipeline — fetches petrol & diesel prices for all 36 Indian
 * states and union territories and upserts into Supabase market_data.
 *
 * Sources tried in order:
 *  1. HPCL batch API  — official Indian oil company JSON endpoint
 *  2. goodreturns.in  — highly reliable financial site, HTML scraping
 *                       per state (no client-side JS needed for prices)
 *  3. Baseline table  — hardcoded fallback for any state still missing
 *
 * Keys: petrol_{state_key} | diesel_{state_key}   (one row per state per fuel)
 * Upsert (onConflict:'key') always REPLACES — never adds duplicate rows.
 *
 * Runs every 6 hours via GitHub Actions.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// All 36 states + UTs with their Supabase key and goodreturns.in URL segment
const STATES = [
  { key: 'andhra_pradesh',        gr: 'andhra-pradesh'        },
  { key: 'arunachal_pradesh',     gr: 'arunachal-pradesh'     },
  { key: 'assam',                  gr: 'assam'                 },
  { key: 'bihar',                  gr: 'bihar'                 },
  { key: 'chhattisgarh',           gr: 'chhattisgarh'          },
  { key: 'goa',                    gr: 'goa'                   },
  { key: 'gujarat',                gr: 'gujarat'               },
  { key: 'haryana',                gr: 'haryana'               },
  { key: 'himachal_pradesh',       gr: 'himachal-pradesh'      },
  { key: 'jharkhand',              gr: 'jharkhand'             },
  { key: 'karnataka',              gr: 'karnataka'             },
  { key: 'kerala',                 gr: 'kerala'                },
  { key: 'madhya_pradesh',         gr: 'madhya-pradesh'        },
  { key: 'maharashtra',            gr: 'maharashtra'           },
  { key: 'manipur',                gr: 'manipur'               },
  { key: 'meghalaya',              gr: 'meghalaya'             },
  { key: 'mizoram',                gr: 'mizoram'               },
  { key: 'nagaland',               gr: 'nagaland'              },
  { key: 'odisha',                 gr: 'odisha'                },
  { key: 'punjab',                 gr: 'punjab'                },
  { key: 'rajasthan',              gr: 'rajasthan'             },
  { key: 'sikkim',                 gr: 'sikkim'                },
  { key: 'tamil_nadu',             gr: 'tamil-nadu'            },
  { key: 'telangana',              gr: 'telangana'             },
  { key: 'tripura',                gr: 'tripura'               },
  { key: 'uttar_pradesh',          gr: 'uttar-pradesh'         },
  { key: 'uttarakhand',            gr: 'uttarakhand'           },
  { key: 'west_bengal',            gr: 'west-bengal'           },
  // Union Territories
  { key: 'andaman_and_nicobar_islands', gr: 'andaman-nicobar-islands' },
  { key: 'chandigarh',             gr: 'chandigarh'            },
  { key: 'dadra_and_nagar_haveli_and_daman_and_diu', gr: 'dadra-nagar-haveli' },
  { key: 'delhi',                  gr: 'delhi'                 },
  { key: 'jammu_and_kashmir',      gr: 'jammu-kashmir'         },
  { key: 'ladakh',                 gr: 'ladakh'                },
  { key: 'lakshadweep',            gr: 'lakshadweep'           },
  { key: 'puducherry',             gr: 'puducherry'            },
];

// Baseline prices (post-March 2024 central revision, ₹2 cut)
const BASELINE = {
  andhra_pradesh: { p: 109.41, d: 97.21 }, arunachal_pradesh: { p: 97.43,  d: 84.12 },
  assam:          { p: 96.01,  d: 83.94 }, bihar:             { p: 107.24, d: 94.04 },
  chhattisgarh:   { p: 102.70, d: 94.76 }, goa:               { p: 96.81,  d: 90.08 },
  gujarat:        { p: 96.63,  d: 92.38 }, haryana:           { p: 95.03,  d: 87.86 },
  himachal_pradesh: { p: 97.50, d: 85.60 }, jharkhand:        { p: 99.09,  d: 96.77 },
  karnataka:      { p: 102.86, d: 88.94 }, kerala:            { p: 102.05, d: 90.55 },
  madhya_pradesh: { p: 108.65, d: 93.77 }, maharashtra:       { p: 103.44, d: 89.97 },
  manipur:        { p: 99.49,  d: 90.71 }, meghalaya:         { p: 97.53,  d: 88.14 },
  mizoram:        { p: 101.18, d: 91.47 }, nagaland:          { p: 99.00,  d: 88.60 },
  odisha:         { p: 103.19, d: 94.76 }, punjab:            { p: 96.94,  d: 83.67 },
  rajasthan:      { p: 104.88, d: 90.36 }, sikkim:            { p: 102.50, d: 89.60 },
  tamil_nadu:     { p: 100.75, d: 92.34 }, telangana:         { p: 107.41, d: 95.65 },
  tripura:        { p: 97.13,  d: 88.07 }, uttar_pradesh:     { p: 96.57,  d: 89.76 },
  uttarakhand:    { p: 95.42,  d: 88.11 }, west_bengal:       { p: 103.94, d: 90.56 },
  andaman_and_nicobar_islands: { p: 82.96, d: 79.41 },
  chandigarh:     { p: 94.24,  d: 82.40 },
  dadra_and_nagar_haveli_and_daman_and_diu: { p: 94.19, d: 86.86 },
  delhi:          { p: 94.72,  d: 87.62 }, jammu_and_kashmir: { p: 97.77,  d: 88.70 },
  ladakh:         { p: 100.30, d: 88.70 }, lakshadweep:       { p: 83.40,  d: 73.90 },
  puducherry:     { p: 98.30,  d: 90.50 },
};

// ── Source 1: HPCL batch JSON ─────────────────────────────────────────────
async function fetchHPCL() {
  const endpoints = [
    'https://www.hindustanpetroleum.com/FetchFuelPrices',
    'https://www.hindustanpetroleum.com/FetchFuelPricesNew',
    'https://www.hindustanpetroleum.com/assets/json/fuelpricesData.json',
  ];
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json, */*', Referer: 'https://www.hindustanpetroleum.com/' },
        signal: AbortSignal.timeout(12000),
      });
      console.log(`  HPCL ${url.split('/').pop()} → HTTP ${r.status}`);
      if (!r.ok) continue;
      const text = await r.text();
      let json;
      try { json = JSON.parse(text); } catch { console.log('    not JSON'); continue; }
      const rows = Array.isArray(json) ? json : (json?.data ?? json?.result ?? json?.rates ?? null);
      if (!Array.isArray(rows) || rows.length === 0) { console.log('    empty'); continue; }
      const out = {};
      for (const row of rows) {
        const sName = row.State ?? row.state ?? row.StateName ?? '';
        const p = parseFloat(row.Petrol ?? row.petrol ?? row.PetrolPrice ?? 0);
        const d = parseFloat(row.Diesel ?? row.diesel ?? row.DieselPrice ?? 0);
        if (!sName || !(p > 50)) continue;
        const key = sName.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_');
        out[key] = { p, d };
      }
      if (Object.keys(out).length > 5) {
        console.log(`  ✓ HPCL: ${Object.keys(out).length} states`);
        return out;
      }
    } catch (e) { console.log(`  HPCL error: ${e.message}`); }
  }
  return null;
}

// ── Source 2: goodreturns.in HTML scraping per state ─────────────────────
// Goodreturns is a well-maintained Indian financial site. Their state-specific
// fuel price pages are server-rendered so the price is in the initial HTML.
async function scrapeGoodReturns(grSlug, fuel) {
  const url = `https://www.goodreturns.in/${fuel}-price-in-${grSlug}.html`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html', Referer: 'https://www.goodreturns.in/' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const html = await r.text();

    // Goodreturns puts the current price in a heading/table near the top.
    // Pattern: "₹XX.XX" or "Rs XX.XX" appearing early in the page.
    // Try several regex patterns in order of specificity:
    const patterns = [
      // Most specific: price in a cell/span right after keyword
      new RegExp(`${fuel}[^₹\\d]{1,200}₹\\s*(\\d{2,3}\\.\\d{2})`, 'i'),
      // Price near "today" or "current"
      /(?:today|current)[^₹\d]{0,100}₹\s*(\d{2,3}\.\d{2})/i,
      // Any ₹XX.XX in the first 3000 chars that looks like a fuel price
    ];
    for (const re of patterns) {
      const m = html.slice(0, 8000).match(re);
      if (m) {
        const val = parseFloat(m[1]);
        if (val > 50 && val < 200) return val;
      }
    }
    // Fallback: find all ₹XX.XX values and pick the first plausible fuel price
    const all = [...html.slice(0, 8000).matchAll(/₹\s*(\d{2,3}\.\d{2})/g)]
      .map(m => parseFloat(m[1])).filter(v => v > 70 && v < 160);
    return all.length > 0 ? all[0] : null;
  } catch { return null; }
}

async function fetchGoodReturnsAll() {
  console.log('  Fetching goodreturns.in (per state, in parallel batches)...');
  const out = {};
  const BATCH = 6; // concurrent requests per batch

  for (let i = 0; i < STATES.length; i += BATCH) {
    const batch = STATES.slice(i, i + BATCH);
    await Promise.all(batch.map(async ({ key, gr }) => {
      const [p, d] = await Promise.all([
        scrapeGoodReturns(gr, 'petrol'),
        scrapeGoodReturns(gr, 'diesel'),
      ]);
      if (p && d) {
        out[key] = { p, d };
        console.log(`    ✓ ${key}: petrol=${p} diesel=${d}`);
      } else {
        console.log(`    ✗ ${key}: p=${p} d=${d} (will use baseline)`);
      }
    }));
    // Brief pause between batches to be polite
    if (i + BATCH < STATES.length) await new Promise(r => setTimeout(r, 800));
  }
  console.log(`  goodreturns.in: ${Object.keys(out).length}/${STATES.length} states scraped`);
  return Object.keys(out).length > 5 ? out : null;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const now = new Date().toISOString();
  console.log(`=== Fuel price pipeline: ${now} ===\n`);

  // Source 1: HPCL batch
  console.log('Trying HPCL...');
  let live = await fetchHPCL();

  // Source 2: goodreturns.in (more reliable)
  if (!live) {
    console.log('\nHPCL unavailable — trying goodreturns.in scraping...');
    live = await fetchGoodReturnsAll();
  }

  // Merge live over baseline (baseline fills any missing states)
  const merged = { ...BASELINE };
  if (live) {
    let updated = 0;
    for (const [key, prices] of Object.entries(live)) {
      if (prices.p > 50 && prices.d > 50) { merged[key] = prices; updated++; }
    }
    console.log(`\n✓ Live data updated ${updated} states; baseline covers the remaining.`);
  } else {
    console.log('\n⚠ All live sources failed — storing baseline prices for all states.');
  }

  // Build upsert rows
  const rows = [];
  for (const [stateKey, prices] of Object.entries(merged)) {
    const p = prices.p ?? prices.petrol;
    const d = prices.d ?? prices.diesel;
    rows.push({ key: `petrol_${stateKey}`, price: p,    change_pct: null, updated_at: now });
    rows.push({ key: `diesel_${stateKey}`, price: d ?? null, change_pct: null, updated_at: now });
  }

  console.log(`\nUpserting ${rows.length} rows into market_data...`);
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from('market_data').upsert(rows.slice(i, i + CHUNK), { onConflict: 'key' });
    if (error) throw new Error(`Supabase upsert: ${error.message}`);
  }
  console.log(`Done. ${rows.length / 2} states × petrol + diesel stored (source: ${live ? 'live' : 'baseline'}).`);
}

main().catch(err => { console.error(err); process.exit(1); });
