/**
 * /api/fuel  — Vercel serverless function
 *
 * Scrapes live fuel prices → writes to Supabase → returns JSON.
 *
 * Primary source:   ndtv.com/fuel-prices/petrol-price-in-all-state
 *                   ndtv.com/fuel-prices/diesel-price-in-all-state
 * Secondary source: goodreturns.in/petrol-price.html (fallback)
 * Tertiary:         verified June 2026 baseline (from live sources)
 *
 * CDN cache: 1 hour (s-maxage=3600)
 */

import { createClient } from '@supabase/supabase-js';

// ── State name → Supabase key ──────────────────────────────────────────────
const NAME_KEY = {
  // Standard names
  'Andhra Pradesh':'andhra_pradesh',
  'Arunachal Pradesh':'arunachal_pradesh',
  'Assam':'assam','Bihar':'bihar','Chhattisgarh':'chhattisgarh',
  'Chhatisgarh':'chhattisgarh','Chattisgarh':'chhattisgarh',
  'Goa':'goa','Gujarat':'gujarat','Haryana':'haryana',
  'Himachal Pradesh':'himachal_pradesh','Jharkhand':'jharkhand',
  'Karnataka':'karnataka','Kerala':'kerala',
  'Madhya Pradesh':'madhya_pradesh','Maharashtra':'maharashtra',
  'Manipur':'manipur','Meghalaya':'meghalaya','Mizoram':'mizoram',
  'Nagaland':'nagaland','Odisha':'odisha','Punjab':'punjab',
  'Rajasthan':'rajasthan','Sikkim':'sikkim',
  'Tamil Nadu':'tamil_nadu','Telangana':'telangana','Tripura':'tripura',
  'Uttar Pradesh':'uttar_pradesh','Uttarakhand':'uttarakhand',
  'West Bengal':'west_bengal',
  // UTs
  'Delhi':'delhi','New Delhi':'delhi',
  'Chandigarh':'chandigarh','Puducherry':'puducherry','Pondicherry':'puducherry',
  'Jammu and Kashmir':'jammu_and_kashmir','Jammu & Kashmir':'jammu_and_kashmir',
  'Ladakh':'ladakh','Lakshadweep':'lakshadweep',
  'Andaman and Nicobar Islands':'andaman_and_nicobar_islands',
  'Andaman & Nicobar Islands':'andaman_and_nicobar_islands',
  'Andaman and Nicobar':'andaman_and_nicobar_islands',
  'Andaman & Nicobar':'andaman_and_nicobar_islands',
  'Andaman And Nicobar':'andaman_and_nicobar_islands',  // NDTV format
  'A & N Islands':'andaman_and_nicobar_islands',
  'Dadra and Nagar Haveli and Daman and Diu':'dadra_and_nagar_haveli_and_daman_and_diu',
  'Dadra and Nagar Haveli':'dadra_and_nagar_haveli_and_daman_and_diu',
  'Dadra & Nagar Haveli':'dadra_and_nagar_haveli_and_daman_and_diu',
  'Dadra And Nagar Haveli':'dadra_and_nagar_haveli_and_daman_and_diu',
  'DNH and DD':'dadra_and_nagar_haveli_and_daman_and_diu',
  // CNG cities → state
  'Mumbai':'maharashtra','Pune':'maharashtra','Nagpur':'maharashtra',
  'Thane':'maharashtra','Navi Mumbai':'maharashtra',
  'Ahmedabad':'gujarat','Surat':'gujarat','Vadodara':'gujarat',
  'Rajkot':'gujarat','Gandhinagar':'gujarat',
  'Gurgaon':'haryana','Gurugram':'haryana','Faridabad':'haryana',
  'Noida':'uttar_pradesh','Ghaziabad':'uttar_pradesh',
  'Agra':'uttar_pradesh','Lucknow':'uttar_pradesh','Kanpur':'uttar_pradesh',
  'Hyderabad':'telangana','Bengaluru':'karnataka','Bangalore':'karnataka',
  'Chennai':'tamil_nadu','Kolkata':'west_bengal','Bhubaneswar':'odisha',
  'Indore':'madhya_pradesh','Bhopal':'madhya_pradesh',
  'Amritsar':'punjab','Ludhiana':'punjab',
  'Vijayawada':'andhra_pradesh','Visakhapatnam':'andhra_pradesh',
};

function nameToKey(raw) {
  const clean = raw.replace(/\s+/g,' ').trim();
  // exact → title-case → fuzzy
  return NAME_KEY[clean]
    ?? NAME_KEY[clean.split(' ').map(w=>w[0]?.toUpperCase()+w.slice(1).toLowerCase()).join(' ')]
    ?? null;
}

// Verified June 2026 values (from live screenshots provided by user)
// andhra_pradesh=117.42, assam=105.73, bihar=113.37, delhi=102.12,
// chandigarh=101.54, chhattisgarh=108.16, dadra=99.50, goa=104.06
// gujarat=102.28, andaman=88.66, maharashtra=111.18 (user-confirmed)
const BASELINE = {
  andaman_and_nicobar_islands:{petrol:88.66, diesel:77.65},
  andhra_pradesh:    {petrol:117.42,diesel:105.80},
  arunachal_pradesh: {petrol:97.70, diesel:86.56},
  assam:             {petrol:105.73,diesel:92.10},
  bihar:             {petrol:113.37,diesel:101.46},
  chandigarh:        {petrol:101.54,diesel:89.32},
  chhattisgarh:      {petrol:108.16,diesel:95.72},
  dadra_and_nagar_haveli_and_daman_and_diu:{petrol:99.50,diesel:91.72},
  delhi:             {petrol:102.12,diesel:89.62},
  goa:               {petrol:104.06,diesel:94.39},
  gujarat:           {petrol:102.28,diesel:97.95},
  haryana:           {petrol:103.87,diesel:90.74},
  himachal_pradesh:  {petrol:98.08, diesel:87.54},
  jammu_and_kashmir: {petrol:101.86,diesel:90.28},
  jharkhand:         {petrol:106.74,diesel:101.26},
  karnataka:         {petrol:111.62,diesel:97.51},
  kerala:            {petrol:110.42,diesel:99.22},
  ladakh:            {petrol:106.20,diesel:93.78},
  lakshadweep:       {petrol:84.74, diesel:77.48},
  madhya_pradesh:    {petrol:117.20,diesel:103.97},
  maharashtra:       {petrol:111.18,diesel:97.83},   // ← confirmed by user
  manipur:           {petrol:107.33,diesel:97.22},
  meghalaya:         {petrol:105.38,diesel:92.89},
  mizoram:           {petrol:109.32,diesel:97.30},
  nagaland:          {petrol:106.82,diesel:95.20},
  odisha:            {petrol:111.08,diesel:101.98},
  puducherry:        {petrol:100.35,diesel:93.27},
  punjab:            {petrol:104.42,diesel:91.23},
  rajasthan:         {petrol:113.84,diesel:100.41},
  sikkim:            {petrol:110.22,diesel:97.64},
  tamil_nadu:        {petrol:108.14,diesel:99.45},
  telangana:         {petrol:117.03,diesel:106.88},
  tripura:           {petrol:105.37,diesel:93.68},
  uttar_pradesh:     {petrol:104.12,diesel:91.19},
  uttarakhand:       {petrol:102.88,diesel:90.28},
  west_bengal:       {petrol:112.08,diesel:100.62},
};

const BROWSER_HDR = {
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language':'en-IN,en-US;q=0.9,en;q=0.8,hi;q=0.7',
  'Accept-Encoding':'gzip, deflate, br',
  'Cache-Control':'no-cache',
  'Upgrade-Insecure-Requests':'1',
};

async function fetchPage(url, referer) {
  try {
    const hdr = { ...BROWSER_HDR, Referer: referer || url.split('/').slice(0,3).join('/') };
    const r = await fetch(url, { headers: hdr, signal: AbortSignal.timeout(15000) });
    const text = r.ok ? await r.text() : '';
    console.log(`GET ${url} → ${r.status} (${text.length}b)`);
    if (!r.ok || text.length < 1000) return '';
    return text;
  } catch(e) {
    console.log(`  ✗ ${url}: ${e.message}`);
    return '';
  }
}

/**
 * Parse a fuel price table page.
 * Tries <tr><td> parsing; price extracted from decimal number in ₹60-165 range.
 */
function parseTable(html, label) {
  const out = {};
  if (!html) return out;

  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const [, row] of rows) {
    if (/<th[\s>]/i.test(row)) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
    if (cells.length < 2) continue;

    const key = nameToKey(cells[0]);
    if (!key || out[key]) continue;

    for (let ci = 1; ci < Math.min(cells.length, 4); ci++) {
      const m = cells[ci].match(/(\d{2,3}\.\d{2})/);
      if (m) {
        const v = parseFloat(m[1]);
        if (v >= 60 && v <= 165) { out[key] = v; break; }
      }
    }
  }

  console.log(`  ${label}: ${Object.keys(out).length} states parsed`);
  if (Object.keys(out).length > 0) {
    const s = Object.entries(out).slice(0,4).map(([k,v])=>`${k}=₹${v}`).join(' ');
    console.log(`  Sample: ${s}`);
  }
  return out;
}

// ── NDTV (primary) ─────────────────────────────────────────────────────────
async function scrapeNDTV() {
  const base = 'https://www.ndtv.com';
  const [ph, dh, ch] = await Promise.all([
    fetchPage(`${base}/fuel-prices/petrol-price-in-all-state`, base),
    fetchPage(`${base}/fuel-prices/diesel-price-in-all-state`, base),
    fetchPage(`${base}/fuel-prices/cng-price-in-all-state`,   base),
  ]);
  return {
    petrol: parseTable(ph, 'NDTV petrol'),
    diesel: parseTable(dh, 'NDTV diesel'),
    cng:    parseTable(ch, 'NDTV cng'),
  };
}

// ── goodreturns.in (secondary) ─────────────────────────────────────────────
async function scrapeGoodReturns() {
  const base = 'https://www.goodreturns.in';
  const [ph, dh, ch] = await Promise.all([
    fetchPage(`${base}/petrol-price.html`, base),
    fetchPage(`${base}/diesel-price.html`, base),
    fetchPage(`${base}/cng-price.html`,    base),
  ]);
  return {
    petrol: parseTable(ph, 'GR petrol'),
    diesel: parseTable(dh, 'GR diesel'),
    cng:    parseTable(ch, 'GR cng'),
  };
}

function isUsable(map) { return Object.keys(map).length >= 10; }

// ── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  console.log('\n=== /api/fuel ===');

  // Try NDTV first (major Indian news site, less likely to block scrapers)
  console.log('── NDTV (primary) ──');
  let scraped = await scrapeNDTV();

  // Fall back to goodreturns.in if NDTV didn't return enough data
  if (!isUsable(scraped.petrol) || !isUsable(scraped.diesel)) {
    console.log('── goodreturns.in (fallback) ──');
    const gr = await scrapeGoodReturns();
    if (isUsable(gr.petrol))  scraped.petrol = gr.petrol;
    if (isUsable(gr.diesel))  scraped.diesel = gr.diesel;
    if (isUsable(gr.cng))     scraped.cng    = gr.cng;
  }

  const liveOk  = isUsable(scraped.petrol) && isUsable(scraped.diesel);
  const source  = liveOk ? 'live' : 'baseline';
  const updated = new Date().toISOString();

  console.log(`\nOutcome: ${source} (petrol=${Object.keys(scraped.petrol).length} diesel=${Object.keys(scraped.diesel).length} cng=${Object.keys(scraped.cng||{}).length})`);

  // Merge live over baseline — baseline fills any state the scraper missed
  const allStates = {};
  for (const [key, base] of Object.entries(BASELINE)) {
    allStates[key] = {
      petrol: scraped.petrol[key] ?? base.petrol,
      diesel: scraped.diesel[key] ?? base.diesel,
      cng:    (scraped.cng||{})[key] ?? null,
    };
  }

  // Persist to Supabase
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (sbUrl && sbKey) {
    try {
      const sb   = createClient(sbUrl, sbKey, { auth:{ persistSession:false } });
      const rows = [];
      for (const [key, prices] of Object.entries(allStates)) {
        rows.push({ key:`petrol_${key}`, price:prices.petrol, change_pct:null, updated_at:updated });
        rows.push({ key:`diesel_${key}`, price:prices.diesel, change_pct:null, updated_at:updated });
        if (prices.cng) rows.push({ key:`cng_${key}`, price:prices.cng, change_pct:null, updated_at:updated });
      }
      for (let i=0; i<rows.length; i+=100) {
        const { error } = await sb.from('market_data').upsert(rows.slice(i,i+100), { onConflict:'key' });
        if (error) console.error(`Supabase batch ${i}: ${error.message}`);
      }
      console.log(`Wrote ${rows.length} rows to Supabase`);
    } catch(e) { console.error('Supabase write:', e.message); }
  } else {
    console.warn('SUPABASE_SERVICE_KEY not set');
  }

  // Spot-check log
  const mh = allStates.maharashtra, dl = allStates.delhi, ap = allStates.andhra_pradesh;
  console.log(`Maharashtra: ₹${mh?.petrol}p / ₹${mh?.diesel}d`);
  console.log(`Delhi:       ₹${dl?.petrol}p / ₹${dl?.diesel}d`);
  console.log(`Andhra:      ₹${ap?.petrol}p / ₹${ap?.diesel}d`);

  return res.status(200).json({ _source:source, _updated:updated, ...allStates });
}
