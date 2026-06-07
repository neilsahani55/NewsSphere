/**
 * Fuel price pipeline — city/district-level prices for India.
 * Stores into Supabase `fuel` table (NOT market_data).
 *
 * Sources:
 *   Primary: indiatoday.in per-city pages (#render_today_price selector)
 *   Fallback: hindustantimes.com state table (fills missing cities)
 *   CNG:     pricekeeda.com (state-level CNG only — not all cities have CNG)
 *
 * City list: ~130 major cities / state capitals across all 36 states+UTs.
 * The pipeline tests each URL — cities with no IndiaToday page are skipped.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { load as $load } from 'cheerio';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── City master list ───────────────────────────────────────────────────────
// All major Indian cities with their state. The pipeline validates each
// against IndiaToday's URL; only successful cities are stored.
const CITIES = [
  // Andaman & Nicobar
  { city: 'Port Blair', state: 'Andaman and Nicobar Islands', cng: false },
  // Andhra Pradesh
  { city: 'Vijayawada', state: 'Andhra Pradesh', cng: true },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh', cng: true },
  { city: 'Tirupati', state: 'Andhra Pradesh', cng: false },
  { city: 'Guntur', state: 'Andhra Pradesh', cng: false },
  { city: 'Nellore', state: 'Andhra Pradesh', cng: false },
  { city: 'Kurnool', state: 'Andhra Pradesh', cng: false },
  // Arunachal Pradesh
  { city: 'Itanagar', state: 'Arunachal Pradesh', cng: false },
  // Assam
  { city: 'Guwahati', state: 'Assam', cng: true },
  { city: 'Dibrugarh', state: 'Assam', cng: false },
  { city: 'Silchar', state: 'Assam', cng: false },
  // Bihar
  { city: 'Patna', state: 'Bihar', cng: true },
  { city: 'Gaya', state: 'Bihar', cng: false },
  { city: 'Muzaffarpur', state: 'Bihar', cng: false },
  { city: 'Bhagalpur', state: 'Bihar', cng: false },
  // Chandigarh
  { city: 'Chandigarh', state: 'Chandigarh', cng: true },
  // Chhattisgarh
  { city: 'Raipur', state: 'Chhattisgarh', cng: true },
  { city: 'Bhilai', state: 'Chhattisgarh', cng: false },
  { city: 'Bilaspur', state: 'Chhattisgarh', cng: false },
  { city: 'Durg', state: 'Chhattisgarh', cng: false },
  // Dadra & NH
  { city: 'Silvassa', state: 'Dadra and Nagar Haveli and Daman and Diu', cng: false },
  // Delhi
  { city: 'New Delhi', state: 'Delhi', cng: true },
  { city: 'Delhi', state: 'Delhi', cng: true },
  // Goa
  { city: 'Panaji', state: 'Goa', cng: false },
  { city: 'Margao', state: 'Goa', cng: false },
  // Gujarat
  { city: 'Ahmedabad', state: 'Gujarat', cng: true },
  { city: 'Surat', state: 'Gujarat', cng: true },
  { city: 'Vadodara', state: 'Gujarat', cng: true },
  { city: 'Rajkot', state: 'Gujarat', cng: true },
  { city: 'Gandhinagar', state: 'Gujarat', cng: true },
  { city: 'Bhavnagar', state: 'Gujarat', cng: false },
  { city: 'Jamnagar', state: 'Gujarat', cng: false },
  { city: 'Anand', state: 'Gujarat', cng: false },
  // Haryana
  { city: 'Gurugram', state: 'Haryana', cng: true },
  { city: 'Faridabad', state: 'Haryana', cng: true },
  { city: 'Ambala', state: 'Haryana', cng: false },
  { city: 'Hisar', state: 'Haryana', cng: false },
  { city: 'Rohtak', state: 'Haryana', cng: false },
  { city: 'Panipat', state: 'Haryana', cng: false },
  // Himachal Pradesh
  { city: 'Shimla', state: 'Himachal Pradesh', cng: false },
  { city: 'Dharamshala', state: 'Himachal Pradesh', cng: false },
  { city: 'Manali', state: 'Himachal Pradesh', cng: false },
  // Jammu & Kashmir
  { city: 'Jammu', state: 'Jammu and Kashmir', cng: false },
  { city: 'Srinagar', state: 'Jammu and Kashmir', cng: false },
  // Jharkhand
  { city: 'Ranchi', state: 'Jharkhand', cng: false },
  { city: 'Jamshedpur', state: 'Jharkhand', cng: false },
  { city: 'Dhanbad', state: 'Jharkhand', cng: false },
  // Karnataka
  { city: 'Bengaluru', state: 'Karnataka', cng: true },
  { city: 'Mysuru', state: 'Karnataka', cng: true },
  { city: 'Mangaluru', state: 'Karnataka', cng: false },
  { city: 'Hubli', state: 'Karnataka', cng: false },
  { city: 'Belagavi', state: 'Karnataka', cng: false },
  { city: 'Kalaburagi', state: 'Karnataka', cng: false },
  { city: 'Ballari', state: 'Karnataka', cng: false },
  // Kerala
  { city: 'Thiruvananthapuram', state: 'Kerala', cng: false },
  { city: 'Kochi', state: 'Kerala', cng: true },
  { city: 'Kozhikode', state: 'Kerala', cng: false },
  { city: 'Thrissur', state: 'Kerala', cng: false },
  { city: 'Kollam', state: 'Kerala', cng: false },
  { city: 'Kannur', state: 'Kerala', cng: false },
  // Ladakh
  { city: 'Leh', state: 'Ladakh', cng: false },
  // Madhya Pradesh
  { city: 'Bhopal', state: 'Madhya Pradesh', cng: true },
  { city: 'Indore', state: 'Madhya Pradesh', cng: true },
  { city: 'Gwalior', state: 'Madhya Pradesh', cng: false },
  { city: 'Jabalpur', state: 'Madhya Pradesh', cng: false },
  { city: 'Ujjain', state: 'Madhya Pradesh', cng: false },
  { city: 'Sagar', state: 'Madhya Pradesh', cng: false },
  // Maharashtra
  { city: 'Mumbai', state: 'Maharashtra', cng: true },
  { city: 'Pune', state: 'Maharashtra', cng: true },
  { city: 'Nagpur', state: 'Maharashtra', cng: true },
  { city: 'Nashik', state: 'Maharashtra', cng: true },
  { city: 'Aurangabad', state: 'Maharashtra', cng: false },
  { city: 'Thane', state: 'Maharashtra', cng: true },
  { city: 'Navi Mumbai', state: 'Maharashtra', cng: true },
  { city: 'Solapur', state: 'Maharashtra', cng: false },
  { city: 'Kolhapur', state: 'Maharashtra', cng: false },
  { city: 'Amravati', state: 'Maharashtra', cng: false },
  // Manipur
  { city: 'Imphal', state: 'Manipur', cng: false },
  // Meghalaya
  { city: 'Shillong', state: 'Meghalaya', cng: false },
  // Mizoram
  { city: 'Aizawl', state: 'Mizoram', cng: false },
  // Nagaland
  { city: 'Kohima', state: 'Nagaland', cng: false },
  { city: 'Dimapur', state: 'Nagaland', cng: false },
  // Odisha
  { city: 'Bhubaneswar', state: 'Odisha', cng: true },
  { city: 'Cuttack', state: 'Odisha', cng: false },
  { city: 'Rourkela', state: 'Odisha', cng: false },
  // Puducherry
  { city: 'Puducherry', state: 'Puducherry', cng: false },
  // Punjab
  { city: 'Amritsar', state: 'Punjab', cng: true },
  { city: 'Ludhiana', state: 'Punjab', cng: true },
  { city: 'Jalandhar', state: 'Punjab', cng: false },
  { city: 'Patiala', state: 'Punjab', cng: false },
  { city: 'Mohali', state: 'Punjab', cng: false },
  // Rajasthan
  { city: 'Jaipur', state: 'Rajasthan', cng: true },
  { city: 'Jodhpur', state: 'Rajasthan', cng: false },
  { city: 'Udaipur', state: 'Rajasthan', cng: false },
  { city: 'Kota', state: 'Rajasthan', cng: false },
  { city: 'Ajmer', state: 'Rajasthan', cng: false },
  { city: 'Bikaner', state: 'Rajasthan', cng: false },
  // Sikkim
  { city: 'Gangtok', state: 'Sikkim', cng: false },
  // Tamil Nadu
  { city: 'Chennai', state: 'Tamil Nadu', cng: true },
  { city: 'Coimbatore', state: 'Tamil Nadu', cng: false },
  { city: 'Madurai', state: 'Tamil Nadu', cng: false },
  { city: 'Trichy', state: 'Tamil Nadu', cng: false },
  { city: 'Salem', state: 'Tamil Nadu', cng: false },
  { city: 'Tirunelveli', state: 'Tamil Nadu', cng: false },
  { city: 'Erode', state: 'Tamil Nadu', cng: false },
  { city: 'Vellore', state: 'Tamil Nadu', cng: false },
  // Telangana
  { city: 'Hyderabad', state: 'Telangana', cng: true },
  { city: 'Warangal', state: 'Telangana', cng: false },
  { city: 'Karimnagar', state: 'Telangana', cng: false },
  { city: 'Nizamabad', state: 'Telangana', cng: false },
  // Tripura
  { city: 'Agartala', state: 'Tripura', cng: false },
  // Uttar Pradesh
  { city: 'Lucknow', state: 'Uttar Pradesh', cng: true },
  { city: 'Kanpur', state: 'Uttar Pradesh', cng: true },
  { city: 'Agra', state: 'Uttar Pradesh', cng: true },
  { city: 'Varanasi', state: 'Uttar Pradesh', cng: true },
  { city: 'Noida', state: 'Uttar Pradesh', cng: true },
  { city: 'Ghaziabad', state: 'Uttar Pradesh', cng: true },
  { city: 'Meerut', state: 'Uttar Pradesh', cng: false },
  { city: 'Allahabad', state: 'Uttar Pradesh', cng: false },
  { city: 'Prayagraj', state: 'Uttar Pradesh', cng: true },
  { city: 'Bareilly', state: 'Uttar Pradesh', cng: false },
  { city: 'Gorakhpur', state: 'Uttar Pradesh', cng: false },
  { city: 'Aligarh', state: 'Uttar Pradesh', cng: false },
  { city: 'Moradabad', state: 'Uttar Pradesh', cng: false },
  { city: 'Mathura', state: 'Uttar Pradesh', cng: true },
  { city: 'Vrindavan', state: 'Uttar Pradesh', cng: false },
  // Uttarakhand
  { city: 'Dehradun', state: 'Uttarakhand', cng: true },
  { city: 'Haridwar', state: 'Uttarakhand', cng: false },
  { city: 'Rishikesh', state: 'Uttarakhand', cng: false },
  { city: 'Roorkee', state: 'Uttarakhand', cng: false },
  // West Bengal
  { city: 'Kolkata', state: 'West Bengal', cng: true },
  { city: 'Howrah', state: 'West Bengal', cng: false },
  { city: 'Siliguri', state: 'West Bengal', cng: false },
  { city: 'Asansol', state: 'West Bengal', cng: false },
  { city: 'Durgapur', state: 'West Bengal', cng: false },
];

// ── Utilities ─────────────────────────────────────────────────────────────

function normalizeKey(input) {
  const key = String(input ?? '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  return ({ pondicherry: 'puducherry', bombay: 'mumbai', bangalore: 'bengaluru' })[key] ?? key;
}

function toDbKey(s) { return s.replace(/\s+/g, '_'); }

async function fetchText(url, timeoutMs = 12_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: 'GET', redirect: 'follow', signal: ctrl.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'accept-language': 'en-IN,en-US;q=0.9,en;q=0.8',
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}

// Retry wrapper
async function fetchSafe(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try { return await fetchText(url); }
    catch (e) {
      if (i === attempts) throw e;
      await sleep(400 * i);
    }
  }
}

// Extract price with multiple fallback selectors
function extractPrice(html) {
  if (!html) return null;
  const doc = $load(html);
  for (const sel of ['#render_today_price', '[id*="today_price"]', '.fuel-price-today', '.today-price']) {
    const txt = doc(sel).first().text().trim();
    const n = parseFloat(txt.replace(/[^0-9.]/g, ''));
    if (isFinite(n) && n > 10 && n < 300) return n;
  }
  // Last resort: first ₹XX.XX in body
  const m = doc('body').text().match(/₹\s*(\d{2,3}\.\d{2})/);
  if (m) { const n = parseFloat(m[1]); if (n > 10 && n < 300) return n; }
  return null;
}

const IT_BASE = 'https://www.indiatoday.in/fuel-price';

async function fetchITPrice(citySlug, fuel) {
  const url = `${IT_BASE}/${fuel}-price-in-${citySlug}-today`;
  try {
    const html = await fetchSafe(url, 2);
    return extractPrice(html);
  } catch { return null; }
}

// Concurrency limiter
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
      await sleep(180);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// ── HindustanTimes fallback ────────────────────────────────────────────────

async function getHTStatePrice(fuel) {
  const url = `https://www.hindustantimes.com/fuel-prices/${fuel}-rates-state-wise`;
  const html = await fetchSafe(url);
  const doc  = $load(html);
  const out  = new Map();

  const target = doc('table').toArray().find(t => {
    const hdrs = doc(t).find('tr').first().find('th,td').toArray()
      .map(c => doc(c).text().trim().toLowerCase());
    return hdrs.includes('state') && hdrs.some(h => h.includes(fuel));
  });

  if (!target) return out;

  doc(target).find('tr').slice(1).toArray().forEach(r => {
    const cols = doc(r).find('td').toArray().map(c => doc(c).text().trim());
    if (cols.length < 2) return;
    const n = parseFloat(cols[1].replace(/[^0-9.]/g, ''));
    if (cols[0] && isFinite(n) && n > 10) out.set(normalizeKey(cols[0]), n);
  });

  return out;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  console.log(`=== Fuel pipeline (city-level): ${now} ===`);
  console.log(`Cities to process: ${CITIES.length}\n`);

  // Fetch petrol + diesel for all cities via IndiaToday
  const concurrency = Number(process.env.UPSTREAM_CONCURRENCY ?? 5);

  console.log(`── Petrol + Diesel (IndiaToday, concurrency=${concurrency}) ──`);
  const results = await mapLimit(CITIES, concurrency, async ({ city, state, cng: hasCng }) => {
    const slug = normalizeKey(city).replace(/\s+/g, '-');
    const sk   = normalizeKey(state);

    const [petrol, diesel, cngVal] = await Promise.all([
      fetchITPrice(slug, 'petrol'),
      fetchITPrice(slug, 'diesel'),
      hasCng ? fetchITPrice(slug, 'cng') : Promise.resolve(null),
    ]);

    if (petrol) {
      console.log(`  ✓ ${city} (${state}): ₹${petrol}p / ₹${diesel ?? '—'}d${cngVal ? ` / ₹${cngVal}cng` : ''}`);
      return { city_key: toDbKey(normalizeKey(city)), city, state, state_key: toDbKey(sk), petrol, diesel, cng: cngVal };
    } else {
      console.log(`  ✗ ${city}: no petrol price found`);
      return null;
    }
  });

  const successful = results.filter(Boolean);
  console.log(`\n✓ ${successful.length}/${CITIES.length} cities fetched from IndiaToday`);

  // Fill state-level gaps from HindustanTimes for cities IndiaToday missed
  const coveredStates = new Set(successful.map(r => r.state_key));
  const missingStates = [...new Set(CITIES.map(c => toDbKey(normalizeKey(c.state))))]
    .filter(s => !coveredStates.has(s));

  if (missingStates.length > 0) {
    console.log(`\n── HindustanTimes fallback for ${missingStates.length} uncovered states ──`);
    const [htPetrol, htDiesel] = await Promise.all([
      getHTStatePrice('petrol'),
      getHTStatePrice('diesel'),
    ]);
    console.log(`  HT petrol: ${htPetrol.size} states | diesel: ${htDiesel.size} states`);

    for (const stateKey of missingStates) {
      const p = htPetrol.get(stateKey.replace(/_/g, ' '));
      const d = htDiesel.get(stateKey.replace(/_/g, ' '));
      if (p) {
        // Use state name as city name for fallback rows
        const cityKey = `${stateKey}_state`;
        successful.push({ city_key: cityKey, city: stateKey.replace(/_/g, ' '), state: stateKey.replace(/_/g, ' '), state_key: stateKey, petrol: p, diesel: d ?? null, cng: null });
        console.log(`  ✓ ${stateKey} (HT state-level): ₹${p}p / ₹${d ?? '—'}d`);
      }
    }
  }

  if (successful.length === 0) {
    console.error('No data — aborting.'); process.exit(1);
  }

  // Upsert into `fuel` table (NOT market_data)
  const rows = successful.map(r => ({ ...r, updated_at: now }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('fuel').upsert(rows.slice(i, i + 100), { onConflict: 'city_key' });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  console.log(`\nUpserted ${rows.length} rows into \`fuel\` table`);
  const mh = successful.find(r => r.city === 'Mumbai');
  const dl = successful.find(r => r.city_key === 'new_delhi' || r.city_key === 'delhi');
  console.log(`Mumbai: ₹${mh?.petrol ?? '—'} | Delhi: ₹${dl?.petrol ?? '—'}`);
}

main().catch(err => { console.error(err); process.exit(1); });
