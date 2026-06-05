/**
 * /api/fuel  — Vercel serverless function (Node.js runtime)
 *
 * Scrapes goodreturns.in state tables → writes every state to Supabase
 * market_data → returns the full dataset as JSON.
 *
 * Sources:
 *   /petrol-price.html  — full Indian state petrol table
 *   /diesel-price.html  — full Indian state diesel table
 *   /cng-price.html     — city-level CNG table
 *
 * Side-effect: upserts petrol_{state} / diesel_{state} / cng_{state}
 * into market_data so the frontend can read from Supabase for instant load.
 *
 * Requires Vercel env var: SUPABASE_SERVICE_KEY
 * (Add in Vercel Dashboard → Settings → Environment Variables)
 *
 * CDN cache: 1 hour (s-maxage=3600)
 */
import { createClient } from '@supabase/supabase-js';

// State/city name → Supabase key
const NAME_KEY = {
  'Andhra Pradesh':'andhra_pradesh','Arunachal Pradesh':'arunachal_pradesh',
  'Assam':'assam','Bihar':'bihar','Chhattisgarh':'chhattisgarh','Goa':'goa',
  'Gujarat':'gujarat','Haryana':'haryana','Himachal Pradesh':'himachal_pradesh',
  'Jharkhand':'jharkhand','Karnataka':'karnataka','Kerala':'kerala',
  'Madhya Pradesh':'madhya_pradesh','Maharashtra':'maharashtra','Manipur':'manipur',
  'Meghalaya':'meghalaya','Mizoram':'mizoram','Nagaland':'nagaland',
  'Odisha':'odisha','Orissa':'odisha','Punjab':'punjab','Rajasthan':'rajasthan',
  'Sikkim':'sikkim','Tamil Nadu':'tamil_nadu','Telangana':'telangana',
  'Tripura':'tripura','Uttar Pradesh':'uttar_pradesh','Uttarakhand':'uttarakhand',
  'West Bengal':'west_bengal','Delhi':'delhi','New Delhi':'delhi',
  'Chandigarh':'chandigarh','Puducherry':'puducherry','Pondicherry':'puducherry',
  'Jammu and Kashmir':'jammu_and_kashmir','Jammu & Kashmir':'jammu_and_kashmir',
  'Ladakh':'ladakh','Lakshadweep':'lakshadweep',
  'Andaman and Nicobar Islands':'andaman_and_nicobar_islands',
  'Andaman & Nicobar Islands':'andaman_and_nicobar_islands',
  'Dadra and Nagar Haveli':'dadra_and_nagar_haveli_and_daman_and_diu',
  'Daman and Diu':'dadra_and_nagar_haveli_and_daman_and_diu',
  // CNG cities → state key
  'Mumbai':'maharashtra','Pune':'maharashtra','Nagpur':'maharashtra','Thane':'maharashtra',
  'Ahmedabad':'gujarat','Surat':'gujarat','Vadodara':'gujarat','Rajkot':'gujarat','Gandhinagar':'gujarat',
  'Gurgaon':'haryana','Gurugram':'haryana','Faridabad':'haryana',
  'Noida':'uttar_pradesh','Ghaziabad':'uttar_pradesh','Agra':'uttar_pradesh',
  'Lucknow':'uttar_pradesh','Kanpur':'uttar_pradesh',
  'Hyderabad':'telangana','Bengaluru':'karnataka','Bangalore':'karnataka',
  'Chennai':'tamil_nadu','Kolkata':'west_bengal','Bhubaneswar':'odisha',
  'Indore':'madhya_pradesh','Bhopal':'madhya_pradesh',
  'Amritsar':'punjab','Ludhiana':'punjab',
  'Vijayawada':'andhra_pradesh','Visakhapatnam':'andhra_pradesh',
};

function nameToKey(raw) {
  const clean = raw.replace(/\s+/g,' ').trim();
  return NAME_KEY[clean] ?? NAME_KEY[clean.split(' ').map(w=>w[0].toUpperCase()+w.slice(1).toLowerCase()).join(' ')] ?? null;
}

const GR_HEADERS = {
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language':'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,hi;q=0.6',
  'Accept-Encoding':'gzip, deflate, br',
  'Referer':'https://www.goodreturns.in/',
  'Cache-Control':'no-cache',
  'Sec-Fetch-Dest':'document',
  'Sec-Fetch-Mode':'navigate',
  'Sec-Fetch-Site':'same-origin',
  'Upgrade-Insecure-Requests':'1',
};

async function fetchGR(path) {
  try {
    const r = await fetch(`https://www.goodreturns.in${path}`, {
      headers: GR_HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    console.log(`GR ${path} → ${r.status}`);
    return r.ok ? await r.text() : '';
  } catch(e) {
    console.log(`GR ${path} error: ${e.message}`);
    return '';
  }
}

// Parse a goodreturns.in state table page.
// The table has rows: Name | Today Price | Yesterday Price | Change
function parseStateTable(html) {
  const result = {};
  if (!html || html.length < 500) return result;

  // Split into table rows
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const [, rowContent] of rows) {
    // Skip header rows
    if (/<th[\s>]/i.test(rowContent)) continue;

    // Extract all <td> cell contents
    const cells = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
    if (cells.length < 2) continue;

    // Cell 0: state/city name (strip HTML tags)
    const rawName = cells[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const key = nameToKey(rawName);
    if (!key) continue;

    // Cell 1: price — find ₹XX.XX or just XX.XX in a plausible fuel range
    const priceText = cells[1].replace(/<[^>]+>/g, '');
    const m = priceText.match(/(\d{2,3}\.\d{2})/);
    if (!m) continue;
    const price = parseFloat(m[1]);
    if (price < 60 || price > 165) continue;

    // Keep first match (most relevant = state over city)
    if (!result[key]) result[key] = price;
  }
  return result;
}

// Verified baseline — Maharashtra confirmed by user (June 2025)
const BASELINE = {
  andhra_pradesh:{petrol:111.19,diesel:97.21},arunachal_pradesh:{petrol:97.43,diesel:84.12},
  assam:{petrol:96.45,diesel:84.10},bihar:{petrol:107.24,diesel:94.04},
  chhattisgarh:{petrol:105.36,diesel:96.57},goa:{petrol:96.81,diesel:90.08},
  gujarat:{petrol:96.63,diesel:92.38},haryana:{petrol:95.61,diesel:88.45},
  himachal_pradesh:{petrol:97.50,diesel:85.60},jharkhand:{petrol:99.09,diesel:96.77},
  karnataka:{petrol:104.45,diesel:90.30},kerala:{petrol:102.05,diesel:90.55},
  madhya_pradesh:{petrol:110.48,diesel:95.46},
  maharashtra:{petrol:111.18,diesel:97.83},  // confirmed by user
  manipur:{petrol:99.49,diesel:90.71},meghalaya:{petrol:97.53,diesel:88.14},
  mizoram:{petrol:101.18,diesel:91.47},nagaland:{petrol:99.00,diesel:88.60},
  odisha:{petrol:103.19,diesel:94.76},punjab:{petrol:98.20,diesel:84.44},
  rajasthan:{petrol:106.55,diesel:91.98},sikkim:{petrol:102.50,diesel:89.60},
  tamil_nadu:{petrol:100.75,diesel:92.34},telangana:{petrol:109.18,diesel:97.42},
  tripura:{petrol:97.13,diesel:88.07},uttar_pradesh:{petrol:96.57,diesel:89.76},
  uttarakhand:{petrol:95.42,diesel:88.11},west_bengal:{petrol:104.25,diesel:91.19},
  andaman_and_nicobar_islands:{petrol:82.96,diesel:79.41},
  chandigarh:{petrol:94.24,diesel:82.40},
  dadra_and_nagar_haveli_and_daman_and_diu:{petrol:94.19,diesel:86.86},
  delhi:{petrol:94.72,diesel:87.62},
  jammu_and_kashmir:{petrol:97.77,diesel:88.70},
  ladakh:{petrol:100.30,diesel:88.70},
  lakshadweep:{petrol:83.40,diesel:73.90},
  puducherry:{petrol:98.30,diesel:90.50},
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  console.log('Fetching goodreturns.in petrol/diesel/cng pages...');

  // Fetch all three pages in parallel
  const [petrolHtml, dieselHtml, cngHtml] = await Promise.all([
    fetchGR('/petrol-price.html'),
    fetchGR('/diesel-price.html'),
    fetchGR('/cng-price.html'),
  ]);

  const petrolMap = parseStateTable(petrolHtml);
  const dieselMap = parseStateTable(dieselHtml);
  const cngMap    = parseStateTable(cngHtml);   // CNG uses same table structure

  const petrolCount = Object.keys(petrolMap).length;
  const dieselCount = Object.keys(dieselMap).length;
  const cngCount    = Object.keys(cngMap).length;
  console.log(`Parsed: petrol=${petrolCount} diesel=${dieselCount} cng=${cngCount}`);

  const liveOk = petrolCount >= 10 && dieselCount >= 10;

  // Build combined result for all states
  const allStates = {};
  for (const [key, baseline] of Object.entries(BASELINE)) {
    allStates[key] = {
      petrol: petrolMap[key] ?? baseline.petrol,
      diesel: dieselMap[key] ?? baseline.diesel,
      cng:    cngMap[key]    ?? null,
    };
  }

  const source  = liveOk ? 'goodreturns' : 'baseline';
  const updated = new Date().toISOString();

  // Write all state prices to Supabase so the frontend can read them instantly
  // Requires SUPABASE_SERVICE_KEY set as a Vercel environment variable
  const sbUrl = process.env.SUPABASE_URL        || process.env.VITE_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (sbUrl && sbKey) {
    try {
      const sb   = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
      const rows = [];
      for (const [key, prices] of Object.entries(allStates)) {
        rows.push({ key: `petrol_${key}`, price: prices.petrol,        change_pct: null, updated_at: updated });
        rows.push({ key: `diesel_${key}`, price: prices.diesel ?? null, change_pct: null, updated_at: updated });
        if (prices.cng) rows.push({ key: `cng_${key}`, price: prices.cng, change_pct: null, updated_at: updated });
      }
      // Upsert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await sb.from('market_data').upsert(rows.slice(i, i + 100), { onConflict: 'key' });
        if (error) console.error(`Supabase upsert error (batch ${i}):`, error.message);
      }
      console.log(`Wrote ${rows.length} rows to Supabase (source: ${source})`);
    } catch (e) {
      console.error('Supabase write failed:', e.message);
    }
  } else {
    console.warn('SUPABASE_SERVICE_KEY not set — Supabase write skipped');
  }

  return res.status(200).json({
    _source:  source,
    _updated: updated,
    ...allStates,
  });
}
