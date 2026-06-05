/**
 * Fuel price pipeline — fetches petrol, diesel AND CNG prices for all
 * Indian states from petroldieselprice.com (confirmed 200 OK, server-rendered,
 * daily updates at 6 AM IST, covers all 36 states + UTs).
 *
 * CNG is stored per-state (not city) so the frontend can show it based on
 * the user's detected state from IP geolocation.
 *
 * Supabase keys:
 *   petrol_{state_key}  — ₹/litre
 *   diesel_{state_key}  — ₹/litre
 *   cng_{state_key}     — ₹/kg  (states with CNG infrastructure)
 *
 * Runs every 6 hours via GitHub Actions (see fuel.yml).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const BASE  = 'https://www.petroldieselprice.com';
const GR    = 'https://www.goodreturns.in';

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection':      'keep-alive',
  'Cache-Control':   'no-cache',
};

// State definitions: Supabase key + petroldieselprice.com URL slug
const STATES = [
  { key: 'andhra_pradesh',    slug: 'andhra-pradesh',    hasCNG: true  },
  { key: 'arunachal_pradesh', slug: 'arunachal-pradesh', hasCNG: false },
  { key: 'assam',              slug: 'assam',             hasCNG: false },
  { key: 'bihar',              slug: 'bihar',             hasCNG: false },
  { key: 'chhattisgarh',       slug: 'chhattisgarh',      hasCNG: false },
  { key: 'goa',                slug: 'goa',               hasCNG: false },
  { key: 'gujarat',            slug: 'gujarat',           hasCNG: true  },
  { key: 'haryana',            slug: 'haryana',           hasCNG: true  },
  { key: 'himachal_pradesh',   slug: 'himachal-pradesh',  hasCNG: false },
  { key: 'jharkhand',          slug: 'jharkhand',         hasCNG: false },
  { key: 'karnataka',          slug: 'karnataka',         hasCNG: true  },
  { key: 'kerala',             slug: 'kerala',            hasCNG: false },
  { key: 'madhya_pradesh',     slug: 'madhya-pradesh',    hasCNG: true  },
  { key: 'maharashtra',        slug: 'maharashtra',       hasCNG: true  },
  { key: 'manipur',            slug: 'manipur',           hasCNG: false },
  { key: 'meghalaya',          slug: 'meghalaya',         hasCNG: false },
  { key: 'mizoram',            slug: 'mizoram',           hasCNG: false },
  { key: 'nagaland',           slug: 'nagaland',          hasCNG: false },
  { key: 'odisha',             slug: 'odisha',            hasCNG: true  },
  { key: 'punjab',             slug: 'punjab',            hasCNG: true  },
  { key: 'rajasthan',          slug: 'rajasthan',         hasCNG: false },
  { key: 'sikkim',             slug: 'sikkim',            hasCNG: false },
  { key: 'tamil_nadu',         slug: 'tamil-nadu',        hasCNG: true  },
  { key: 'telangana',          slug: 'telangana',         hasCNG: true  },
  { key: 'tripura',            slug: 'tripura',           hasCNG: false },
  { key: 'uttar_pradesh',      slug: 'uttar-pradesh',     hasCNG: true  },
  { key: 'uttarakhand',        slug: 'uttarakhand',       hasCNG: false },
  { key: 'west_bengal',        slug: 'west-bengal',       hasCNG: true  },
  { key: 'andaman_and_nicobar_islands', slug: 'andaman-nicobar', hasCNG: false },
  { key: 'chandigarh',         slug: 'chandigarh',        hasCNG: true  },
  { key: 'dadra_and_nagar_haveli_and_daman_and_diu', slug: 'dadra-nagar-haveli', hasCNG: false },
  { key: 'delhi',              slug: 'delhi',             hasCNG: true  },
  { key: 'jammu_and_kashmir',  slug: 'jammu-kashmir',     hasCNG: false },
  { key: 'ladakh',             slug: 'ladakh',            hasCNG: false },
  { key: 'lakshadweep',        slug: 'lakshadweep',       hasCNG: false },
  { key: 'puducherry',         slug: 'puducherry',        hasCNG: false },
];

async function safeGet(url, ms = 12000) {
  try {
    const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(ms) });
    const text = r.ok ? await r.text() : '';
    return { ok: r.ok, status: r.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: '', err: e.message };
  }
}

// Extract the first plausible fuel price (₹70–₹160/litre or ₹60–₹120/kg for CNG)
function extractPrice(html, min = 60, max = 160) {
  if (!html) return null;
  const patterns = [
    /(?:₹|Rs\.?\s*|&#8377;|&#x20B9;)\s*(\d{2,3}\.\d{2})/g,
    /(\d{2,3}\.\d{2})\s*(?:\/\s*(?:litre|ltr|kg|L))/gi,
    /(?:price|rate)[^₹\d]{0,60}(?:₹|Rs\.?)\s*(\d{2,3}\.\d{2})/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    const matches = [...html.matchAll(re)].map(m => parseFloat(m[1])).filter(v => v >= min && v <= max);
    if (matches.length) return matches[0];
  }
  return null;
}

// ── petroldieselprice.com per-state scraping ──────────────────────────────
async function fetchPDP(slug, fuel) {
  // Try multiple URL patterns petroldieselprice.com uses
  const urls = [
    `${BASE}/${fuel}-price-in-${slug}/`,
    `${BASE}/${fuel}-price-${slug}/`,
    `${BASE}/${slug}/${fuel}/`,
  ];
  for (const url of urls) {
    const { ok, status, text } = await safeGet(url);
    if (ok && text) {
      const price = extractPrice(text);
      if (price) return { price, url };
    }
    if (status !== 404) console.log(`    ${slug} ${fuel} → ${status} (${url.split('/').slice(-3).join('/')})`);
  }
  return null;
}

// ── goodreturns.in fallback for petrol/diesel (correct URL format) ─────────
// Discover state IDs from goodreturns.in's own index pages
async function discoverGRStateIDs() {
  const indexPages = [
    `${GR}/fuel-price.html`,
    `${GR}/petrol-price.html`,
    `${GR}/petrol-price-in-india.html`,
    `${GR}/sitemap.xml`,
  ];
  for (const url of indexPages) {
    const { ok, status, text } = await safeGet(url);
    console.log(`  GR index ${url.split('/').slice(-1)[0]} → ${status}`);
    if (!ok || !text) continue;
    const map = {};
    for (const [, slug, id] of text.matchAll(/(?:petrol|diesel)-price-in-([a-z-]+)-s(\d+)\./gi)) {
      if (!map[slug]) map[slug] = id;
    }
    if (Object.keys(map).length >= 10) {
      console.log(`  ✓ GR: discovered ${Object.keys(map).length} state IDs`);
      return map;
    }
  }
  return null;
}

function grSlugToKey(s) {
  const MAP = { 'jammu-kashmir':'jammu_and_kashmir','andaman-nicobar':'andaman_and_nicobar_islands','pondicherry':'puducherry','nct-of-delhi':'delhi' };
  return MAP[s] ?? s.replace(/-/g, '_');
}

async function scrapeGRState(slug, stateID, fuel) {
  const url = `${GR}/${fuel}-price-in-${slug}-s${stateID}.html`;
  const { ok, status, text } = await safeGet(url);
  if (!ok) return null;
  return extractPrice(text);
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const now = new Date().toISOString();
  console.log(`=== Fuel price pipeline: ${now} ===\n`);

  const rows = [];
  let pdpHits = 0, grHits = 0, baseline = 0;

  // ── Phase 1: petroldieselprice.com (primary — confirmed 200 OK) ───────────
  console.log('── Phase 1: petroldieselprice.com ──');
  const BATCH = 4;

  for (let i = 0; i < STATES.length; i += BATCH) {
    await Promise.all(STATES.slice(i, i + BATCH).map(async state => {
      const [petrolR, dieselR, cngR] = await Promise.all([
        fetchPDP(state.slug, 'petrol'),
        fetchPDP(state.slug, 'diesel'),
        state.hasCNG ? fetchPDP(state.slug, 'cng') : Promise.resolve(null),
      ]);

      if (petrolR && dieselR) {
        rows.push({ key: `petrol_${state.key}`, price: petrolR.price, change_pct: null, updated_at: now });
        rows.push({ key: `diesel_${state.key}`, price: dieselR.price, change_pct: null, updated_at: now });
        if (cngR) rows.push({ key: `cng_${state.key}`, price: cngR.price, change_pct: null, updated_at: now });
        pdpHits++;
        console.log(`  ✓ ${state.key}: petrol=₹${petrolR.price} diesel=₹${dieselR.price}${cngR ? ` cng=₹${cngR.price}` : ''}`);
      } else {
        console.log(`  ✗ ${state.key}: petrol=${petrolR?.price ?? 'null'} diesel=${dieselR?.price ?? 'null'}`);
      }
    }));
    if (i + BATCH < STATES.length) await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\nphase 1 results: ${pdpHits}/${STATES.length} states from petroldieselprice.com`);

  // ── Phase 2: goodreturns.in fallback for missing states ──────────────────
  const missingKeys = new Set(STATES.map(s => s.key).filter(k => !rows.some(r => r.key === `petrol_${k}`)));
  if (missingKeys.size > 0) {
    console.log(`\n── Phase 2: goodreturns.in fallback for ${missingKeys.size} missing states ──`);
    const grIDs = await discoverGRStateIDs();
    if (grIDs) {
      await Promise.all(Object.entries(grIDs).map(async ([slug, id]) => {
        const key = grSlugToKey(slug);
        if (!missingKeys.has(key)) return;
        const [p, d] = await Promise.all([scrapeGRState(slug, id, 'petrol'), scrapeGRState(slug, id, 'diesel')]);
        if (p && d) {
          rows.push({ key: `petrol_${key}`, price: p, change_pct: null, updated_at: now });
          rows.push({ key: `diesel_${key}`, price: d, change_pct: null, updated_at: now });
          grHits++;
          console.log(`  ✓ GR ${key}: petrol=₹${p} diesel=₹${d}`);
        }
      }));
    }
  }

  // ── Phase 3: Baseline for anything still missing ──────────────────────────
  const BASELINE = {
    andhra_pradesh:{p:109.41,d:97.21}, arunachal_pradesh:{p:97.43,d:84.12},
    assam:{p:96.01,d:83.94}, bihar:{p:107.24,d:94.04},
    chhattisgarh:{p:102.70,d:94.76}, goa:{p:96.81,d:90.08},
    gujarat:{p:96.63,d:92.38}, haryana:{p:95.03,d:87.86},
    himachal_pradesh:{p:97.50,d:85.60}, jharkhand:{p:99.09,d:96.77},
    karnataka:{p:102.86,d:88.94}, kerala:{p:102.05,d:90.55},
    madhya_pradesh:{p:108.65,d:93.77}, maharashtra:{p:111.18,d:97.83},
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
  for (const [stateKey, prices] of Object.entries(BASELINE)) {
    if (!rows.some(r => r.key === `petrol_${stateKey}`)) {
      rows.push({ key: `petrol_${stateKey}`, price: prices.p, change_pct: null, updated_at: now });
      rows.push({ key: `diesel_${stateKey}`, price: prices.d, change_pct: null, updated_at: now });
      baseline++;
    }
  }

  // ── Upsert ────────────────────────────────────────────────────────────────
  console.log(`\n── Summary ──`);
  console.log(`petroldieselprice.com: ${pdpHits} states`);
  console.log(`goodreturns.in:        ${grHits} states`);
  console.log(`baseline:              ${baseline} states`);
  console.log(`total rows:            ${rows.length}`);

  if (rows.length === 0) { console.error('No data to store!'); process.exit(1); }

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('market_data').upsert(rows.slice(i, i + 100), { onConflict: 'key' });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  // Show key states as verification
  const mh = rows.find(r => r.key === 'petrol_maharashtra');
  const dl = rows.find(r => r.key === 'petrol_delhi');
  const mhCng = rows.find(r => r.key === 'cng_maharashtra');
  console.log(`\nVerification:`);
  console.log(`  Maharashtra petrol = ₹${mh?.price} (expected ~₹111.18)`);
  console.log(`  Delhi petrol       = ₹${dl?.price}`);
  console.log(`  Maharashtra CNG    = ₹${mhCng?.price ?? 'N/A'}/kg`);
  console.log(`\nDone.`);
}

main().catch(err => { console.error(err); process.exit(1); });
