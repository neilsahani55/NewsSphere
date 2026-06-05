/**
 * /api/fuel  — reads fuel prices from Supabase (populated by GitHub Actions pipeline).
 *
 * NO scraping happens here. Vercel servers are blocked (403) by NDTV and
 * goodreturns.in. All scraping runs in history-pipeline/fuel.js on GitHub
 * Actions which has different IPs.
 *
 * If Supabase has data → return it.
 * If Supabase is empty (first run before pipeline executed) → return baseline.
 *
 * CDN cache: 5 min (data changes at most every 6 hours from pipeline).
 */

import { createClient } from '@supabase/supabase-js';

// Verified June 2026 baseline (confirmed from live screenshots)
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // 5-min CDN cache — pipeline updates every 6h, this is fresh enough
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  // Read all fuel keys from Supabase
  let dbMap = {};
  let source = 'baseline';
  let updated = null;

  if (sbUrl && sbKey) {
    try {
      const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
      const { data } = await sb
        .from('market_data')
        .select('key, price, updated_at')
        .or(Object.keys(BASELINE).map(k => `key.eq.petrol_${k}`).join(',') +
            ',' + Object.keys(BASELINE).map(k => `key.eq.diesel_${k}`).join(',') +
            ',' + Object.keys(BASELINE).map(k => `key.eq.cng_${k}`).join(','));

      if (data?.length) {
        for (const r of data) {
          dbMap[r.key] = r.price;
          if (!updated || r.updated_at > updated) updated = r.updated_at;
        }
        // Only use DB if it has a reasonable number of fuel entries
        if (Object.keys(dbMap).length >= 20) source = 'pipeline';
      }
    } catch (e) {
      console.error('Supabase read error:', e.message);
    }
  }

  // Build state results — prefer DB values, fall back to baseline
  const allStates = {};
  for (const [key, base] of Object.entries(BASELINE)) {
    allStates[key] = {
      petrol: dbMap[`petrol_${key}`] ?? base.petrol,
      diesel: dbMap[`diesel_${key}`] ?? base.diesel,
      cng:    dbMap[`cng_${key}`]    ?? null,
    };
  }

  console.log(`/api/fuel: source=${source} states=${Object.keys(allStates).length} updated=${updated}`);
  return res.status(200).json({ _source: source, _updated: updated || new Date().toISOString(), ...allStates });
}
