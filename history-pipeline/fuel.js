/**
 * Fuel price pipeline — fetches live petrol & diesel prices for all Indian
 * states and UTs from multiple sources and upserts into Supabase market_data.
 *
 * Sources tried in order (first success wins per state):
 *  1. HPCL  — hindustanpetroleum.com (batch JSON)
 *  2. IOC   — iocl.com (batch or per-state JSON)
 *  3. goodreturns.in — HTML scraping with broad regex
 *  4. mypetrolprice.com — HTML scraping fallback
 *  5. Baseline table — hardcoded post-March 2024 prices (last resort)
 *
 * Run manually: GitHub → Actions → Fuel Prices → Run workflow
 * Check the job logs to see HTTP status for every request.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

// Full browser headers — reduces chance of 403 from sites that check UA
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};
const JSON_HEADERS = { ...HEADERS, Accept: 'application/json, text/plain, */*' };

// All 36 states + UTs
const STATES = [
  { key: 'andhra_pradesh',        gr: 'andhra-pradesh',        mp: 'Andhra%20Pradesh' },
  { key: 'arunachal_pradesh',     gr: 'arunachal-pradesh',     mp: 'Arunachal%20Pradesh' },
  { key: 'assam',                  gr: 'assam',                 mp: 'Assam' },
  { key: 'bihar',                  gr: 'bihar',                 mp: 'Bihar' },
  { key: 'chhattisgarh',           gr: 'chhattisgarh',          mp: 'Chhattisgarh' },
  { key: 'goa',                    gr: 'goa',                   mp: 'Goa' },
  { key: 'gujarat',                gr: 'gujarat',               mp: 'Gujarat' },
  { key: 'haryana',                gr: 'haryana',               mp: 'Haryana' },
  { key: 'himachal_pradesh',       gr: 'himachal-pradesh',      mp: 'Himachal%20Pradesh' },
  { key: 'jharkhand',              gr: 'jharkhand',             mp: 'Jharkhand' },
  { key: 'karnataka',              gr: 'karnataka',             mp: 'Karnataka' },
  { key: 'kerala',                 gr: 'kerala',                mp: 'Kerala' },
  { key: 'madhya_pradesh',         gr: 'madhya-pradesh',        mp: 'Madhya%20Pradesh' },
  { key: 'maharashtra',            gr: 'maharashtra',           mp: 'Maharashtra' },
  { key: 'manipur',                gr: 'manipur',               mp: 'Manipur' },
  { key: 'meghalaya',              gr: 'meghalaya',             mp: 'Meghalaya' },
  { key: 'mizoram',                gr: 'mizoram',               mp: 'Mizoram' },
  { key: 'nagaland',               gr: 'nagaland',              mp: 'Nagaland' },
  { key: 'odisha',                 gr: 'odisha',                mp: 'Odisha' },
  { key: 'punjab',                 gr: 'punjab',                mp: 'Punjab' },
  { key: 'rajasthan',              gr: 'rajasthan',             mp: 'Rajasthan' },
  { key: 'sikkim',                 gr: 'sikkim',                mp: 'Sikkim' },
  { key: 'tamil_nadu',             gr: 'tamil-nadu',            mp: 'Tamil%20Nadu' },
  { key: 'telangana',              gr: 'telangana',             mp: 'Telangana' },
  { key: 'tripura',                gr: 'tripura',               mp: 'Tripura' },
  { key: 'uttar_pradesh',          gr: 'uttar-pradesh',         mp: 'Uttar%20Pradesh' },
  { key: 'uttarakhand',            gr: 'uttarakhand',           mp: 'Uttarakhand' },
  { key: 'west_bengal',            gr: 'west-bengal',           mp: 'West%20Bengal' },
  { key: 'andaman_and_nicobar_islands', gr: 'andaman-nicobar', mp: 'Andaman%20Nicobar' },
  { key: 'chandigarh',             gr: 'chandigarh',            mp: 'Chandigarh' },
  { key: 'dadra_and_nagar_haveli_and_daman_and_diu', gr: 'dadra-nagar-haveli', mp: 'Dadra' },
  { key: 'delhi',                  gr: 'delhi',                 mp: 'Delhi' },
  { key: 'jammu_and_kashmir',      gr: 'jammu-kashmir',         mp: 'Jammu%20Kashmir' },
  { key: 'ladakh',                 gr: 'ladakh',                mp: 'Ladakh' },
  { key: 'lakshadweep',            gr: 'lakshadweep',           mp: 'Lakshadweep' },
  { key: 'puducherry',             gr: 'puducherry',            mp: 'Puducherry' },
];

// Baseline (post-March 2024 central ₹2 cut). Used ONLY if all live sources fail.
const BASELINE = {
  andhra_pradesh:{p:109.41,d:97.21}, arunachal_pradesh:{p:97.43,d:84.12},
  assam:{p:96.01,d:83.94}, bihar:{p:107.24,d:94.04},
  chhattisgarh:{p:102.70,d:94.76}, goa:{p:96.81,d:90.08},
  gujarat:{p:96.63,d:92.38}, haryana:{p:95.03,d:87.86},
  himachal_pradesh:{p:97.50,d:85.60}, jharkhand:{p:99.09,d:96.77},
  karnataka:{p:102.86,d:88.94}, kerala:{p:102.05,d:90.55},
  madhya_pradesh:{p:108.65,d:93.77}, maharashtra:{p:103.44,d:89.97},
  manipur:{p:99.49,d:90.71}, meghalaya:{p:97.53,d:88.14},
  mizoram:{p:101.18,d:91.47}, nagaland:{p:99.00,d:88.60},
  odisha:{p:103.19,d:94.76}, punjab:{p:96.94,d:83.67},
  rajasthan:{p:104.88,d:90.36}, sikkim:{p:102.50,d:89.60},
  tamil_nadu:{p:100.75,d:92.34}, telangana:{p:107.41,d:95.65},
  tripura:{p:97.13,d:88.07}, uttar_pradesh:{p:96.57,d:89.76},
  uttarakhand:{p:95.42,d:88.11}, west_bengal:{p:103.94,d:90.56},
  andaman_and_nicobar_islands:{p:82.96,d:79.41}, chandigarh:{p:94.24,d:82.40},
  dadra_and_nagar_haveli_and_daman_and_diu:{p:94.19,d:86.86},
  delhi:{p:94.72,d:87.62}, jammu_and_kashmir:{p:97.77,d:88.70},
  ladakh:{p:100.30,d:88.70}, lakshadweep:{p:83.40,d:73.90},
  puducherry:{p:98.30,d:90.50},
};

async function safeGet(url, hdrs = HEADERS, ms = 12000) {
  try {
    const r = await fetch(url, { headers: hdrs, signal: AbortSignal.timeout(ms) });
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' };
  } catch (e) {
    return { ok: false, status: 0, text: '', err: e.message };
  }
}

// Extract fuel price from HTML — handles ₹, Rs., Rs and various encodings
function extractPrice(html, minVal = 70, maxVal = 160) {
  // Patterns for Indian rupee price
  const patterns = [
    /(?:₹|Rs\.?\s*|&#8377;|&#x20B9;)\s*(\d{2,3}\.\d{2})/g,
    /(\d{2,3}\.\d{2})\s*(?:\/\s*(?:litre|ltr|L))/gi,
    /price[^\d]{0,50}(\d{2,3}\.\d{2})/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    const matches = [...html.matchAll(re)].map(m => parseFloat(m[1])).filter(v => v >= minVal && v <= maxVal);
    if (matches.length) return matches[0];
  }
  return null;
}

// ── Source 1: HPCL batch ─────────────────────────────────────────────────
async function fetchHPCL() {
  const urls = [
    'https://www.hindustanpetroleum.com/FetchFuelPrices',
    'https://www.hindustanpetroleum.com/FetchFuelPricesNew',
    'https://www.hindustanpetroleum.com/assets/json/fuelpricesData.json',
    'https://www.hindustanpetroleum.com/api/fuelprices',
    'https://hpcl.co.in/FetchFuelPrices',
  ];
  for (const url of urls) {
    const { ok, status, text } = await safeGet(url, { ...JSON_HEADERS, Referer: 'https://www.hindustanpetroleum.com/' });
    console.log(`  HPCL ${url.split('/').slice(-1)[0]} → ${status}`);
    if (!ok || !text) continue;
    try {
      const json = JSON.parse(text);
      const rows = Array.isArray(json) ? json : (json?.data ?? json?.result ?? json?.rates ?? null);
      if (!Array.isArray(rows) || rows.length < 5) continue;
      const out = {};
      for (const r of rows) {
        const sName = r.State ?? r.state ?? r.StateName ?? '';
        const p = parseFloat(r.Petrol ?? r.petrol ?? r.PetrolPrice ?? 0);
        const d = parseFloat(r.Diesel ?? r.diesel ?? r.DieselPrice ?? 0);
        if (!sName || !(p > 50)) continue;
        const k = sName.toLowerCase().replace(/&/g,'and').replace(/\s+/g,'_').replace(/[^a-z_]/g,'');
        out[k] = { p, d };
      }
      if (Object.keys(out).length > 10) { console.log(`  ✓ HPCL: ${Object.keys(out).length} states`); return out; }
    } catch {}
  }
  return null;
}

// ── Source 2: IOC ─────────────────────────────────────────────────────────
async function fetchIOC() {
  const urls = [
    'https://iocl.com/Products/GetFuelPriceDetails',
    'https://iocl.com/Products/GetFuelPrice',
    'https://iocl.com/api/fuel-prices',
    'https://indianoil.in/servlet/ContentServer?ssSourceNodeId=3736',
  ];
  for (const url of urls) {
    const { ok, status, text } = await safeGet(url, { ...JSON_HEADERS, Referer: 'https://iocl.com/' });
    console.log(`  IOC ${url.split('/').slice(-1)[0]} → ${status}`);
    if (!ok || !text) continue;
    try {
      const json = JSON.parse(text);
      const rows = Array.isArray(json) ? json : (json?.data ?? json?.result ?? null);
      if (!Array.isArray(rows) || rows.length < 5) continue;
      const out = {};
      for (const r of rows) {
        const sName = r.State ?? r.state ?? '';
        const p = parseFloat(r.Petrol ?? r.petrol ?? 0);
        const d = parseFloat(r.Diesel ?? r.diesel ?? 0);
        if (!sName || !(p > 50)) continue;
        const k = sName.toLowerCase().replace(/\s+/g,'_');
        out[k] = { p, d };
      }
      if (Object.keys(out).length > 10) { console.log(`  ✓ IOC: ${Object.keys(out).length} states`); return out; }
    } catch {}
  }
  return null;
}

// ── Source 3: goodreturns.in per-state scraping ───────────────────────────
async function scrapeGR(state) {
  const base = 'https://www.goodreturns.in';
  const results = {};
  for (const fuel of ['petrol', 'diesel']) {
    const url = `${base}/${fuel}-price-in-${state.gr}.html`;
    const { ok, status, text } = await safeGet(url, { ...HEADERS, Referer: base + '/' });
    if (!ok) { console.log(`    GR ${state.key} ${fuel} → ${status}`); continue; }
    const price = extractPrice(text);
    if (price) results[fuel] = price;
  }
  return results.petrol && results.diesel ? { p: results.petrol, d: results.diesel } : null;
}

// ── Source 4: mypetrolprice.com per-state scraping ────────────────────────
async function scrapeMP(state) {
  const results = {};
  for (const fuel of ['petrol', 'diesel']) {
    const url = `https://www.mypetrolprice.com/${fuel}-price-in-${state.mp}-state.aspx`;
    const { ok, status, text } = await safeGet(url, HEADERS);
    if (!ok) continue;
    const price = extractPrice(text);
    if (price) results[fuel] = price;
  }
  return results.petrol && results.diesel ? { p: results.petrol, d: results.diesel } : null;
}

async function main() {
  const now = new Date().toISOString();
  console.log(`=== Fuel price pipeline: ${now} ===\n`);

  // Try batch sources first (one request for all states)
  console.log('── Source 1: HPCL batch ──');
  let batchData = await fetchHPCL();

  if (!batchData) {
    console.log('\n── Source 2: IOC batch ──');
    batchData = await fetchIOC();
  }

  // Per-state scraping for any states still missing
  const missing = STATES.filter(s => !batchData?.[s.key]);

  if (missing.length > 0) {
    console.log(`\n── Source 3+4: per-state scraping (${missing.length} states) ──`);
    const BATCH = 5;
    for (let i = 0; i < missing.length; i += BATCH) {
      const chunk = missing.slice(i, i + BATCH);
      await Promise.all(chunk.map(async state => {
        // Try goodreturns.in first, then mypetrolprice.com
        const result = (await scrapeGR(state)) ?? (await scrapeMP(state));
        if (result) {
          if (!batchData) batchData = {};
          batchData[state.key] = result;
          console.log(`    ✓ ${state.key}: ₹${result.p} / ₹${result.d}`);
        } else {
          console.log(`    ✗ ${state.key}: all sources failed → will use baseline`);
        }
      }));
      if (i + BATCH < missing.length) await new Promise(r => setTimeout(r, 600));
    }
  }

  // Merge live over baseline
  const merged = { ...BASELINE };
  let liveCount = 0;
  if (batchData) {
    for (const [key, prices] of Object.entries(batchData)) {
      if (prices.p > 50 && prices.d > 50) { merged[key] = prices; liveCount++; }
    }
  }

  console.log(`\n── Summary ──`);
  console.log(`Live prices: ${liveCount}/${STATES.length} states`);
  console.log(`Baseline:    ${STATES.length - liveCount} states`);

  // Upsert all rows
  const rows = [];
  for (const [stateKey, prices] of Object.entries(merged)) {
    rows.push({ key: `petrol_${stateKey}`, price: prices.p, change_pct: null, updated_at: now });
    rows.push({ key: `diesel_${stateKey}`, price: prices.d ?? null, change_pct: null, updated_at: now });
  }

  console.log(`\nUpserting ${rows.length} rows into Supabase...`);
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('market_data').upsert(rows.slice(i, i + 100), { onConflict: 'key' });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }
  console.log(`Done. ${rows.length} rows upserted (${liveCount} live + ${STATES.length - liveCount} baseline).`);
}

main().catch(err => { console.error(err); process.exit(1); });
