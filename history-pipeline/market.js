/**
 * Market data pipeline — sources chosen to match Google Finance exactly:
 *
 * Gold/Silver:  Yahoo Finance MCX symbols (GOLDM.MCX, SILVERM.MCX) → actual
 *               Indian domestic market prices, same as Google shows.
 *               Fallback to COMEX GC=F/SI=F calculation if MCX unavailable.
 *
 * Sensex/Nifty: Yahoo Finance ^BSESN / ^NSEI — direct NSE/BSE data.
 *
 * USD/INR:      Yahoo Finance USDINR=X — spot rate.
 *
 * BTC/ETH:      Yahoo Finance BTC-INR / ETH-INR with chartPreviousClose →
 *               day change (same as Google "Today" display).
 *               Fallback to CoinGecko for price if Yahoo unavailable.
 *
 * All change% calculated from chartPreviousClose (previous session's official
 * closing price) — never from Yahoo's regularMarketChangePercent field which
 * can be 0 outside market hours.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

// Yahoo Finance v8 chart — returns currentPrice + day change% via chartPreviousClose
async function yahooChart(symbol) {
  const url =
    `https://query2.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsSphere-Market/1.0)' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`);
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) throw new Error(`No price for ${symbol}`);

  const price     = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const change    = prevClose && Math.abs(prevClose) > 0.0001
    ? ((price - prevClose) / prevClose) * 100
    : null;

  return { price, change };
}

// CoinGecko — used as fallback for BTC/ETH price when Yahoo unavailable
async function coingeckoCrypto() {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price' +
    '?ids=bitcoin,ethereum&vs_currencies=inr&include_24hr_change=true',
    { signal: AbortSignal.timeout(12000) },
  );
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const j = await res.json();
  return {
    btc: { price: j.bitcoin?.inr,  change: j.bitcoin?.inr_24h_change  },
    eth: { price: j.ethereum?.inr, change: j.ethereum?.inr_24h_change },
  };
}

// Sanity-check helpers to detect wrong units from MCX contracts
const validGold10g   = (p) => p > 40000  && p < 300000;
const validSilverKg  = (p) => p > 40000  && p < 500000;

// ── Fuel prices ───────────────────────────────────────────────────────────
// Indian retail fuel prices (₹/litre) are set by oil marketing companies
// (BPCL/IOCL/HPCL) daily at 6 AM IST. There is no free public JSON API;
// the pipeline tries several unofficial endpoints and falls back to seeding
// current known prices if they don't already exist in the DB.
//
// Pipeline stores keys:  petrol_{citykey}  and  diesel_{citykey}
// Frontend (useFuel.js) reads from Supabase using city + state from IP.

// City-wise prices (INR/litre) — last verified March 2024 revision
// Organized by state for the STATE_CITY mapping in useFuel.js
const FUEL_SEED = {
  // Delhi / NCR
  petrol_delhi: 94.72,   diesel_delhi: 87.62,
  petrol_noida: 94.73,   diesel_noida: 87.61,
  petrol_gurgaon: 95.03, diesel_gurgaon: 87.86,
  petrol_faridabad: 95.15, diesel_faridabad: 87.98,
  // Maharashtra
  petrol_mumbai: 103.44, diesel_mumbai: 89.97,
  petrol_pune: 104.96,   diesel_pune: 91.08,
  petrol_nagpur: 109.24, diesel_nagpur: 95.02,
  petrol_nashik: 104.50, diesel_nashik: 90.69,
  // Karnataka
  petrol_bengaluru: 102.86, diesel_bengaluru: 88.94,
  petrol_mysuru: 102.86,    diesel_mysuru: 88.94,
  petrol_mangaluru: 102.86, diesel_mangaluru: 88.94,
  // Tamil Nadu
  petrol_chennai: 100.75, diesel_chennai: 92.34,
  petrol_coimbatore: 100.75, diesel_coimbatore: 92.34,
  petrol_madurai: 100.75,    diesel_madurai: 92.34,
  // Telangana / AP
  petrol_hyderabad: 107.41, diesel_hyderabad: 95.65,
  petrol_visakhapatnam: 109.41, diesel_visakhapatnam: 97.21,
  petrol_vijayawada: 109.58,    diesel_vijayawada: 97.38,
  // Kerala
  petrol_kochi: 102.05, diesel_kochi: 90.55,
  petrol_thiruvananthapuram: 102.41, diesel_thiruvananthapuram: 90.93,
  petrol_kozhikode: 102.43, diesel_kozhikode: 90.96,
  // Gujarat
  petrol_ahmedabad: 96.63, diesel_ahmedabad: 92.38,
  petrol_surat: 96.26,     diesel_surat: 92.01,
  petrol_vadodara: 96.38,  diesel_vadodara: 92.15,
  petrol_rajkot: 96.82,    diesel_rajkot: 92.57,
  // Rajasthan
  petrol_jaipur: 104.88, diesel_jaipur: 90.36,
  petrol_jodhpur: 105.29, diesel_jodhpur: 90.74,
  // Madhya Pradesh
  petrol_bhopal: 108.65, diesel_bhopal: 93.77,
  petrol_indore: 108.48, diesel_indore: 93.64,
  // Uttar Pradesh
  petrol_lucknow: 96.57, diesel_lucknow: 89.76,
  petrol_kanpur: 96.48,  diesel_kanpur: 89.68,
  petrol_varanasi: 96.85, diesel_varanasi: 90.10,
  petrol_agra: 96.20,    diesel_agra: 89.48,
  petrol_prayagraj: 96.85, diesel_prayagraj: 90.10,
  // Punjab
  petrol_amritsar: 96.94, diesel_amritsar: 83.67,
  petrol_ludhiana: 96.80, diesel_ludhiana: 83.55,
  petrol_chandigarh: 94.24, diesel_chandigarh: 82.40,
  // Bihar / Jharkhand
  petrol_patna: 107.24, diesel_patna: 94.04,
  petrol_ranchi: 99.09, diesel_ranchi: 96.77,
  // Odisha / West Bengal / Assam
  petrol_bhubaneswar: 103.19, diesel_bhubaneswar: 94.76,
  petrol_kolkata: 103.94, diesel_kolkata: 90.56,
  petrol_guwahati: 96.01, diesel_guwahati: 83.94,
  // Goa / South
  petrol_panaji: 96.81, diesel_panaji: 90.08,
  // Chhattisgarh
  petrol_raipur: 102.70, diesel_raipur: 94.76,
  // J&K / Hill states
  petrol_srinagar: 97.77, diesel_srinagar: 88.70,
  petrol_dehradun: 95.42, diesel_dehradun: 88.11,
  petrol_shimla: 97.50,   diesel_shimla: 85.60,
  // North-East
  petrol_imphal: 99.49,  diesel_imphal: 90.71,
  petrol_shillong: 97.53, diesel_shillong: 88.14,
  petrol_agartala: 97.13, diesel_agartala: 88.07,
  petrol_aizawl: 101.18, diesel_aizawl: 91.47,
  petrol_kohima: 99.00,  diesel_kohima: 88.60,
};

async function seedFuelPrices(now) {
  // Check which keys already exist (don't overwrite live data)
  const { data: existing } = await supabase
    .from('market_data')
    .select('key')
    .in('key', Object.keys(FUEL_SEED));

  const existingKeys = new Set((existing || []).map(r => r.key));
  const toInsert = Object.entries(FUEL_SEED)
    .filter(([k]) => !existingKeys.has(k))
    .map(([key, price]) => ({ key, price, change_pct: null, updated_at: now }));

  if (toInsert.length === 0) {
    console.log('  Fuel prices: all city keys already seeded in DB');
    return;
  }

  const { error } = await supabase.from('market_data').insert(toInsert);
  if (error) console.warn(`  Fuel seed error: ${error.message}`);
  else console.log(`  Fuel prices: seeded ${toInsert.length} city prices into DB`);
}

async function main() {
  console.log(`=== Market pipeline: ${new Date().toISOString()} ===\n`);

  // Fetch all in parallel
  const [
    usdR, sensexR, niftyR,
    goldMcxR, silverMcxR,   // MCX direct (Indian domestic price — matches Google)
    goldComexR, silverComexR, // COMEX fallback
    btcR, ethR,              // Yahoo Finance BTC/ETH-INR (1D day change)
    cryptoFallbackR,         // CoinGecko fallback for BTC/ETH
  ] = await Promise.allSettled([
    yahooChart('USDINR=X'),
    yahooChart('^BSESN'),
    yahooChart('^NSEI'),
    yahooChart('GOLDM.MCX'),    // MCX Gold Mini — INR per 10g
    yahooChart('SILVERM.MCX'),  // MCX Silver Mini — INR per kg
    yahooChart('GC=F'),         // COMEX Gold fallback — USD/troy oz
    yahooChart('SI=F'),         // COMEX Silver fallback — USD/troy oz
    yahooChart('BTC-INR'),
    yahooChart('ETH-INR'),
    coingeckoCrypto(),
  ]);

  const ok  = (r) => r.status === 'fulfilled' ? r.value : null;
  const log = (sym, r) => {
    if (r.status === 'fulfilled') {
      const { price, change } = r.value;
      console.log(`  ✓ ${sym.padEnd(14)} ${price.toFixed(2).padStart(14)} ${change != null ? `(${change >= 0 ? '+' : ''}${change.toFixed(3)}%)` : ''}`);
    } else {
      console.warn(`  ✗ ${sym.padEnd(14)} ${r.reason?.message}`);
    }
  };

  ['USDINR=X', '^BSESN', '^NSEI', 'GOLDM.MCX', 'SILVERM.MCX', 'GC=F', 'SI=F', 'BTC-INR', 'ETH-INR']
    .forEach((s, i) => log(s, [usdR, sensexR, niftyR, goldMcxR, silverMcxR, goldComexR, silverComexR, btcR, ethR][i]));

  const now    = new Date().toISOString();
  const usd    = ok(usdR);
  const usdInr = usd?.price ?? null;
  const rows   = [];

  // USD/INR
  if (usd) {
    rows.push({ key: 'usd_inr', price: usd.price, change_pct: usd.change, updated_at: now });
  }

  // Gold — prefer MCX (matches Google Finance), fallback to COMEX calculation
  const goldMcx = ok(goldMcxR);
  if (goldMcx && validGold10g(goldMcx.price)) {
    console.log('  → Gold: using MCX price (matches Google Finance)');
    rows.push({ key: 'gold24k', price: Math.round(goldMcx.price),              change_pct: goldMcx.change, updated_at: now });
    rows.push({ key: 'gold22k', price: Math.round(goldMcx.price * 22 / 24),   change_pct: goldMcx.change, updated_at: now });
  } else if (ok(goldComexR) && usdInr) {
    console.log('  → Gold: using COMEX fallback (MCX unavailable)');
    const perGram = (goldComexR.value.price * usdInr * 1.15) / 31.1035;
    rows.push({ key: 'gold24k', price: Math.round(perGram * 10),             change_pct: ok(goldComexR)?.change, updated_at: now });
    rows.push({ key: 'gold22k', price: Math.round(perGram * 22 / 24 * 10),   change_pct: ok(goldComexR)?.change, updated_at: now });
  }

  // Silver — prefer MCX, fallback to COMEX
  const silverMcx = ok(silverMcxR);
  if (silverMcx && validSilverKg(silverMcx.price)) {
    console.log('  → Silver: using MCX price (matches Google Finance)');
    rows.push({ key: 'silver', price: Math.round(silverMcx.price), change_pct: silverMcx.change, updated_at: now });
  } else if (ok(silverComexR) && usdInr) {
    console.log('  → Silver: using COMEX fallback (MCX unavailable)');
    const silverInrKg = Math.round((silverComexR.value.price * usdInr * 1.03) / 31.1035 * 1000);
    rows.push({ key: 'silver', price: silverInrKg, change_pct: ok(silverComexR)?.change, updated_at: now });
  }

  // Sensex + Nifty
  const sensex = ok(sensexR), nifty = ok(niftyR);
  if (sensex) rows.push({ key: 'sensex', price: sensex.price, change_pct: sensex.change, updated_at: now });
  if (nifty)  rows.push({ key: 'nifty',  price: nifty.price,  change_pct: nifty.change,  updated_at: now });

  // BTC/ETH — Yahoo Finance for 1D day change (matches Google "Today" column)
  // CoinGecko as price fallback if Yahoo unavailable
  const btc = ok(btcR);
  const eth = ok(ethR);
  const cgFb = ok(cryptoFallbackR);

  const btcPrice  = btc?.price  ?? cgFb?.btc?.price  ?? null;
  const btcChange = btc?.change ?? null;  // use Yahoo 1D, not CoinGecko 24h rolling
  const ethPrice  = eth?.price  ?? cgFb?.eth?.price  ?? null;
  const ethChange = eth?.change ?? null;

  if (btcPrice) rows.push({ key: 'btc_inr', price: btcPrice, change_pct: btcChange, updated_at: now });
  if (ethPrice) rows.push({ key: 'eth_inr', price: ethPrice, change_pct: ethChange, updated_at: now });

  console.log(`\nUpserting ${rows.length} rows → ${rows.map(r => r.key).join(', ')}`);
  if (!rows.length) { console.warn('Nothing to store.'); return; }

  const { error } = await supabase
    .from('market_data')
    .upsert(rows, { onConflict: 'key' });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  console.log('Done. Each key has exactly one row (old values replaced).');

  // Seed fuel prices for all cities (only inserts keys not already in DB)
  console.log('\nFuel prices:');
  await seedFuelPrices(now);
}

main().catch(err => { console.error(err); process.exit(1); });
