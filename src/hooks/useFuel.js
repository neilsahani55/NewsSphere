/**
 * Live Indian fuel prices — calls our own Vercel serverless function (/api/fuel).
 * The function runs server-side with NO CORS restrictions, fetching directly
 * from HPCL and IOC (official Indian oil companies).
 *
 * Flow:
 *  1. Show reference prices immediately (no blank state).
 *  2. Call /api/fuel?city=...&state=... (same-origin, always works).
 *  3. If server got live data → upgrade to 🟢 Live.
 *  4. If server fell back to reference → keep Reference badge.
 */

import { useEffect, useState } from 'react';
import { useLocation } from './useLocation.js';

// Fallback reference prices for when the API itself is unreachable
// (e.g. during local development without a running Vercel dev server).
const STATE_REF = {
  'Delhi':             { city: 'Delhi',          p: 94.72,  d: 87.62 },
  'NCT of Delhi':      { city: 'Delhi',          p: 94.72,  d: 87.62 },
  'Haryana':           { city: 'Gurugram',       p: 95.03,  d: 87.86 },
  'Uttar Pradesh':     { city: 'Lucknow',        p: 96.57,  d: 89.76 },
  'Uttarakhand':       { city: 'Dehradun',       p: 95.42,  d: 88.11 },
  'Himachal Pradesh':  { city: 'Shimla',         p: 97.50,  d: 85.60 },
  'Punjab':            { city: 'Amritsar',       p: 96.94,  d: 83.67 },
  'Chandigarh':        { city: 'Chandigarh',     p: 94.24,  d: 82.40 },
  'Rajasthan':         { city: 'Jaipur',         p: 104.88, d: 90.36 },
  'Jammu and Kashmir': { city: 'Srinagar',       p: 97.77,  d: 88.70 },
  'Jammu & Kashmir':   { city: 'Srinagar',       p: 97.77,  d: 88.70 },
  'Ladakh':            { city: 'Leh',            p: 100.30, d: 88.70 },
  'Maharashtra':       { city: 'Mumbai',         p: 103.44, d: 89.97 },
  'Gujarat':           { city: 'Ahmedabad',      p: 96.63,  d: 92.38 },
  'Goa':               { city: 'Panaji',         p: 96.81,  d: 90.08 },
  'Madhya Pradesh':    { city: 'Bhopal',         p: 108.65, d: 93.77 },
  'Chhattisgarh':      { city: 'Raipur',         p: 102.70, d: 94.76 },
  'Karnataka':         { city: 'Bengaluru',      p: 102.86, d: 88.94 },
  'Tamil Nadu':        { city: 'Chennai',        p: 100.75, d: 92.34 },
  'Telangana':         { city: 'Hyderabad',      p: 107.41, d: 95.65 },
  'Andhra Pradesh':    { city: 'Visakhapatnam',  p: 109.41, d: 97.21 },
  'Kerala':            { city: 'Kochi',          p: 102.05, d: 90.55 },
  'Puducherry':        { city: 'Puducherry',     p: 98.30,  d: 90.50 },
  'West Bengal':       { city: 'Kolkata',        p: 103.94, d: 90.56 },
  'Bihar':             { city: 'Patna',          p: 107.24, d: 94.04 },
  'Jharkhand':         { city: 'Ranchi',         p: 99.09,  d: 96.77 },
  'Odisha':            { city: 'Bhubaneswar',    p: 103.19, d: 94.76 },
  'Orissa':            { city: 'Bhubaneswar',    p: 103.19, d: 94.76 },
  'Assam':             { city: 'Guwahati',       p: 96.01,  d: 83.94 },
  'Meghalaya':         { city: 'Shillong',       p: 97.53,  d: 88.14 },
  'Mizoram':           { city: 'Aizawl',         p: 101.18, d: 91.47 },
  'Tripura':           { city: 'Agartala',       p: 97.13,  d: 88.07 },
  'Manipur':           { city: 'Imphal',         p: 99.49,  d: 90.71 },
  'Nagaland':          { city: 'Kohima',         p: 99.00,  d: 88.60 },
  'Arunachal Pradesh': { city: 'Itanagar',       p: 97.43,  d: 84.12 },
  'Sikkim':            { city: 'Gangtok',        p: 102.50, d: 89.60 },
};

const INDIA_DEFAULT = { city: 'Delhi', p: 94.72, d: 87.62 };

function stateLookup(region = '') {
  if (!region) return INDIA_DEFAULT;
  if (STATE_REF[region]) return STATE_REF[region];
  const key = Object.keys(STATE_REF).find(k =>
    k.toLowerCase() === region.toLowerCase() ||
    region.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(region.toLowerCase())
  );
  return key ? STATE_REF[key] : INDIA_DEFAULT;
}

export function useFuel() {
  const { city, region } = useLocation();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!region && !city) return;
    let mounted = true;

    async function load() {
      // Step 1: Show state-matched reference prices immediately
      const ref = stateLookup(region);
      if (mounted) {
        setData({ petrol: ref.p, diesel: ref.d, city: city || ref.city, source: 'reference' });
        setLoading(false);
      }

      // Step 2: Call our own Vercel API function (server-side, no CORS at all)
      try {
        const url = `/api/fuel?city=${encodeURIComponent(city || ref.city)}&state=${encodeURIComponent(region || '')}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const json = await res.json();
          if (json?.petrol > 50 && mounted) {
            setData({
              petrol: json.petrol,
              diesel: json.diesel,
              city:   json.city || city || ref.city,
              source: json.source || 'reference',
            });
          }
        }
      } catch {
        // API not reachable (e.g. local dev) — reference prices already shown
      }
    }

    load();
    return () => { mounted = false; };
  }, [city, region]);

  return { data, loading };
}
