/**
 * Fuel price pipeline — live petrol, diesel & CNG for all Indian states.
 *
 * Sources tried in priority order:
 *  1. RapidAPI mi8y   — "Daily Petrol Diesel LPG CNG Fuel Prices India"
 *                        (FREE plan available, includes CNG)
 *  2. RapidAPI nixinfo — "Fuel Price API India — Free"
 *                        (Completely free, petrol + diesel)
 *  3. RapidAPI cuvora  — "Daily Fuel Prices Update India"
 *  4. RapidAPI navii   — "Daily Fuel Price India"
 *  5. Scraping petroldieselprice.com (no key, fallback)
 *  6. Hardcoded baseline (last resort — accurate as of June 2025)
 *
 * Setup (one-time):
 *  1. Sign up free at rapidapi.com
 *  2. Subscribe to any free Indian fuel price API
 *  3. Add GitHub secret: RAPIDAPI_KEY = your_key
 *  4. Run this pipeline manually once to populate Supabase
 *
 * Supabase keys: petrol_{state} | diesel_{state} | cng_{state}
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

const HEADERS_WEB = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
};

// ── State name → Supabase key ─────────────────────────────────────────────
const STATE_MAP = {
  'Andhra Pradesh': 'andhra_pradesh', 'Arunachal Pradesh': 'arunachal_pradesh',
  'Assam': 'assam', 'Bihar': 'bihar', 'Chhattisgarh': 'chhattisgarh',
  'Goa': 'goa', 'Gujarat': 'gujarat', 'Haryana': 'haryana',
  'Himachal Pradesh': 'himachal_pradesh', 'Jharkhand': 'jharkhand',
  'Karnataka': 'karnataka', 'Kerala': 'kerala',
  'Madhya Pradesh': 'madhya_pradesh', 'Maharashtra': 'maharashtra',
  'Manipur': 'manipur', 'Meghalaya': 'meghalaya', 'Mizoram': 'mizoram',
  'Nagaland': 'nagaland', 'Odisha': 'odisha', 'Punjab': 'punjab',
  'Rajasthan': 'rajasthan', 'Sikkim': 'sikkim', 'Tamil Nadu': 'tamil_nadu',
  'Telangana': 'telangana', 'Tripura': 'tripura', 'Uttar Pradesh': 'uttar_pradesh',
  'Uttarakhand': 'uttarakhand', 'West Bengal': 'west_bengal',
  'Delhi': 'delhi', 'Chandigarh': 'chandigarh', 'Puducherry': 'puducherry',
  'Pondicherry': 'puducherry', 'Jammu and Kashmir': 'jammu_and_kashmir',
  'Jammu & Kashmir': 'jammu_and_kashmir', 'Ladakh': 'ladakh',
  'Lakshadweep': 'lakshadweep',
  'Andaman and Nicobar Islands': 'andaman_and_nicobar_islands',
  'Andaman & Nicobar Islands': 'andaman_and_nicobar_islands',
  'Dadra and Nagar Haveli and Daman and Diu': 'dadra_and_nagar_haveli_and_daman_and_diu',
};

function toKey(name = '') {
  return STATE_MAP[name]
    ?? STATE_MAP[name.trim()]
    ?? name.toLowerCase().replace(/&/g,'and').replace(/\s+/g,'_').replace(/[^a-z_]/g,'');
}

async function safeGet(url, headers = {}, ms = 12000) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(ms) });
    const text = r.ok ? await r.text() : '';
    return { ok: r.ok, status: r.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: '', err: e.message };
  }
}

// Parse various JSON response shapes from RapidAPI providers
function parseRapidJSON(json) {
  const result = {};

  // Shape 1: array of { state, city, petrol, diesel, cng, lpg }
  const rows = Array.isArray(json) ? json
    : json?.data ?? json?.result ?? json?.response
    ?? json?.prices ?? json?.fuel_prices ?? null;

  if (Array.isArray(rows)) {
    for (const r of rows) {
      const name = r.state ?? r.State ?? r.stateName ?? r.location ?? r.city ?? '';
      if (!name) continue;
      const p = parseFloat(r.petrol ?? r.Petrol ?? r.petrolPrice ?? r.petrol_price ?? 0);
      const d = parseFloat(r.diesel ?? r.Diesel ?? r.dieselPrice ?? r.diesel_price ?? 0);
      const cng = r.cng ?? r.CNG ?? r.cngPrice ?? r.cng_price ?? null;
      if (!(p > 50)) continue;
      const key = toKey(name);
      if (!result[key] || (cng && !result[key].cng)) {
        result[key] = { p, d: d || null, cng: cng ? parseFloat(cng) : null };
      }
    }
    return Object.keys(result).length > 3 ? result : null;
  }

  // Shape 2: flat object { "Maharashtra": { petrol: 111.18, diesel: 97.83 } }
  for (const [name, val] of Object.entries(json ?? {})) {
    if (typeof val !== 'object' || !val) continue;
    const p = parseFloat(val.petrol ?? val.Petrol ?? 0);
    const d = parseFloat(val.diesel ?? val.Diesel ?? 0);
    const cng = val.cng ?? val.CNG ?? null;
    if (!(p > 50)) continue;
    result[toKey(name)] = { p, d: d || null, cng: cng ? parseFloat(cng) : null };
  }
  return Object.keys(result).length > 3 ? result : null;
}

// ── Source 1: RapidAPI ────────────────────────────────────────────────────
const RAPID_APIS = [
  {
    name: 'mi8y (petrol+diesel+CNG+LPG)',
    host: 'daily-petrol-diesel-lpg-cng-fuel-prices-in-india.p.rapidapi.com',
    urls: [
      'https://daily-petrol-diesel-lpg-cng-fuel-prices-in-india.p.rapidapi.com/v1/fuel/price/today/india',
      'https://daily-petrol-diesel-lpg-cng-fuel-prices-in-india.p.rapidapi.com/v1/fuel/price/today',
      'https://daily-petrol-diesel-lpg-cng-fuel-prices-in-india.p.rapidapi.com/v1/price',
    ],
  },
  {
    name: 'nixinfo (free, petrol+diesel)',
    host: 'fuel-price-api-india-diesel-petrol-price-api-free.p.rapidapi.com',
    urls: [
      'https://fuel-price-api-india-diesel-petrol-price-api-free.p.rapidapi.com/price',
      'https://fuel-price-api-india-diesel-petrol-price-api-free.p.rapidapi.com/',
      'https://fuel-price-api-india-diesel-petrol-price-api-free.p.rapidapi.com/all',
    ],
  },
  {
    name: 'cuvora (petrol+diesel)',
    host: 'daily-fuel-prices-update-india.p.rapidapi.com',
    urls: [
      'https://daily-fuel-prices-update-india.p.rapidapi.com/price',
      'https://daily-fuel-prices-update-india.p.rapidapi.com/',
    ],
  },
  {
    name: 'navii (petrol+diesel)',
    host: 'daily-fuel-price-india.p.rapidapi.com',
    urls: [
      'https://daily-fuel-price-india.p.rapidapi.com/price',
      'https://daily-fuel-price-india.p.rapidapi.com/',
    ],
  },
  {
    name: 'tango-api (petrol+diesel)',
    host: 'daily-fuel-price-india1.p.rapidapi.com',
    urls: [
      'https://daily-fuel-price-india1.p.rapidapi.com/price',
      'https://daily-fuel-price-india1.p.rapidapi.com/',
    ],
  },
];

async function fetchRapidAPI() {
  if (!RAPIDAPI_KEY) {
    console.log('  RAPIDAPI_KEY not set — skipping RapidAPI sources');
    return null;
  }

  for (const api of RAPID_APIS) {
    for (const url of api.urls) {
      const { ok, status, text } = await safeGet(url, {
        'X-RapidAPI-Key':  RAPIDAPI_KEY,
        'X-RapidAPI-Host': api.host,
        Accept: 'application/json',
        'User-Agent': 'NewsSphere-FuelPipeline/1.0',
      });
      console.log(`  ${api.name} → ${status} (${url.split('/').slice(-2).join('/')})`);
      if (!ok || !text) continue;
      try {
        const json = JSON.parse(text);
        const data = parseRapidJSON(json);
        if (data && Object.keys(data).length >= 10) {
          const cngCount = Object.values(data).filter(v => v.cng).length;
          console.log(`  ✓ ${api.name}: ${Object.keys(data).length} states, ${cngCount} with CNG`);
          return data;
        }
        console.log(`    parsed but only ${Object.keys(parseRapidJSON(json) ?? {}).length} states — skipping`);
      } catch (e) {
        console.log(`    JSON parse error: ${e.message}`);
      }
    }
  }
  return null;
}

// ── Source 2: petroldieselprice.com scraping ──────────────────────────────
function extractPrice(html, min = 60, max = 165) {
  if (!html) return null;
  const patterns = [
    /(?:₹|Rs\.?\s*|&#8377;)\s*(\d{2,3}\.\d{2})/g,
    /(\d{2,3}\.\d{2})\s*(?:\/\s*(?:litre|ltr|kg|L))/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    const m = [...html.matchAll(re)].map(x => parseFloat(x[1])).filter(v => v >= min && v <= max);
    if (m.length) return m[0];
  }
  return null;
}

const SLUGS = {
  andhra_pradesh:'andhra-pradesh', arunachal_pradesh:'arunachal-pradesh',
  assam:'assam', bihar:'bihar', chhattisgarh:'chhattisgarh', goa:'goa',
  gujarat:'gujarat', haryana:'haryana', himachal_pradesh:'himachal-pradesh',
  jharkhand:'jharkhand', karnataka:'karnataka', kerala:'kerala',
  madhya_pradesh:'madhya-pradesh', maharashtra:'maharashtra',
  manipur:'manipur', meghalaya:'meghalaya', mizoram:'mizoram',
  nagaland:'nagaland', odisha:'odisha', punjab:'punjab',
  rajasthan:'rajasthan', sikkim:'sikkim', tamil_nadu:'tamil-nadu',
  telangana:'telangana', tripura:'tripura', uttar_pradesh:'uttar-pradesh',
  uttarakhand:'uttarakhand', west_bengal:'west-bengal',
  delhi:'delhi', chandigarh:'chandigarh', puducherry:'puducherry',
  jammu_and_kashmir:'jammu-kashmir', ladakh:'ladakh',
  andaman_and_nicobar_islands:'andaman-nicobar',
  dadra_and_nagar_haveli_and_daman_and_diu:'dadra-nagar-haveli',
  lakshadweep:'lakshadweep',
};

async function scrapePDP(slug, fuel) {
  const base = 'https://www.petroldieselprice.com';
  const urls = [
    `${base}/${fuel}-price-in-${slug}/`,
    `${base}/${fuel}-price-${slug}/`,
    `${base}/${slug}-${fuel}-price/`,
  ];
  for (const url of urls) {
    const { ok, text } = await safeGet(url, HEADERS_WEB);
    if (ok && text) {
      const p = extractPrice(text);
      if (p) return p;
    }
  }
  return null;
}

async function fetchScraping() {
  const result = {};
  const keys = Object.keys(SLUGS);
  const BATCH = 4;
  for (let i = 0; i < keys.length; i += BATCH) {
    await Promise.all(keys.slice(i, i + BATCH).map(async key => {
      const slug = SLUGS[key];
      const [p, d] = await Promise.all([scrapePDP(slug, 'petrol'), scrapePDP(slug, 'diesel')]);
      if (p && d) {
        result[key] = { p, d, cng: null };
        console.log(`  ✓ ${key}: ₹${p} / ₹${d}`);
      }
    }));
    if (i + BATCH < keys.length) await new Promise(r => setTimeout(r, 400));
  }
  return Object.keys(result).length >= 10 ? result : null;
}

// ── Baseline (updated June 2025 — Maharashtra confirmed by user) ───────────
const BASELINE = {
  andhra_pradesh:{p:109.41,d:97.21}, arunachal_pradesh:{p:97.43,d:84.12},
  assam:{p:96.01,d:83.94}, bihar:{p:107.24,d:94.04},
  chhattisgarh:{p:102.70,d:94.76}, goa:{p:96.81,d:90.08},
  gujarat:{p:96.63,d:92.38}, haryana:{p:95.03,d:87.86},
  himachal_pradesh:{p:97.50,d:85.60}, jharkhand:{p:99.09,d:96.77},
  karnataka:{p:102.86,d:88.94}, kerala:{p:102.05,d:90.55},
  madhya_pradesh:{p:108.65,d:93.77},
  maharashtra:{p:111.18,d:97.83},   // ← confirmed by user (June 2025)
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

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const now = new Date().toISOString();
  console.log(`=== Fuel price pipeline: ${now} ===`);
  console.log(`RapidAPI key: ${RAPIDAPI_KEY ? `set (${RAPIDAPI_KEY.slice(0,8)}...)` : 'NOT SET — add RAPIDAPI_KEY secret'}\n`);

  // Try sources in order
  console.log('── Source 1: RapidAPI ──');
  let live = await fetchRapidAPI();

  if (!live) {
    console.log('\n── Source 2: petroldieselprice.com scraping ──');
    live = await fetchScraping();
  }

  // Merge live data over baseline
  const merged = { ...BASELINE };
  let liveCount = 0;
  if (live) {
    for (const [key, prices] of Object.entries(live)) {
      if (prices.p > 50) { merged[key] = prices; liveCount++; }
    }
  }

  console.log(`\n── Building rows ──`);
  const rows = [];
  for (const [key, prices] of Object.entries(merged)) {
    rows.push({ key: `petrol_${key}`, price: prices.p,     change_pct: null, updated_at: now });
    rows.push({ key: `diesel_${key}`, price: prices.d,     change_pct: null, updated_at: now });
    if (prices.cng) {
      rows.push({ key: `cng_${key}`, price: prices.cng, change_pct: null, updated_at: now });
    }
  }

  console.log(`Live: ${liveCount} states | Baseline: ${Object.keys(BASELINE).length - liveCount} states`);
  console.log(`Total rows: ${rows.length}`);

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('market_data').upsert(rows.slice(i, i + 100), { onConflict: 'key' });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  console.log('\n── Verification ──');
  const mh = rows.find(r => r.key === 'petrol_maharashtra');
  const dl = rows.find(r => r.key === 'petrol_delhi');
  const mhCng = rows.find(r => r.key === 'cng_maharashtra');
  console.log(`Maharashtra petrol = ₹${mh?.price} (expected ₹111.18)`);
  console.log(`Delhi petrol       = ₹${dl?.price}`);
  console.log(`Maharashtra CNG    = ${mhCng ? `₹${mhCng.price}/kg` : 'N/A'}`);
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
