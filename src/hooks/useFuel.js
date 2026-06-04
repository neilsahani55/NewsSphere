/**
 * Live Indian fuel prices — works exactly like useWeather / useAQI:
 *  1. useLocation()  → detected city + state (via ipapi.co, cached)
 *  2. tryLiveAPIs()  → attempt multiple free community endpoints
 *  3. State fallback → if all APIs fail, use known prices for the
 *     detected state (still location-accurate, just not hour-fresh)
 *
 * No pipeline, no Supabase — client-side only, like weather.
 */

import { useEffect, useState } from 'react';
import { useLocation } from './useLocation.js';

// State-level reference prices (INR/litre) — post March 2024 revision.
// Used when live API unavailable. One row per state = the state's capital/metro price.
const STATE_PRICES = {
  'Delhi':             { city: 'Delhi',           p: 94.72,  d: 87.62 },
  'Haryana':           { city: 'Gurugram',         p: 95.03,  d: 87.86 },
  'Uttar Pradesh':     { city: 'Lucknow',          p: 96.57,  d: 89.76 },
  'Punjab':            { city: 'Amritsar',         p: 96.94,  d: 83.67 },
  'Chandigarh':        { city: 'Chandigarh',       p: 94.24,  d: 82.40 },
  'Rajasthan':         { city: 'Jaipur',           p: 104.88, d: 90.36 },
  'Madhya Pradesh':    { city: 'Bhopal',           p: 108.65, d: 93.77 },
  'Chhattisgarh':      { city: 'Raipur',           p: 102.70, d: 94.76 },
  'Gujarat':           { city: 'Ahmedabad',        p: 96.63,  d: 92.38 },
  'Maharashtra':       { city: 'Mumbai',           p: 103.44, d: 89.97 },
  'Goa':               { city: 'Panaji',           p: 96.81,  d: 90.08 },
  'Karnataka':         { city: 'Bengaluru',        p: 102.86, d: 88.94 },
  'Tamil Nadu':        { city: 'Chennai',          p: 100.75, d: 92.34 },
  'Telangana':         { city: 'Hyderabad',        p: 107.41, d: 95.65 },
  'Andhra Pradesh':    { city: 'Visakhapatnam',    p: 109.41, d: 97.21 },
  'Kerala':            { city: 'Kochi',            p: 102.05, d: 90.55 },
  'West Bengal':       { city: 'Kolkata',          p: 103.94, d: 90.56 },
  'Bihar':             { city: 'Patna',            p: 107.24, d: 94.04 },
  'Jharkhand':         { city: 'Ranchi',           p: 99.09,  d: 96.77 },
  'Odisha':            { city: 'Bhubaneswar',      p: 103.19, d: 94.76 },
  'Assam':             { city: 'Guwahati',         p: 96.01,  d: 83.94 },
  'Uttarakhand':       { city: 'Dehradun',         p: 95.42,  d: 88.11 },
  'Himachal Pradesh':  { city: 'Shimla',           p: 97.50,  d: 85.60 },
  'Jammu and Kashmir': { city: 'Srinagar',         p: 97.77,  d: 88.70 },
  'Manipur':           { city: 'Imphal',           p: 99.49,  d: 90.71 },
  'Meghalaya':         { city: 'Shillong',         p: 97.53,  d: 88.14 },
  'Mizoram':           { city: 'Aizawl',           p: 101.18, d: 91.47 },
  'Tripura':           { city: 'Agartala',         p: 97.13,  d: 88.07 },
  'Nagaland':          { city: 'Kohima',           p: 99.00,  d: 88.60 },
};

const INDIA_DEFAULT = { city: 'Delhi', p: 94.72, d: 87.62 };

/**
 * Try multiple free community endpoints for live Indian fuel prices.
 * These are community-maintained APIs — any may go offline at any time.
 * Returns { petrol, diesel } or null if all fail.
 */
async function tryLiveAPIs(city, state) {
  const cityEnc  = encodeURIComponent(city  || '');
  const stateEnc = encodeURIComponent(state || '');

  const candidates = [
    // Community Vercel/Cloudflare Workers APIs (free, CORS-enabled)
    `https://india-fuel-price-api.vercel.app/api/price?city=${cityEnc}&state=${stateEnc}`,
    `https://india-fuel.pages.dev/api?city=${cityEnc}`,
    `https://fuel-price-india.onrender.com/api/price?city=${cityEnc}`,
    // Alternate format
    `https://fuel-prices.api.io/india?city=${cityEnc}&state=${stateEnc}`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const j = await res.json();
      // Accept various response shapes
      const petrol = j?.petrol ?? j?.petrolPrice ?? j?.data?.petrol;
      const diesel = j?.diesel ?? j?.dieselPrice ?? j?.data?.diesel;
      if (petrol && diesel && petrol > 50 && diesel > 50) {
        return { petrol: Number(petrol), diesel: Number(diesel), live: true };
      }
    } catch { /* try next */ }
  }
  return null;
}

export function useFuel() {
  const { city, region } = useLocation();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!region && !city) return; // wait for location
    let mounted = true;

    async function load() {
      // Get the state-matched fallback immediately (location-aware)
      const fallback = STATE_PRICES[region] ?? INDIA_DEFAULT;

      // Race: try live API first (4s window)
      const liveResult = await tryLiveAPIs(city, region);

      if (!mounted) return;

      if (liveResult) {
        setData({
          petrol:    liveResult.petrol,
          diesel:    liveResult.diesel,
          city,
          source:    'live',
        });
      } else {
        // State-matched reference prices (still location-correct)
        setData({
          petrol:    fallback.p,
          diesel:    fallback.d,
          city:      city || fallback.city,
          source:    'reference',
        });
      }
      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [city, region]);

  return { data, loading };
}
