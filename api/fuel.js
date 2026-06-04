/**
 * /api/fuel?city=Mumbai&state=Maharashtra
 *
 * Vercel serverless function — runs server-side so there are ZERO CORS
 * restrictions when calling HPCL / IOC / other Indian fuel-price sources.
 * The browser calls this same-origin endpoint; no external proxy needed.
 *
 * Sources tried in order:
 *   1. HPCL (Hindustan Petroleum) — official Indian govt oil company
 *   2. IOC  (Indian Oil Corporation) — largest oil company in India
 *   3. Built-in reference table (state-matched, post-Mar 2024 revision)
 *
 * Response: { petrol, diesel, city, state, source, revised }
 * Cache: 1 hour (prices update at 6 AM IST; 1h is more than sufficient)
 */

// State-matched reference prices (INR/litre) — post March 2024 revision
const STATE_REF = {
  'Delhi':             { p: 94.72,  d: 87.62,  city: 'Delhi'          },
  'NCT of Delhi':      { p: 94.72,  d: 87.62,  city: 'Delhi'          },
  'Haryana':           { p: 95.03,  d: 87.86,  city: 'Gurugram'       },
  'Uttar Pradesh':     { p: 96.57,  d: 89.76,  city: 'Lucknow'        },
  'Uttarakhand':       { p: 95.42,  d: 88.11,  city: 'Dehradun'       },
  'Himachal Pradesh':  { p: 97.50,  d: 85.60,  city: 'Shimla'         },
  'Punjab':            { p: 96.94,  d: 83.67,  city: 'Amritsar'       },
  'Chandigarh':        { p: 94.24,  d: 82.40,  city: 'Chandigarh'     },
  'Rajasthan':         { p: 104.88, d: 90.36,  city: 'Jaipur'         },
  'Jammu and Kashmir': { p: 97.77,  d: 88.70,  city: 'Srinagar'       },
  'Jammu & Kashmir':   { p: 97.77,  d: 88.70,  city: 'Srinagar'       },
  'Ladakh':            { p: 100.30, d: 88.70,  city: 'Leh'            },
  'Maharashtra':       { p: 103.44, d: 89.97,  city: 'Mumbai'         },
  'Gujarat':           { p: 96.63,  d: 92.38,  city: 'Ahmedabad'      },
  'Goa':               { p: 96.81,  d: 90.08,  city: 'Panaji'         },
  'Madhya Pradesh':    { p: 108.65, d: 93.77,  city: 'Bhopal'         },
  'Chhattisgarh':      { p: 102.70, d: 94.76,  city: 'Raipur'         },
  'Karnataka':         { p: 102.86, d: 88.94,  city: 'Bengaluru'      },
  'Tamil Nadu':        { p: 100.75, d: 92.34,  city: 'Chennai'        },
  'Telangana':         { p: 107.41, d: 95.65,  city: 'Hyderabad'      },
  'Andhra Pradesh':    { p: 109.41, d: 97.21,  city: 'Visakhapatnam'  },
  'Kerala':            { p: 102.05, d: 90.55,  city: 'Kochi'          },
  'Puducherry':        { p: 98.30,  d: 90.50,  city: 'Puducherry'     },
  'West Bengal':       { p: 103.94, d: 90.56,  city: 'Kolkata'        },
  'Bihar':             { p: 107.24, d: 94.04,  city: 'Patna'          },
  'Jharkhand':         { p: 99.09,  d: 96.77,  city: 'Ranchi'         },
  'Odisha':            { p: 103.19, d: 94.76,  city: 'Bhubaneswar'    },
  'Orissa':            { p: 103.19, d: 94.76,  city: 'Bhubaneswar'    },
  'Assam':             { p: 96.01,  d: 83.94,  city: 'Guwahati'       },
  'Meghalaya':         { p: 97.53,  d: 88.14,  city: 'Shillong'       },
  'Mizoram':           { p: 101.18, d: 91.47,  city: 'Aizawl'         },
  'Tripura':           { p: 97.13,  d: 88.07,  city: 'Agartala'       },
  'Manipur':           { p: 99.49,  d: 90.71,  city: 'Imphal'         },
  'Nagaland':          { p: 99.00,  d: 88.60,  city: 'Kohima'         },
  'Arunachal Pradesh': { p: 97.43,  d: 84.12,  city: 'Itanagar'       },
  'Sikkim':            { p: 102.50, d: 89.60,  city: 'Gangtok'        },
};

const INDIA_DEFAULT = { p: 94.72, d: 87.62, city: 'Delhi' };

function lookupState(state = '') {
  if (STATE_REF[state]) return STATE_REF[state];
  const key = Object.keys(STATE_REF).find(k =>
    k.toLowerCase() === state.toLowerCase() ||
    state.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(state.toLowerCase())
  );
  return key ? STATE_REF[key] : INDIA_DEFAULT;
}

async function tryHPCL(city, state) {
  const targets = [
    'https://www.hindustanpetroleum.com/FetchFuelPrices',
    'https://www.hindustanpetroleum.com/FetchFuelPricesNew',
    'https://www.hindustanpetroleum.com/assets/json/fuelpricesData.json',
  ];

  for (const url of targets) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://www.hindustanpetroleum.com/',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { continue; }

      const rows = Array.isArray(json) ? json : json?.data ?? json?.rates ?? [];
      if (!rows.length) continue;

      const norm = (s = '') => s.toLowerCase().replace(/\s+/g, '');
      const match =
        rows.find(r => norm(r.City ?? r.city ?? '') === norm(city)) ??
        rows.find(r => norm(r.State ?? r.state ?? '').includes(norm(state.split(' ')[0])));

      if (match) {
        const p = parseFloat(match.Petrol ?? match.petrol ?? match.PetrolPrice ?? 0);
        const d = parseFloat(match.Diesel ?? match.diesel ?? match.DieselPrice ?? 0);
        if (p > 50 && p < 200 && d > 50) return { petrol: p, diesel: d, source: 'hpcl' };
      }
    } catch {}
  }
  return null;
}

async function tryIOC(city, state) {
  const targets = [
    `https://iocl.com/Products/GetFuelPrice?stateName=${encodeURIComponent(state)}&cityName=${encodeURIComponent(city)}`,
    `https://iocl.com/Products/GetFuelPriceByCity?city=${encodeURIComponent(city)}`,
  ];

  for (const url of targets) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://iocl.com/',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const p = parseFloat(json?.PetrolPrice ?? json?.petrol ?? json?.petrolPrice ?? 0);
      const d = parseFloat(json?.DieselPrice ?? json?.diesel ?? json?.dieselPrice ?? 0);
      if (p > 50 && p < 200) return { petrol: p, diesel: d, source: 'ioc' };
    } catch {}
  }
  return null;
}

export default async function handler(req, res) {
  // CORS for any origin (frontend may call from localhost in dev)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const city  = (req.query.city  || '').trim() || 'Delhi';
  const state = (req.query.state || '').trim() || 'Delhi';

  // Try live sources in parallel
  const [hpclResult, iocResult] = await Promise.allSettled([
    tryHPCL(city, state),
    tryIOC(city, state),
  ]);

  const live =
    (hpclResult.status === 'fulfilled' && hpclResult.value) ||
    (iocResult.status  === 'fulfilled' && iocResult.value)  ||
    null;

  if (live) {
    return res.status(200).json({
      petrol:  live.petrol,
      diesel:  live.diesel,
      city,
      state,
      source:  live.source,
      revised: new Date().toISOString(),
    });
  }

  // Fallback: state-matched reference prices
  const ref = lookupState(state);
  return res.status(200).json({
    petrol:  ref.p,
    diesel:  ref.d,
    city:    city || ref.city,
    state,
    source:  'reference',
    revised: 'Mar 2024',
  });
}
