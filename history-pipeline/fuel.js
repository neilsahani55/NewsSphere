/**
 * Fuel price pipeline — fetches live petrol & diesel for all Indian states
 * from goodreturns.in using the CORRECT URL format:
 *   {fuel}-price-in-{state-slug}-s{stateID}.html
 *
 * Strategy:
 *  1. Fetch goodreturns.in fuel index → auto-discover every state's ID
 *  2. Fetch each state's petrol + diesel page using discovered IDs
 *  3. Fall back to HPCL/IOC JSON if discovery fails
 *  4. Baseline (post-Mar 2024) for any state still missing
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

const GR = 'https://www.goodreturns.in';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

const JSON_HEADERS = { ...HEADERS, Accept: 'application/json, text/plain, */*' };

// Map goodreturns.in slug → our Supabase state key
// (most slugs just need hyphens → underscores, but a few are irregular)
function grSlugToKey(slug) {
  const MAP = {
    'jammu-kashmir':               'jammu_and_kashmir',
    'jammu-and-kashmir':           'jammu_and_kashmir',
    'andaman-nicobar':             'andaman_and_nicobar_islands',
    'andaman-nicobar-islands':     'andaman_and_nicobar_islands',
    'andaman-and-nicobar-islands': 'andaman_and_nicobar_islands',
    'dadra-nagar-haveli':          'dadra_and_nagar_haveli_and_daman_and_diu',
    'dadra-nagar-haveli-and-daman-and-diu': 'dadra_and_nagar_haveli_and_daman_and_diu',
    'pondicherry':                 'puducherry',
    'nct-of-delhi':                'delhi',
    'new-delhi':                   'delhi',
  };
  return MAP[slug] ?? slug.replace(/-/g, '_');
}

// Baseline — used ONLY when goodreturns.in and HPCL/IOC both fail
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

async function safeGet(url, headers = HEADERS, ms = 12000) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(ms) });
    const text = r.ok ? await r.text() : '';
    return { ok: r.ok, status: r.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: '', err: e.message };
  }
}

function extractPrice(html, minVal = 70, maxVal = 160) {
  if (!html) return null;
  // Try multiple patterns — goodreturns.in uses ₹ symbol before the price
  const patterns = [
    /(?:₹|Rs\.?\s*|&#8377;|&#x20B9;)\s*(\d{2,3}\.\d{2})/g,
    /(\d{2,3}\.\d{2})\s*\/?\s*(?:litre|ltr|per litre)/gi,
    /price[^₹\d]{0,60}(\d{2,3}\.\d{2})/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    const matches = [...html.matchAll(re)].map(m => parseFloat(m[1])).filter(v => v >= minVal && v <= maxVal);
    if (matches.length) return matches[0];
  }
  return null;
}

// ── Step 1: Discover state IDs from goodreturns.in index pages ────────────
async function discoverStateIDs() {
  // Try several pages that should list all state links
  const indexPages = [
    `${GR}/fuel-price.html`,
    `${GR}/petrol-price.html`,
    `${GR}/petrol-price-in-india.html`,
    `${GR}/petrol-price-today.html`,
    `${GR}/petrol-price-in-india-today.html`,
  ];

  for (const url of indexPages) {
    const { ok, status, text } = await safeGet(url, HEADERS);
    console.log(`  Index ${url.split('/').slice(-1)[0]} → ${status} (${text.length} bytes)`);
    if (!ok || !text) continue;

    // Extract pattern: petrol-price-in-SLUG-sN.html or diesel-price-in-SLUG-sN.html
    const slugToID = {};
    for (const [, slug, id] of text.matchAll(/(?:petrol|diesel)-price-in-([a-z-]+)-s(\d+)\.html/gi)) {
      if (!slugToID[slug]) slugToID[slug] = id;
    }

    const found = Object.keys(slugToID).length;
    console.log(`  → Found ${found} state IDs`);
    if (found >= 15) {
      // Log every discovered state for transparency
      for (const [slug, id] of Object.entries(slugToID)) {
        console.log(`     ${slug} = s${id}`);
      }
      return slugToID;
    }
  }

  // Fallback: use the confirmed Maharashtra ID and guess the rest
  console.log('  Auto-discovery failed — using known IDs + guessing range s1-s40');
  return null;
}

// ── Step 2: Scrape prices using discovered IDs ─────────────────────────────
async function fetchGRPrice(fuel, slug, stateID) {
  const url = `${GR}/${fuel}-price-in-${slug}-s${stateID}.html`;
  const { ok, status, text } = await safeGet(url);
  if (!ok) {
    console.log(`    ${slug} ${fuel} → HTTP ${status}`);
    return null;
  }
  const price = extractPrice(text);
  return price;
}

async function scrapeGoodReturns(slugToID) {
  const results = {};
  const entries = Object.entries(slugToID);
  const BATCH = 5;

  for (let i = 0; i < entries.length; i += BATCH) {
    await Promise.all(entries.slice(i, i + BATCH).map(async ([slug, id]) => {
      const key = grSlugToKey(slug);
      const [p, d] = await Promise.all([
        fetchGRPrice('petrol', slug, id),
        fetchGRPrice('diesel', slug, id),
      ]);
      if (p && d) {
        results[key] = { p, d };
        console.log(`  ✓ ${key}: petrol=₹${p}  diesel=₹${d}`);
      } else {
        console.log(`  ✗ ${key} (s${id}): petrol=${p ?? 'null'} diesel=${d ?? 'null'}`);
      }
    }));
    if (i + BATCH < entries.length) await new Promise(r => setTimeout(r, 600));
  }
  return results;
}

// ── HPCL/IOC batch (backup if goodreturns.in fails) ───────────────────────
async function tryBatchSource() {
  const hpclURLs = [
    'https://www.hindustanpetroleum.com/FetchFuelPrices',
    'https://www.hindustanpetroleum.com/FetchFuelPricesNew',
    'https://www.hindustanpetroleum.com/assets/json/fuelpricesData.json',
  ];
  const iocURLs = [
    'https://iocl.com/Products/GetFuelPriceDetails',
    'https://iocl.com/Products/GetFuelPrice',
  ];

  for (const url of [...hpclURLs, ...iocURLs]) {
    const referer = url.includes('hpcl') || url.includes('hindustan') ? 'https://www.hindustanpetroleum.com/' : 'https://iocl.com/';
    const { ok, status, text } = await safeGet(url, { ...JSON_HEADERS, Referer: referer });
    console.log(`  Batch ${new URL(url).hostname} ${url.split('/').slice(-1)[0]} → ${status}`);
    if (!ok || !text) continue;
    try {
      const json = JSON.parse(text);
      const rows = Array.isArray(json) ? json : (json?.data ?? json?.result ?? null);
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
      if (Object.keys(out).length > 10) {
        console.log(`  ✓ Batch: ${Object.keys(out).length} states`);
        return out;
      }
    } catch {}
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const now = new Date().toISOString();
  console.log(`=== Fuel price pipeline: ${now} ===\n`);

  let live = null;

  // Primary: goodreturns.in with correct URL format (discovered IDs)
  console.log('── Discovering state IDs from goodreturns.in ──');
  const slugToID = await discoverStateIDs();

  if (slugToID && Object.keys(slugToID).length >= 15) {
    console.log(`\n── Scraping ${Object.keys(slugToID).length} states from goodreturns.in ──`);
    live = await scrapeGoodReturns(slugToID);
    console.log(`\ngoodreturns.in: ${Object.keys(live).length} states successful`);
  }

  // Secondary: HPCL/IOC batch (if goodreturns.in discovery failed)
  if (!live || Object.keys(live).length < 10) {
    console.log('\n── Trying HPCL/IOC batch APIs ──');
    const batch = await tryBatchSource();
    if (batch) live = { ...(live ?? {}), ...batch };
  }

  // Merge live over baseline
  const merged = { ...BASELINE };
  let liveCount = 0;
  if (live) {
    for (const [key, prices] of Object.entries(live)) {
      if (prices.p > 50 && prices.d > 50) { merged[key] = prices; liveCount++; }
    }
  }

  console.log(`\n── Summary ──`);
  console.log(`Live data:  ${liveCount} states`);
  console.log(`Baseline:   ${Object.keys(BASELINE).length - liveCount} states`);

  // Upsert all
  const rows = [];
  for (const [stateKey, prices] of Object.entries(merged)) {
    rows.push({ key: `petrol_${stateKey}`, price: prices.p, change_pct: null, updated_at: now });
    rows.push({ key: `diesel_${stateKey}`, price: prices.d ?? null, change_pct: null, updated_at: now });
  }

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('market_data').upsert(rows.slice(i, i + 100), { onConflict: 'key' });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  console.log(`\nDone. ${rows.length} rows upserted into market_data.`);
  console.log(`Maharashtra: petrol=₹${merged.maharashtra?.p} diesel=₹${merged.maharashtra?.d}`);
}

main().catch(err => { console.error(err); process.exit(1); });
