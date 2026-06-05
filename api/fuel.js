/**
 * /api/fuel  — Vercel serverless function
 *
 * Scrapes goodreturns.in state tables → writes to Supabase → returns JSON.
 *
 * Sources (one fetch each, all states in one page):
 *   goodreturns.in/petrol-price.html  — all-India state petrol table
 *   goodreturns.in/diesel-price.html  — all-India state diesel table
 *   goodreturns.in/cng-price.html     — city-level CNG table
 *
 * Env vars required in Vercel:
 *   SUPABASE_URL         — your Supabase project URL
 *   SUPABASE_SERVICE_KEY — service_role key (server-only, never browser)
 *
 * CDN cache: 1 h (s-maxage=3600)
 */

import { createClient } from '@supabase/supabase-js';

// ── Name → Supabase state key ─────────────────────────────────────────────
const NAME_KEY = {
  'Andhra Pradesh':'andhra_pradesh','Arunachal Pradesh':'arunachal_pradesh',
  'Assam':'assam','Bihar':'bihar','Chhattisgarh':'chhattisgarh','Goa':'goa',
  'Gujarat':'gujarat','Haryana':'haryana','Himachal Pradesh':'himachal_pradesh',
  'Jharkhand':'jharkhand','Karnataka':'karnataka','Kerala':'kerala',
  'Madhya Pradesh':'madhya_pradesh','Maharashtra':'maharashtra',
  'Manipur':'manipur','Meghalaya':'meghalaya','Mizoram':'mizoram',
  'Nagaland':'nagaland','Odisha':'odisha','Orissa':'odisha',
  'Punjab':'punjab','Rajasthan':'rajasthan','Sikkim':'sikkim',
  'Tamil Nadu':'tamil_nadu','Telangana':'telangana','Tripura':'tripura',
  'Uttar Pradesh':'uttar_pradesh','Uttarakhand':'uttarakhand',
  'West Bengal':'west_bengal',
  // UTs
  'Delhi':'delhi','New Delhi':'delhi','Chandigarh':'chandigarh',
  'Puducherry':'puducherry','Pondicherry':'puducherry',
  'Jammu and Kashmir':'jammu_and_kashmir','Jammu & Kashmir':'jammu_and_kashmir',
  'Ladakh':'ladakh','Lakshadweep':'lakshadweep',
  'Andaman and Nicobar Islands':'andaman_and_nicobar_islands',
  'Andaman & Nicobar Islands':'andaman_and_nicobar_islands',
  'Dadra and Nagar Haveli':'dadra_and_nagar_haveli_and_daman_and_diu',
  'Daman and Diu':'dadra_and_nagar_haveli_and_daman_and_diu',
  // CNG cities → state
  'Mumbai':'maharashtra','Pune':'maharashtra','Nagpur':'maharashtra','Thane':'maharashtra','Navi Mumbai':'maharashtra',
  'Ahmedabad':'gujarat','Surat':'gujarat','Vadodara':'gujarat','Rajkot':'gujarat','Gandhinagar':'gujarat',
  'Gurgaon':'haryana','Gurugram':'haryana','Faridabad':'haryana',
  'Noida':'uttar_pradesh','Ghaziabad':'uttar_pradesh','Agra':'uttar_pradesh','Lucknow':'uttar_pradesh','Kanpur':'uttar_pradesh',
  'Hyderabad':'telangana','Bengaluru':'karnataka','Bangalore':'karnataka',
  'Chennai':'tamil_nadu','Kolkata':'west_bengal','Bhubaneswar':'odisha',
  'Indore':'madhya_pradesh','Bhopal':'madhya_pradesh',
  'Amritsar':'punjab','Ludhiana':'punjab','Chandigarh_cng':'chandigarh',
  'Vijayawada':'andhra_pradesh','Visakhapatnam':'andhra_pradesh',
};

function nameToKey(raw) {
  const clean = raw.replace(/\s+/g,' ').trim();
  return NAME_KEY[clean]
    ?? NAME_KEY[clean.split(' ').map(w => w[0]?.toUpperCase()+w.slice(1).toLowerCase()).join(' ')]
    ?? null;
}

// Request headers that look like a real Chrome browser
const HDR = {
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language':'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,hi;q=0.6',
  'Accept-Encoding':'gzip, deflate, br',
  'Referer':'https://www.goodreturns.in/',
  'Cache-Control':'no-cache',
  'Upgrade-Insecure-Requests':'1',
  'Sec-Fetch-Dest':'document',
  'Sec-Fetch-Mode':'navigate',
  'Sec-Fetch-Site':'same-origin',
};

async function fetchPage(path) {
  try {
    const r = await fetch(`https://www.goodreturns.in${path}`, {
      headers: HDR,
      signal: AbortSignal.timeout(15000),
    });
    const text = r.ok ? await r.text() : '';
    console.log(`GET ${path} → ${r.status} (${text.length} bytes)`);

    // Detect block/error pages
    if (!r.ok || text.length < 2000) {
      console.log(`  ⚠ Short or failed response — likely blocked`);
      return '';
    }
    // Validate: page should mention at least one known state
    if (!text.includes('Maharashtra') && !text.includes('Delhi')) {
      console.log(`  ⚠ Page does not contain expected state names — may be bot-detection page`);
      console.log(`  First 300 chars: ${text.slice(0,300).replace(/\s+/g,' ')}`);
      return '';
    }
    return text;
  } catch(e) {
    console.log(`  ✗ ${path}: ${e.message}`);
    return '';
  }
}

/**
 * Parse a goodreturns.in state-table page.
 * Table columns (typical): State | Today's Price | Yesterday's Price | Change
 * We take the first decimal number in the "today" column (index 1 or 2).
 */
function parseTable(html, label) {
  const result = {};
  if (!html) return result;

  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const [, row] of rows) {
    if (/<th[\s>]/i.test(row)) continue;                 // skip header rows

    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m =>
      m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
    );
    if (cells.length < 2) continue;

    const key = nameToKey(cells[0]);
    if (!key || result[key]) continue;                   // skip unknowns / keep first match

    // Look in cells 1, 2, 3 for a plausible price
    for (let ci = 1; ci < Math.min(cells.length, 4); ci++) {
      const m = cells[ci].match(/(\d{2,3}\.\d{2})/);
      if (!m) continue;
      const price = parseFloat(m[1]);
      if (price >= 60 && price <= 165) { result[key] = price; break; }
    }
  }

  const found = Object.keys(result).length;
  console.log(`  Parsed ${label}: ${found} states`);
  if (found > 0) {
    const sample = Object.entries(result).slice(0,3).map(([k,v])=>`${k}=₹${v}`).join(' | ');
    console.log(`  Sample: ${sample}`);
  }
  return result;
}

// ── Baseline — updated June 2025 (Maharashtra confirmed by user) ──────────
// Used only when goodreturns.in is blocked / returns no valid data.
const BASELINE = {
  andhra_pradesh:    {petrol:111.19,diesel:97.21},
  arunachal_pradesh: {petrol:97.43, diesel:84.12},
  assam:             {petrol:96.45, diesel:84.10},
  bihar:             {petrol:107.24,diesel:94.04},
  chhattisgarh:      {petrol:105.36,diesel:96.57},
  goa:               {petrol:96.81, diesel:90.08},
  gujarat:           {petrol:96.63, diesel:92.38},
  haryana:           {petrol:95.61, diesel:88.45},
  himachal_pradesh:  {petrol:97.50, diesel:85.60},
  jharkhand:         {petrol:99.09, diesel:96.77},
  karnataka:         {petrol:104.45,diesel:90.30},
  kerala:            {petrol:102.05,diesel:90.55},
  madhya_pradesh:    {petrol:110.48,diesel:95.46},
  maharashtra:       {petrol:111.18,diesel:97.83},   // ← confirmed live value
  manipur:           {petrol:99.49, diesel:90.71},
  meghalaya:         {petrol:97.53, diesel:88.14},
  mizoram:           {petrol:101.18,diesel:91.47},
  nagaland:          {petrol:99.00, diesel:88.60},
  odisha:            {petrol:103.19,diesel:94.76},
  punjab:            {petrol:98.20, diesel:84.44},
  rajasthan:         {petrol:108.48,diesel:93.72},
  sikkim:            {petrol:102.50,diesel:89.60},
  tamil_nadu:        {petrol:100.75,diesel:92.34},
  telangana:         {petrol:109.18,diesel:97.42},
  tripura:           {petrol:97.13, diesel:88.07},
  uttar_pradesh:     {petrol:96.57, diesel:89.76},
  uttarakhand:       {petrol:95.42, diesel:88.11},
  west_bengal:       {petrol:104.25,diesel:91.19},
  andaman_and_nicobar_islands:{petrol:82.96,diesel:79.41},
  chandigarh:        {petrol:94.24, diesel:82.40},
  dadra_and_nagar_haveli_and_daman_and_diu:{petrol:94.19,diesel:86.86},
  delhi:             {petrol:94.72, diesel:87.62},
  jammu_and_kashmir: {petrol:97.77, diesel:88.70},
  ladakh:            {petrol:100.30,diesel:88.70},
  lakshadweep:       {petrol:83.40, diesel:73.90},
  puducherry:        {petrol:98.30, diesel:90.50},
};

// ── Handler ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  console.log('\n=== /api/fuel ===');

  // Fetch all three pages in parallel
  const [petrolHtml, dieselHtml, cngHtml] = await Promise.all([
    fetchPage('/petrol-price.html'),
    fetchPage('/diesel-price.html'),
    fetchPage('/cng-price.html'),
  ]);

  const petrolMap = parseTable(petrolHtml, 'petrol');
  const dieselMap = parseTable(dieselHtml, 'diesel');
  const cngMap    = parseTable(cngHtml,    'cng');

  const liveOk = Object.keys(petrolMap).length >= 10;
  const source  = liveOk ? 'goodreturns' : 'baseline';
  const updated = new Date().toISOString();

  console.log(`\nResult: ${source} (${Object.keys(petrolMap).length} petrol states live)`);

  // Build combined state dataset — live values override baseline
  const allStates = {};
  for (const [key, base] of Object.entries(BASELINE)) {
    allStates[key] = {
      petrol: petrolMap[key] ?? base.petrol,
      diesel: dieselMap[key] ?? base.diesel,
      cng:    cngMap[key]    ?? null,
    };
  }

  // Write to Supabase (service key needed as Vercel env var)
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;

  if (sbUrl && sbKey) {
    try {
      const sb   = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
      const rows = [];
      for (const [key, prices] of Object.entries(allStates)) {
        rows.push({ key:`petrol_${key}`, price:prices.petrol, change_pct:null, updated_at:updated });
        rows.push({ key:`diesel_${key}`, price:prices.diesel, change_pct:null, updated_at:updated });
        if (prices.cng) rows.push({ key:`cng_${key}`, price:prices.cng, change_pct:null, updated_at:updated });
      }
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await sb.from('market_data').upsert(rows.slice(i,i+100), { onConflict:'key' });
        if (error) console.error(`Supabase batch ${i}: ${error.message}`);
      }
      console.log(`Wrote ${rows.length} rows to Supabase`);
    } catch(e) {
      console.error('Supabase write error:', e.message);
    }
  } else {
    console.warn('SUPABASE_SERVICE_KEY not set — DB write skipped');
  }

  return res.status(200).json({ _source:source, _updated:updated, ...allStates });
}
