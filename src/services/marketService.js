import { createClient } from '@supabase/supabase-js';

// All market data is read from Supabase market_data table.
// The pipeline (market.js / GitHub Actions) fetches from Yahoo Finance server-side
// every 15 min and upserts — one row per key, always replaced, never duplicated.
// CoinGecko is used as a fallback only when the DB is empty (first deployment).

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

const CACHE_KEY = 'ns_markets_v8';
const CACHE_TTL = 5 * 60 * 1000; // 5 min client-side cache

export function clearMarketCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return Date.now() - ts > CACHE_TTL ? null : data;
  } catch { return null; }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

// Primary: read all 8 keys from Supabase — returns a flat {key: {price, change}} map
async function getAllFromDB() {
  try {
    const { data, error } = await supabase
      .from('market_data')
      .select('key, price, change_pct');
    if (error || !data?.length) return null;
    return Object.fromEntries(data.map(r => [r.key, { price: r.price, change: r.change_pct }]));
  } catch { return null; }
}

// Fallback: CoinGecko for crypto + gold + USD/INR when DB is empty (first run)
async function getCoinGeckoFallback() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price' +
      '?ids=bitcoin,ethereum,pax-gold&vs_currencies=inr,usd&include_24hr_change=true',
      { signal: AbortSignal.timeout(7000) }
    );
    if (!res.ok) return null;
    const j = await res.json();
    const btcInr = j.bitcoin?.inr, btcUsd = j.bitcoin?.usd;
    const usdInr = (btcInr && btcUsd) ? btcInr / btcUsd : null;
    const goldUsd = j['pax-gold']?.usd;
    let gold24k = null, gold22k = null;
    if (usdInr && goldUsd) {
      const pg = (goldUsd * usdInr * 1.15) / 31.1035;
      gold24k = Math.round(pg * 10);
      gold22k = Math.round(pg * (22 / 24) * 10);
    }
    return {
      usd_inr: usdInr ? { price: usdInr, change: null } : null,
      gold24k:  gold24k ? { price: gold24k, change: null } : null,
      gold22k:  gold22k ? { price: gold22k, change: null } : null,
      btc_inr: { price: btcInr, change: j.bitcoin?.inr_24h_change },
      eth_inr: { price: j.ethereum?.inr, change: j.ethereum?.inr_24h_change },
    };
  } catch { return null; }
}

export async function fetchAllMarkets() {
  const cached = readCache();
  if (cached) return cached;

  // Fetch Supabase + CoinGecko fallback in parallel
  const [dbR, cgR] = await Promise.allSettled([getAllFromDB(), getCoinGeckoFallback()]);

  const db = dbR.status === 'fulfilled' ? dbR.value : null;
  const cg = cgR.status === 'fulfilled' ? cgR.value : null;

  // Prefer DB (server-fetched, reliable); fall back to CoinGecko for empty initial state
  const val = (key) => db?.[key] ?? cg?.[key] ?? null;

  const data = {
    usdInr:  val('usd_inr')?.price ?? null,
    gold24k: val('gold24k')?.price ?? null,
    gold22k: val('gold22k')?.price ?? null,
    silver:  val('silver')?.price  ?? null,
    sensex:  db?.sensex  ? { price: db.sensex.price,  change: db.sensex.change  } : null,
    nifty:   db?.nifty   ? { price: db.nifty.price,   change: db.nifty.change   } : null,
    btc:     val('btc_inr') ? { price: val('btc_inr').price, change: val('btc_inr').change } : null,
    eth:     val('eth_inr') ? { price: val('eth_inr').price, change: val('eth_inr').change } : null,
    ts: Date.now(),
  };

  writeCache(data);
  return data;
}
