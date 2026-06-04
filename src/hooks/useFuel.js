/**
 * Live Indian fuel prices.
 * 1. Shows reference prices immediately (location-matched, no blank state).
 * 2. Tries HPCL/IOC live endpoints through multiple CORS proxies in background.
 * 3. If live data arrives, upgrades display and shows 🟢 Live badge.
 *
 * Proxies tried: thingproxy → allorigins/get → codetabs
 * (corsproxy.io excluded — returns 403 for Indian govt domains)
 */

import { useEffect, useState } from 'react';
import { useLocation } from './useLocation.js';

// ── Verified reference prices (INR/litre) — last central revision Mar 2024 ──
// Includes central excise + state VAT + dealer margin for each state capital.
const STATE_REF = {
  // North / NCR
  'Delhi':               { city: 'Delhi',          p: 94.72,  d: 87.62 },
  'NCT of Delhi':        { city: 'Delhi',          p: 94.72,  d: 87.62 },
  'Haryana':             { city: 'Gurugram',       p: 95.03,  d: 87.86 },
  'Uttar Pradesh':       { city: 'Lucknow',        p: 96.57,  d: 89.76 },
  'Uttarakhand':         { city: 'Dehradun',       p: 95.42,  d: 88.11 },
  'Himachal Pradesh':    { city: 'Shimla',         p: 97.50,  d: 85.60 },
  'Punjab':              { city: 'Amritsar',       p: 96.94,  d: 83.67 },
  'Chandigarh':          { city: 'Chandigarh',     p: 94.24,  d: 82.40 },
  'Rajasthan':           { city: 'Jaipur',         p: 104.88, d: 90.36 },
  'Jammu and Kashmir':   { city: 'Srinagar',       p: 97.77,  d: 88.70 },
  'Jammu & Kashmir':     { city: 'Srinagar',       p: 97.77,  d: 88.70 },
  'Ladakh':              { city: 'Leh',            p: 100.30, d: 88.70 },
  // West
  'Maharashtra':         { city: 'Mumbai',         p: 103.44, d: 89.97 },
  'Gujarat':             { city: 'Ahmedabad',      p: 96.63,  d: 92.38 },
  'Goa':                 { city: 'Panaji',         p: 96.81,  d: 90.08 },
  'Madhya Pradesh':      { city: 'Bhopal',         p: 108.65, d: 93.77 },
  'Chhattisgarh':        { city: 'Raipur',         p: 102.70, d: 94.76 },
  // South
  'Karnataka':           { city: 'Bengaluru',      p: 102.86, d: 88.94 },
  'Tamil Nadu':          { city: 'Chennai',        p: 100.75, d: 92.34 },
  'Telangana':           { city: 'Hyderabad',      p: 107.41, d: 95.65 },
  'Andhra Pradesh':      { city: 'Visakhapatnam',  p: 109.41, d: 97.21 },
  'Kerala':              { city: 'Kochi',          p: 102.05, d: 90.55 },
  'Puducherry':          { city: 'Puducherry',     p: 98.30,  d: 90.50 },
  'Pondicherry':         { city: 'Puducherry',     p: 98.30,  d: 90.50 },
  // East
  'West Bengal':         { city: 'Kolkata',        p: 103.94, d: 90.56 },
  'Bihar':               { city: 'Patna',          p: 107.24, d: 94.04 },
  'Jharkhand':           { city: 'Ranchi',         p: 99.09,  d: 96.77 },
  'Odisha':              { city: 'Bhubaneswar',    p: 103.19, d: 94.76 },
  'Orissa':              { city: 'Bhubaneswar',    p: 103.19, d: 94.76 },
  // North-East
  'Assam':               { city: 'Guwahati',       p: 96.01,  d: 83.94 },
  'Meghalaya':           { city: 'Shillong',       p: 97.53,  d: 88.14 },
  'Mizoram':             { city: 'Aizawl',         p: 101.18, d: 91.47 },
  'Tripura':             { city: 'Agartala',       p: 97.13,  d: 88.07 },
  'Manipur':             { city: 'Imphal',         p: 99.49,  d: 90.71 },
  'Nagaland':            { city: 'Kohima',         p: 99.00,  d: 88.60 },
  'Arunachal Pradesh':   { city: 'Itanagar',       p: 97.43,  d: 84.12 },
  'Sikkim':              { city: 'Gangtok',        p: 102.50, d: 89.60 },
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

// ── Live fetch ─────────────────────────────────────────────────────────────

// Try a URL through multiple CORS proxies; return parsed {petrol, diesel} or null.
async function proxyFetch(targetUrl, ms = 6000) {
  const proxies = [
    // thingproxy is more permissive for Indian govt domains than corsproxy.io
    `https://thingproxy.freeboard.io/fetch/${targetUrl}`,
    // allorigins /get returns JSON wrapper {contents, status}
    `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
    // codetabs proxy
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
  ];

  for (const url of proxies) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
      if (!res.ok) continue;

      let text = await res.text();

      // Unwrap allorigins /get JSON envelope
      try {
        const wrapper = JSON.parse(text);
        if (wrapper?.contents) text = wrapper.contents;
      } catch {}

      return text;
    } catch {}
  }
  return null;
}

function parsePrices(text, city, state) {
  if (!text || text.length < 10) return null;

  // ── Try JSON parse ──
  try {
    const json = JSON.parse(text);
    const rows = Array.isArray(json) ? json
      : json?.data ?? json?.rates ?? json?.results ?? json?.prices ?? null;

    if (Array.isArray(rows)) {
      // Find best matching row for user's city or state
      const normalise = (s = '') => s.toLowerCase().replace(/[^a-z]/g, '');
      const match = rows.find(r => {
        const rc = normalise(r.city || r.City || r.CityName || '');
        const rs = normalise(r.state || r.State || r.StateName || '');
        return rc === normalise(city) || rc.includes(normalise(city)) ||
               rs === normalise(state) || rs.includes(normalise(state));
      }) ?? rows.find(r => {
        const rs = normalise(r.state || r.State || r.StateName || '');
        return normalise(state).includes(rs) || rs.includes(normalise(state));
      });

      if (match) {
        const p = parseFloat(match.Petrol ?? match.petrol ?? match.PetrolPrice ?? match.petrolprice);
        const d = parseFloat(match.Diesel ?? match.diesel ?? match.DieselPrice ?? match.dieselprice);
        if (p > 50 && p < 200 && d > 50 && d < 200) return { petrol: p, diesel: d };
      }
    }

    // Flat object with city/state keys
    if (json?.[city]?.petrol || json?.[state]?.petrol) {
      const src = json[city] || json[state];
      const p = parseFloat(src.petrol ?? src.Petrol);
      const d = parseFloat(src.diesel ?? src.Diesel);
      if (p > 50 && d > 50) return { petrol: p, diesel: d };
    }
  } catch {}

  // ── HTML regex fallback ──
  // Look for price-like decimals (XX.XX or XXX.XX) near the city/state name
  const section = (() => {
    const idx = text.toLowerCase().indexOf(city.toLowerCase());
    if (idx >= 0) return text.slice(Math.max(0, idx - 200), idx + 400);
    const idx2 = text.toLowerCase().indexOf(state.toLowerCase().split(' ')[0]);
    return idx2 >= 0 ? text.slice(Math.max(0, idx2 - 200), idx2 + 400) : text.slice(0, 1000);
  })();

  const prices = section.match(/\b(9\d|10[0-9]|11[0-5])\.\d{2}\b/g) ?? [];
  if (prices.length >= 2) {
    const nums = prices.map(Number).filter(n => n > 70);
    if (nums.length >= 2) {
      // Larger is usually petrol, smaller is usually diesel
      const [a, b] = [nums[0], nums[1]];
      return { petrol: Math.max(a, b), diesel: Math.min(a, b) };
    }
  }

  return null;
}

async function tryLivePrice(city, state) {
  // HPCL endpoints — government data source (official)
  const hpclTargets = [
    'https://www.hindustanpetroleum.com/FetchFuelPrices',
    'https://www.hindustanpetroleum.com/FetchFuelPricesNew',
    'https://www.hindustanpetroleum.com/assets/json/fuelpricesData.json',
    'https://www.hindustanpetroleum.com/price_update',
  ];

  // IOC endpoints
  const iocTargets = [
    `https://iocl.com/Products/GetFuelPrice?stateName=${encodeURIComponent(state)}&cityName=${encodeURIComponent(city)}`,
    'https://iocl.com/BuyCIF',
  ];

  const all = [...hpclTargets, ...iocTargets];

  // Try all in parallel — take first successful parse
  const results = await Promise.allSettled(
    all.map(t => proxyFetch(t, 7000))
  );

  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    const prices = parsePrices(r.value, city, state);
    if (prices) {
      console.log(`[Fuel] Live: ${city} petrol=₹${prices.petrol} diesel=₹${prices.diesel}`);
      return prices;
    }
  }
  return null;
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useFuel() {
  const { city, region } = useLocation();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!region && !city) return;
    let mounted = true;

    async function load() {
      // Step 1: show reference prices immediately (no blank state)
      const ref = stateLookup(region);
      if (mounted) {
        setData({ petrol: ref.p, diesel: ref.d, city: city || ref.city, source: 'reference' });
        setLoading(false);
      }

      // Step 2: try live sources in background
      const live = await tryLivePrice(city || ref.city, region || '');
      if (live && mounted) {
        setData({ petrol: live.petrol, diesel: live.diesel, city: city || ref.city, source: 'live' });
      }
    }

    load();
    return () => { mounted = false; };
  }, [city, region]);

  return { data, loading };
}
