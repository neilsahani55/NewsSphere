/**
 * Fuel price pipeline — runs on GitHub Actions (different IPs than Vercel,
 * less likely to be blocked by Indian fuel price websites).
 *
 * Scrapes NDTV → goodreturns.in → stores all 36 states in Supabase.
 * The Vercel /api/fuel function only READS from Supabase (no scraping).
 *
 * Runs every 6 hours via .github/workflows/fuel.yml
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8,hi;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
};

// State name → Supabase key
const NAME_KEY = {
  'Andhra Pradesh':'andhra_pradesh', 'Arunachal Pradesh':'arunachal_pradesh',
  'Assam':'assam', 'Bihar':'bihar', 'Chhattisgarh':'chhattisgarh', 'Chhatisgarh':'chhattisgarh',
  'Goa':'goa', 'Gujarat':'gujarat', 'Haryana':'haryana',
  'Himachal Pradesh':'himachal_pradesh', 'Jharkhand':'jharkhand',
  'Karnataka':'karnataka', 'Kerala':'kerala', 'Madhya Pradesh':'madhya_pradesh',
  'Maharashtra':'maharashtra', 'Manipur':'manipur', 'Meghalaya':'meghalaya',
  'Mizoram':'mizoram', 'Nagaland':'nagaland', 'Odisha':'odisha',
  'Punjab':'punjab', 'Rajasthan':'rajasthan', 'Sikkim':'sikkim',
  'Tamil Nadu':'tamil_nadu', 'Telangana':'telangana', 'Tripura':'tripura',
  'Uttar Pradesh':'uttar_pradesh', 'Uttarakhand':'uttarakhand', 'West Bengal':'west_bengal',
  'Delhi':'delhi', 'New Delhi':'delhi', 'Chandigarh':'chandigarh',
  'Puducherry':'puducherry', 'Pondicherry':'puducherry',
  'Jammu and Kashmir':'jammu_and_kashmir', 'Jammu & Kashmir':'jammu_and_kashmir',
  'Ladakh':'ladakh', 'Lakshadweep':'lakshadweep',
  'Andaman And Nicobar':'andaman_and_nicobar_islands',
  'Andaman and Nicobar':'andaman_and_nicobar_islands',
  'Andaman & Nicobar':'andaman_and_nicobar_islands',
  'Andaman and Nicobar Islands':'andaman_and_nicobar_islands',
  'Andaman & Nicobar Islands':'andaman_and_nicobar_islands',
  'A & N Islands':'andaman_and_nicobar_islands',
  'Dadra and Nagar Haveli and Daman and Diu':'dadra_and_nagar_haveli_and_daman_and_diu',
  'Dadra and Nagar Haveli':'dadra_and_nagar_haveli_and_daman_and_diu',
  'Dadra & Nagar Haveli':'dadra_and_nagar_haveli_and_daman_and_diu',
  'Dadra And Nagar Haveli':'dadra_and_nagar_haveli_and_daman_and_diu',
};

function nameToKey(raw) {
  const clean = raw.replace(/\s+/g, ' ').trim();
  return NAME_KEY[clean]
    ?? NAME_KEY[clean.split(' ').map(w => w[0]?.toUpperCase() + w.slice(1).toLowerCase()).join(' ')]
    ?? null;
}

async function fetchPage(url, referer) {
  try {
    const r = await fetch(url, {
      headers: { ...HDR, Referer: referer || 'https://www.google.com/' },
      signal: AbortSignal.timeout(15000),
    });
    const text = r.ok ? await r.text() : '';
    console.log(`  ${url} → HTTP ${r.status} (${text.length}b)`);
    return text;
  } catch (e) {
    console.log(`  ${url} → ERROR: ${e.message}`);
    return '';
  }
}

function parseTable(html, label) {
  const out = {};
  if (!html || html.length < 1000) return out;

  // Check for known state names to validate this is actual content
  if (!html.includes('Maharashtra') && !html.includes('Delhi') && !html.includes('Gujarat')) {
    console.log(`  ${label}: page doesn't look like fuel prices (possible block/redirect)`);
    return out;
  }

  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const [, row] of rows) {
    if (/<th[\s>]/i.test(row)) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (cells.length < 2) continue;
    const key = nameToKey(cells[0]);
    if (!key || out[key]) continue;
    for (let ci = 1; ci < Math.min(cells.length, 4); ci++) {
      const m = cells[ci].match(/(\d{2,3}\.\d{2})/);
      if (m) {
        const v = parseFloat(m[1]);
        if (v >= 60 && v <= 170) { out[key] = v; break; }
      }
    }
  }

  const found = Object.keys(out).length;
  console.log(`  ${label}: ${found} states`);
  if (found > 0) {
    console.log(`  Sample: ${Object.entries(out).slice(0,3).map(([k,v])=>`${k}=₹${v}`).join(' | ')}`);
  }
  return out;
}

async function scrapeNDTV() {
  console.log('Trying NDTV...');
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

async function scrapeGoodReturns() {
  console.log('Trying goodreturns.in...');
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

// Verified June 2026 baseline (from live screenshots provided by user)
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
  maharashtra:       {petrol:111.18,diesel:97.83},
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

async function main() {
  const now = new Date().toISOString();
  console.log(`=== Fuel pipeline: ${now} ===\n`);

  // Try live sources (GitHub Actions IPs differ from Vercel)
  let scraped = await scrapeNDTV();

  const hasLive = (map) => Object.keys(map).length >= 10;
  if (!hasLive(scraped.petrol) || !hasLive(scraped.diesel)) {
    const gr = await scrapeGoodReturns();
    if (hasLive(gr.petrol))  scraped.petrol = gr.petrol;
    if (hasLive(gr.diesel))  scraped.diesel = gr.diesel;
    if (hasLive(gr.cng))     scraped.cng    = gr.cng;
  }

  const liveOk = hasLive(scraped.petrol) && hasLive(scraped.diesel);
  const source = liveOk ? 'live' : 'baseline';
  console.log(`\nSource: ${source}`);

  // Merge live over baseline
  const final = { ...BASELINE };
  if (liveOk) {
    for (const key of Object.keys(BASELINE)) {
      final[key] = {
        petrol: scraped.petrol[key] ?? BASELINE[key].petrol,
        diesel: scraped.diesel[key] ?? BASELINE[key].diesel,
        cng:    (scraped.cng || {})[key] ?? null,
      };
    }
  }

  // Upsert all states into Supabase
  const rows = [];
  for (const [key, prices] of Object.entries(final)) {
    rows.push({ key: `petrol_${key}`, price: prices.petrol, change_pct: null, updated_at: now });
    rows.push({ key: `diesel_${key}`, price: prices.diesel, change_pct: null, updated_at: now });
    if (prices.cng) rows.push({ key: `cng_${key}`, price: prices.cng, change_pct: null, updated_at: now });
  }

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('market_data').upsert(rows.slice(i, i + 100), { onConflict: 'key' });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  console.log(`\nStored ${rows.length} rows (source: ${source})`);
  console.log(`Delhi:       petrol=₹${final.delhi?.petrol}  diesel=₹${final.delhi?.diesel}`);
  console.log(`Maharashtra: petrol=₹${final.maharashtra?.petrol}  diesel=₹${final.maharashtra?.diesel}`);
  console.log(`Andhra:      petrol=₹${final.andhra_pradesh?.petrol}  diesel=₹${final.andhra_pradesh?.diesel}`);
}

main().catch(err => { console.error(err); process.exit(1); });
