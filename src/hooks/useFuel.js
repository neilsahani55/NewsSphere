/**
 * Live Indian fuel prices — reads from Supabase market_data table.
 * The fuel pipeline (fuel.js / GitHub Actions) fetches from HPCL + IOC
 * server-side every 6 hours and upserts state-wise prices into Supabase.
 * This hook reads the matching state's prices using the user's IP location.
 *
 * Key format in Supabase:  petrol_{state_key}  /  diesel_{state_key}
 * e.g.  petrol_maharashtra = 103.44, diesel_maharashtra = 89.97
 *
 * Fallback chain:
 *   1. Supabase (pipeline-populated, updated every 6 hours) — primary
 *   2. /api/fuel (Vercel serverless, real-time HPCL/IOC fetch) — secondary
 *   3. Built-in reference prices (state-matched) — always available
 */

import { useEffect, useState } from 'react';
import { useLocation } from './useLocation.js';
import { supabase } from '../lib/supabase.js';

// Map ipapi.co region strings to Supabase state keys
const REGION_TO_KEY = {
  'Andhra Pradesh':             'andhra_pradesh',
  'Arunachal Pradesh':          'arunachal_pradesh',
  'Assam':                      'assam',
  'Bihar':                      'bihar',
  'Chhattisgarh':               'chhattisgarh',
  'Goa':                        'goa',
  'Gujarat':                    'gujarat',
  'Haryana':                    'haryana',
  'Himachal Pradesh':           'himachal_pradesh',
  'Jharkhand':                  'jharkhand',
  'Karnataka':                  'karnataka',
  'Kerala':                     'kerala',
  'Madhya Pradesh':             'madhya_pradesh',
  'Maharashtra':                'maharashtra',
  'Manipur':                    'manipur',
  'Meghalaya':                  'meghalaya',
  'Mizoram':                    'mizoram',
  'Nagaland':                   'nagaland',
  'Odisha':                     'odisha',
  'Orissa':                     'odisha',
  'Punjab':                     'punjab',
  'Rajasthan':                  'rajasthan',
  'Sikkim':                     'sikkim',
  'Tamil Nadu':                 'tamil_nadu',
  'Telangana':                  'telangana',
  'Tripura':                    'tripura',
  'Uttar Pradesh':              'uttar_pradesh',
  'Uttarakhand':                'uttarakhand',
  'Uttaranchal':                'uttarakhand',
  'West Bengal':                'west_bengal',
  // Union Territories
  'Delhi':                      'delhi',
  'NCT of Delhi':               'delhi',
  'National Capital Territory': 'delhi',
  'Chandigarh':                 'chandigarh',
  'Puducherry':                 'puducherry',
  'Pondicherry':                'puducherry',
  'Jammu and Kashmir':          'jammu_and_kashmir',
  'Jammu & Kashmir':            'jammu_and_kashmir',
  'Ladakh':                     'ladakh',
  'Andaman and Nicobar Islands':'andaman_and_nicobar_islands',
  'Andaman and Nicobar':        'andaman_and_nicobar_islands',
  'Lakshadweep':                'lakshadweep',
  'Dadra and Nagar Haveli and Daman and Diu': 'dadra_and_nagar_haveli_and_daman_and_diu',
};

// Inline reference prices as final safety net
const REF = {
  delhi: { p: 94.72, d: 87.62 }, maharashtra: { p: 103.44, d: 89.97 },
  karnataka: { p: 102.86, d: 88.94 }, tamil_nadu: { p: 100.75, d: 92.34 },
  telangana: { p: 107.41, d: 95.65 }, andhra_pradesh: { p: 109.41, d: 97.21 },
  kerala: { p: 102.05, d: 90.55 }, gujarat: { p: 96.63, d: 92.38 },
  rajasthan: { p: 104.88, d: 90.36 }, madhya_pradesh: { p: 108.65, d: 93.77 },
  uttar_pradesh: { p: 96.57, d: 89.76 }, bihar: { p: 107.24, d: 94.04 },
  west_bengal: { p: 103.94, d: 90.56 }, punjab: { p: 96.94, d: 83.67 },
  haryana: { p: 95.03, d: 87.86 }, odisha: { p: 103.19, d: 94.76 },
  assam: { p: 96.01, d: 83.94 }, jharkhand: { p: 99.09, d: 96.77 },
  chandigarh: { p: 94.24, d: 82.40 }, goa: { p: 96.81, d: 90.08 },
  chhattisgarh: { p: 102.70, d: 94.76 }, uttarakhand: { p: 95.42, d: 88.11 },
  himachal_pradesh: { p: 97.50, d: 85.60 }, jammu_and_kashmir: { p: 97.77, d: 88.70 },
  puducherry: { p: 98.30, d: 90.50 }, manipur: { p: 99.49, d: 90.71 },
  meghalaya: { p: 97.53, d: 88.14 }, tripura: { p: 97.13, d: 88.07 },
  mizoram: { p: 101.18, d: 91.47 }, nagaland: { p: 99.00, d: 88.60 },
  arunachal_pradesh: { p: 97.43, d: 84.12 }, sikkim: { p: 102.50, d: 89.60 },
  ladakh: { p: 100.30, d: 88.70 },
};

function regionToKey(region = '') {
  if (REGION_TO_KEY[region]) return REGION_TO_KEY[region];
  // Fuzzy fallback
  const lower = region.toLowerCase();
  const match = Object.entries(REGION_TO_KEY).find(([k]) =>
    k.toLowerCase() === lower ||
    lower.includes(k.toLowerCase()) ||
    k.toLowerCase().includes(lower)
  );
  return match ? match[1] : 'delhi';
}

async function fromSupabase(stateKey) {
  try {
    const { data, error } = await supabase
      .from('market_data')
      .select('key, price, updated_at')
      .in('key', [`petrol_${stateKey}`, `diesel_${stateKey}`]);

    if (error || !data?.length) return null;

    const p = data.find(r => r.key === `petrol_${stateKey}`);
    const d = data.find(r => r.key === `diesel_${stateKey}`);
    if (!p?.price) return null;

    return { petrol: p.price, diesel: d?.price ?? null, updatedAt: p.updated_at, source: 'live' };
  } catch { return null; }
}

async function fromAPIFunction(city, region) {
  try {
    const url = `/api/fuel?city=${encodeURIComponent(city)}&state=${encodeURIComponent(region)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = await res.json();
    if (j?.petrol > 50) return { petrol: j.petrol, diesel: j.diesel, source: j.source || 'live' };
  } catch {}
  return null;
}

export function useFuel() {
  const { city, region } = useLocation();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!region && !city) return;
    let mounted = true;

    async function load() {
      const stateKey = regionToKey(region);
      const ref = REF[stateKey] ?? REF.delhi;

      // Step 1: Show reference prices immediately (no blank state)
      if (mounted) {
        setData({ petrol: ref.p, diesel: ref.d, city: city || stateKey.replace(/_/g, ' '), source: 'reference' });
        setLoading(false);
      }

      // Step 2: Try Supabase (pipeline keeps this updated every 6 hours)
      const dbResult = await fromSupabase(stateKey);
      if (dbResult && mounted) {
        setData({ ...dbResult, city: city || stateKey.replace(/_/g, ' ') });
        return;
      }

      // Step 3: Try Vercel API function (real-time HPCL/IOC fetch)
      const apiResult = await fromAPIFunction(city || '', region || '');
      if (apiResult && mounted) {
        setData({ ...apiResult, city: city || stateKey.replace(/_/g, ' ') });
      }
      // If both fail, reference prices from step 1 remain shown
    }

    load();
    return () => { mounted = false; };
  }, [city, region]);

  return { data, loading };
}
