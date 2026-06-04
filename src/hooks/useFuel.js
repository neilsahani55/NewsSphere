/**
 * Live Indian fuel prices — same pattern as useWeather / useAQI:
 *  1. useLocation()   → detected city + state/region (ipapi.co, cached)
 *  2. tryHPCL()       → HPCL official fuel-rates JSON via CORS proxy
 *  3. tryIOC()        → IOC official price endpoint via CORS proxy
 *  4. State fallback  → built-in state-matched reference prices
 *
 * No pipeline. No Supabase. Pure client-side like weather.
 */

import { useEffect, useState } from 'react';
import { useLocation } from './useLocation.js';

// ── State → reference prices (INR/litre, last revised Mar 2024) ──────────
// Keyed by the exact string ipapi.co returns as `region`.
const STATE_REF = {
  // North / NCR
  'Delhi':                    { city: 'Delhi',           p: 94.72,  d: 87.62 },
  'NCT of Delhi':             { city: 'Delhi',           p: 94.72,  d: 87.62 },
  'National Capital Territory of Delhi': { city: 'Delhi', p: 94.72, d: 87.62 },
  'Haryana':                  { city: 'Gurugram',        p: 95.03,  d: 87.86 },
  'Uttar Pradesh':            { city: 'Lucknow',         p: 96.57,  d: 89.76 },
  'Uttarakhand':              { city: 'Dehradun',        p: 95.42,  d: 88.11 },
  'Himachal Pradesh':         { city: 'Shimla',          p: 97.50,  d: 85.60 },
  'Punjab':                   { city: 'Amritsar',        p: 96.94,  d: 83.67 },
  'Chandigarh':               { city: 'Chandigarh',      p: 94.24,  d: 82.40 },
  'Rajasthan':                { city: 'Jaipur',          p: 104.88, d: 90.36 },
  'Jammu and Kashmir':        { city: 'Srinagar',        p: 97.77,  d: 88.70 },
  'Jammu & Kashmir':          { city: 'Srinagar',        p: 97.77,  d: 88.70 },
  'Ladakh':                   { city: 'Leh',             p: 100.30, d: 88.70 },
  // West
  'Maharashtra':              { city: 'Mumbai',          p: 103.44, d: 89.97 },
  'Gujarat':                  { city: 'Ahmedabad',       p: 96.63,  d: 92.38 },
  'Goa':                      { city: 'Panaji',          p: 96.81,  d: 90.08 },
  'Madhya Pradesh':           { city: 'Bhopal',          p: 108.65, d: 93.77 },
  'Chhattisgarh':             { city: 'Raipur',          p: 102.70, d: 94.76 },
  // South
  'Karnataka':                { city: 'Bengaluru',       p: 102.86, d: 88.94 },
  'Tamil Nadu':               { city: 'Chennai',         p: 100.75, d: 92.34 },
  'Telangana':                { city: 'Hyderabad',       p: 107.41, d: 95.65 },
  'Andhra Pradesh':           { city: 'Visakhapatnam',   p: 109.41, d: 97.21 },
  'Kerala':                   { city: 'Kochi',           p: 102.05, d: 90.55 },
  'Puducherry':               { city: 'Puducherry',      p: 98.30,  d: 90.50 },
  'Pondicherry':              { city: 'Puducherry',      p: 98.30,  d: 90.50 },
  // East
  'West Bengal':              { city: 'Kolkata',         p: 103.94, d: 90.56 },
  'Bihar':                    { city: 'Patna',           p: 107.24, d: 94.04 },
  'Jharkhand':                { city: 'Ranchi',          p: 99.09,  d: 96.77 },
  'Odisha':                   { city: 'Bhubaneswar',     p: 103.19, d: 94.76 },
  'Orissa':                   { city: 'Bhubaneswar',     p: 103.19, d: 94.76 },
  // North-East
  'Assam':                    { city: 'Guwahati',        p: 96.01,  d: 83.94 },
  'Meghalaya':                { city: 'Shillong',        p: 97.53,  d: 88.14 },
  'Mizoram':                  { city: 'Aizawl',          p: 101.18, d: 91.47 },
  'Tripura':                  { city: 'Agartala',        p: 97.13,  d: 88.07 },
  'Manipur':                  { city: 'Imphal',          p: 99.49,  d: 90.71 },
  'Nagaland':                 { city: 'Kohima',          p: 99.00,  d: 88.60 },
  'Arunachal Pradesh':        { city: 'Itanagar',        p: 97.43,  d: 84.12 },
  'Sikkim':                   { city: 'Gangtok',         p: 102.50, d: 89.60 },
};

const INDIA_DEFAULT = { city: 'Delhi', p: 94.72, d: 87.62 };

/** Find state prices — handles ipapi.co's exact strings + fuzzy fallback. */
function stateLookup(region = '') {
  if (!region) return INDIA_DEFAULT;
  // Exact match
  if (STATE_REF[region]) return STATE_REF[region];
  // Case-insensitive / partial match
  const key = Object.keys(STATE_REF).find(k =>
    k.toLowerCase() === region.toLowerCase() ||
    region.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(region.toLowerCase())
  );
  return key ? STATE_REF[key] : INDIA_DEFAULT;
}

// ── Live fetch helpers ─────────────────────────────────────────────────────

async function safeFetch(url, ms = 5000) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

/**
 * Try HPCL's official fuel-rates JSON through CORS proxies.
 * HPCL (Hindustan Petroleum) publishes city-wise daily fuel rates.
 */
async function tryHPCL(city, state) {
  // Known HPCL endpoints (try multiple URL patterns)
  const hpclUrls = [
    'https://www.hindustanpetroleum.com/assets/json/fuelpricesData.json',
    'https://www.hindustanpetroleum.com/FetchFuelPrices',
    'https://www.hindustanpetroleum.com/price_update',
  ];
  const proxies = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ];

  for (const hUrl of hpclUrls) {
    for (const px of proxies) {
      const json = await safeFetch(px(hUrl));
      if (!json) continue;

      // HPCL response may be an array of {State, City, Petrol, Diesel} objects
      const rows = Array.isArray(json) ? json : json?.data ?? json?.rates ?? null;
      if (!rows) continue;

      // Try to find user's city or state
      const match = rows.find(r => {
        const rCity  = (r.City  || r.city  || '').toLowerCase();
        const rState = (r.State || r.state || '').toLowerCase();
        return rCity  === city.toLowerCase()  ||
               rCity  === state.toLowerCase() ||
               rState === state.toLowerCase() ||
               rState.includes(state.toLowerCase()) ||
               city.toLowerCase().includes(rCity);
      }) ?? rows.find(r =>
        (r.State || r.state || '').toLowerCase().includes(state.toLowerCase())
      );

      if (match) {
        const p = parseFloat(match.Petrol || match.petrol || match.petrolPrice);
        const d = parseFloat(match.Diesel || match.diesel || match.dieselPrice);
        if (p > 50 && d > 50) {
          console.log(`[Fuel] HPCL live: ${city} petrol=₹${p} diesel=₹${d}`);
          return { petrol: p, diesel: d };
        }
      }
    }
  }
  return null;
}

/**
 * Try IOC's official fuel-price endpoint through CORS proxies.
 */
async function tryIOC(city, state) {
  const iocUrls = [
    `https://iocl.com/Products/GetFuelPrice?stateName=${encodeURIComponent(state)}&cityName=${encodeURIComponent(city)}`,
    `https://iocl.com/BuyCIF`,
  ];
  const proxies = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  ];

  for (const iUrl of iocUrls) {
    for (const px of proxies) {
      const json = await safeFetch(px(iUrl));
      if (!json) continue;
      const p = parseFloat(json?.PetrolPrice ?? json?.petrol ?? json?.petrolPrice);
      const d = parseFloat(json?.DieselPrice ?? json?.diesel ?? json?.dieselPrice);
      if (p > 50 && d > 50) {
        console.log(`[Fuel] IOC live: ${city} petrol=₹${p} diesel=₹${d}`);
        return { petrol: p, diesel: d };
      }
    }
  }
  return null;
}

// ── Main hook ──────────────────────────────────────────────────────────────
export function useFuel() {
  const { city, region } = useLocation();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!region && !city) return;
    let mounted = true;

    async function load() {
      // Show reference prices immediately while we try live sources
      const ref = stateLookup(region);
      if (mounted) {
        setData({ petrol: ref.p, diesel: ref.d, city: city || ref.city, source: 'reference' });
        setLoading(false);
      }

      // Try live sources in parallel
      const [hpclResult, iocResult] = await Promise.allSettled([
        tryHPCL(city || '', region || ''),
        tryIOC(city || '', region || ''),
      ]);

      const live =
        (hpclResult.status === 'fulfilled' && hpclResult.value) ||
        (iocResult.status  === 'fulfilled' && iocResult.value)  ||
        null;

      if (live && mounted) {
        setData({ petrol: live.petrol, diesel: live.diesel, city: city || ref.city, source: 'live' });
      }
    }

    load();
    return () => { mounted = false; };
  }, [city, region]);

  return { data, loading };
}
