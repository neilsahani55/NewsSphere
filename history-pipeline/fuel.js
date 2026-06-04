/**
 * Fuel price pipeline — fetches petrol & diesel prices for every Indian
 * state and union territory from HPCL/IOC (no CORS on GitHub Actions runner)
 * and upserts into Supabase market_data. One row per state per fuel type;
 * every run replaces old values (never adds duplicate rows).
 *
 * Keys stored:  petrol_{state_key}  and  diesel_{state_key}
 * Example:      petrol_maharashtra = 103.44  |  diesel_maharashtra = 89.97
 *
 * Runs every 6 hours via GitHub Actions. Fuel prices change at 6 AM IST
 * daily, so 6-hourly updates are more than sufficient.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

// Normalise a state name to the key format used in Supabase
function toKey(name = '') {
  return name
    .toLowerCase()
    .replace(/\bncт?\s+of\s+/g, '')   // "NCT of Delhi" → "delhi"
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

// Known aliases that HPCL/IOC might use
const ALIAS = {
  'odisha':              'odisha',
  'orissa':              'odisha',
  'uttaranchal':         'uttarakhand',
  'jammu & kashmir':     'jammu_and_kashmir',
  'j & k':               'jammu_and_kashmir',
  'a & n islands':       'andaman_and_nicobar_islands',
  'andaman & nicobar':   'andaman_and_nicobar_islands',
  'dadra & nagar haveli':'dadra_and_nagar_haveli_and_daman_and_diu',
  'dnh & dd':            'dadra_and_nagar_haveli_and_daman_and_diu',
  'pondicherry':         'puducherry',
};

function normaliseState(raw = '') {
  const lower = raw.trim().toLowerCase();
  return ALIAS[lower] || toKey(raw);
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── HPCL ──────────────────────────────────────────────────────────────────
async function fetchHPCL() {
  const endpoints = [
    'https://www.hindustanpetroleum.com/FetchFuelPrices',
    'https://www.hindustanpetroleum.com/FetchFuelPricesNew',
    'https://www.hindustanpetroleum.com/assets/json/fuelpricesData.json',
    'https://www.hindustanpetroleum.com/price_update',
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', Referer: 'https://www.hindustanpetroleum.com/' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) { console.warn(`  HPCL ${url} → HTTP ${res.status}`); continue; }

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { console.warn(`  HPCL ${url} → not JSON`); continue; }

      // Accept array directly or wrapped in a data/result property
      const rows = Array.isArray(json) ? json : (json?.data ?? json?.result ?? json?.rates ?? null);
      if (!Array.isArray(rows) || rows.length === 0) { console.warn(`  HPCL ${url} → empty/unexpected shape`); continue; }

      const out = {};
      for (const r of rows) {
        const stateName = r.State ?? r.state ?? r.StateName ?? r.stateName ?? '';
        const petrol    = parseFloat(r.Petrol ?? r.petrol ?? r.PetrolPrice ?? r.petrolprice ?? 0);
        const diesel    = parseFloat(r.Diesel ?? r.diesel ?? r.DieselPrice ?? r.dieselprice ?? 0);
        if (!stateName || !(petrol > 50) || !(diesel > 50)) continue;
        out[normaliseState(stateName)] = { petrol, diesel };
      }
      if (Object.keys(out).length > 5) {
        console.log(`  ✓ HPCL ${url}: ${Object.keys(out).length} states`);
        return out;
      }
    } catch (e) {
      console.warn(`  HPCL ${url} error: ${e.message}`);
    }
  }
  return null;
}

// ── IOC ───────────────────────────────────────────────────────────────────
async function fetchIOC() {
  const endpoints = [
    'https://iocl.com/Products/GetFuelPriceDetails',
    'https://iocl.com/Products/GetFuelPrice',
    'https://iocl.com/BuyCIF',
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://iocl.com/' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) { console.warn(`  IOC ${url} → HTTP ${res.status}`); continue; }

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { continue; }

      const rows = Array.isArray(json) ? json : (json?.data ?? json?.result ?? null);
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const out = {};
      for (const r of rows) {
        const stateName = r.State ?? r.state ?? r.StateName ?? '';
        const petrol    = parseFloat(r.Petrol ?? r.petrol ?? r.PetrolPrice ?? 0);
        const diesel    = parseFloat(r.Diesel ?? r.diesel ?? r.DieselPrice ?? 0);
        if (!stateName || !(petrol > 50)) continue;
        out[normaliseState(stateName)] = { petrol, diesel };
      }
      if (Object.keys(out).length > 5) {
        console.log(`  ✓ IOC ${url}: ${Object.keys(out).length} states`);
        return out;
      }
    } catch (e) {
      console.warn(`  IOC ${url} error: ${e.message}`);
    }
  }
  return null;
}

// ── Hardcoded baseline for every state (post-March 2024 revision) ─────────
// Used to seed the DB on first run and to fill gaps when APIs miss some states.
const BASELINE = {
  andhra_pradesh:                       { petrol: 109.41, diesel: 97.21  },
  arunachal_pradesh:                    { petrol: 97.43,  diesel: 84.12  },
  assam:                                { petrol: 96.01,  diesel: 83.94  },
  bihar:                                { petrol: 107.24, diesel: 94.04  },
  chhattisgarh:                         { petrol: 102.70, diesel: 94.76  },
  goa:                                  { petrol: 96.81,  diesel: 90.08  },
  gujarat:                              { petrol: 96.63,  diesel: 92.38  },
  haryana:                              { petrol: 95.03,  diesel: 87.86  },
  himachal_pradesh:                     { petrol: 97.50,  diesel: 85.60  },
  jharkhand:                            { petrol: 99.09,  diesel: 96.77  },
  karnataka:                            { petrol: 102.86, diesel: 88.94  },
  kerala:                               { petrol: 102.05, diesel: 90.55  },
  madhya_pradesh:                       { petrol: 108.65, diesel: 93.77  },
  maharashtra:                          { petrol: 103.44, diesel: 89.97  },
  manipur:                              { petrol: 99.49,  diesel: 90.71  },
  meghalaya:                            { petrol: 97.53,  diesel: 88.14  },
  mizoram:                              { petrol: 101.18, diesel: 91.47  },
  nagaland:                             { petrol: 99.00,  diesel: 88.60  },
  odisha:                               { petrol: 103.19, diesel: 94.76  },
  punjab:                               { petrol: 96.94,  diesel: 83.67  },
  rajasthan:                            { petrol: 104.88, diesel: 90.36  },
  sikkim:                               { petrol: 102.50, diesel: 89.60  },
  tamil_nadu:                           { petrol: 100.75, diesel: 92.34  },
  telangana:                            { petrol: 107.41, diesel: 95.65  },
  tripura:                              { petrol: 97.13,  diesel: 88.07  },
  uttar_pradesh:                        { petrol: 96.57,  diesel: 89.76  },
  uttarakhand:                          { petrol: 95.42,  diesel: 88.11  },
  west_bengal:                          { petrol: 103.94, diesel: 90.56  },
  // Union Territories
  andaman_and_nicobar_islands:          { petrol: 82.96,  diesel: 79.41  },
  chandigarh:                           { petrol: 94.24,  diesel: 82.40  },
  dadra_and_nagar_haveli_and_daman_and_diu: { petrol: 94.19, diesel: 86.86 },
  delhi:                                { petrol: 94.72,  diesel: 87.62  },
  jammu_and_kashmir:                    { petrol: 97.77,  diesel: 88.70  },
  ladakh:                               { petrol: 100.30, diesel: 88.70  },
  lakshadweep:                          { petrol: 83.40,  diesel: 73.90  },
  puducherry:                           { petrol: 98.30,  diesel: 90.50  },
};

async function main() {
  const now = new Date().toISOString();
  console.log(`=== Fuel price pipeline: ${now} ===\n`);

  // Try live sources
  console.log('Fetching from HPCL...');
  let live = await fetchHPCL();
  if (!live) {
    console.log('Fetching from IOC...');
    live = await fetchIOC();
  }

  // Merge: live takes priority over baseline for states it covers
  const merged = { ...BASELINE };
  if (live) {
    for (const [key, prices] of Object.entries(live)) {
      if (prices.petrol > 50) merged[key] = prices;
    }
    console.log(`\nLive data covers ${Object.keys(live).length} states; baseline covers the rest.`);
  } else {
    console.log('\nAll live sources failed — using baseline prices for all states.');
  }

  // Build upsert rows
  const rows = [];
  for (const [stateKey, { petrol, diesel }] of Object.entries(merged)) {
    rows.push({ key: `petrol_${stateKey}`, price: petrol, change_pct: null, updated_at: now });
    rows.push({ key: `diesel_${stateKey}`, price: diesel, change_pct: null, updated_at: now });
  }

  console.log(`\nUpserting ${rows.length} rows (${rows.length / 2} states × petrol + diesel)...`);

  // Supabase upsert in batches of 100 to avoid payload limits
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('market_data').upsert(batch, { onConflict: 'key' });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
  }

  console.log(`Done. ${rows.length / 2} state fuel prices stored/updated in market_data.`);
  console.log(`Source: ${live ? 'HPCL/IOC (live)' : 'baseline reference'}`);
}

main().catch(err => { console.error(err); process.exit(1); });
