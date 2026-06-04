import { createClient } from '@supabase/supabase-js';

// Market data service — free APIs, no third-party keys required.
// Sensex / Nifty / Silver: fetched server-side by GitHub Actions every 15 min,
//   stored in Supabase market_data — works on every device and browser (no CORS).
// USD/INR / Gold / BTC / ETH: live from CoinGecko (CORS-enabled, no key).
// Client-side cache: 5 min sessionStorage.

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

const CACHE_KEY = 'ns_markets_v7';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

// Sensex, Nifty 50, Silver — read from Supabase (server-side cached, always works)
async function getIndicesFromDB() {
  try {
    const { data, error } = await supabase
      .from('market_data')
      .select('key, price, change_pct')
      .in('key', ['sensex', 'nifty', 'silver']);
    if (error || !data?.length) return null;
    return Object.fromEntries(data.map(r => [r.key, { price: r.price, change: r.change_pct }]));
  } catch { return null; }
}

// BTC, ETH, Gold (PAXG) in INR + USD — CoinGecko (free, CORS, no key)
// USD/INR is derived: BTC_INR ÷ BTC_USD, accurate to < 0.1% via arbitrage
async function getCoinGeckoAll() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price' +
      '?ids=bitcoin,ethereum,pax-gold' +
      '&vs_currencies=inr,usd' +
      '&include_24hr_change=true',
      { signal: AbortSignal.timeout(7000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const btcInr = json.bitcoin?.inr;
    const btcUsd = json.bitcoin?.usd;
    return {
      usdInr:  (btcInr && btcUsd) ? btcInr / btcUsd : null,
      goldUsd: json['pax-gold']?.usd ?? null,
      btc: { price: btcInr, change: json.bitcoin?.inr_24h_change },
      eth: { price: json.ethereum?.inr, change: json.ethereum?.inr_24h_change },
    };
  } catch { return null; }
}

export async function fetchAllMarkets() {
  const cached = readCache();
  if (cached) return cached;

  // Fetch Supabase indices + CoinGecko in parallel
  const [dbR, cgR] = await Promise.allSettled([
    getIndicesFromDB(),
    getCoinGeckoAll(),
  ]);

  const db = dbR.status === 'fulfilled' ? dbR.value : null;
  const cg = cgR.status === 'fulfilled' ? cgR.value : null;

  const usdInr = cg?.usdInr ?? null;

  // Gold: PAXG (USD/troy oz) × USD/INR × 1.15 (duty) ÷ 31.1035 g × 10g
  let gold24k = null, gold22k = null;
  if (usdInr && cg?.goldUsd) {
    const perGram = (cg.goldUsd * usdInr * 1.15) / 31.1035;
    gold24k = Math.round(perGram * 10);
    gold22k = Math.round(perGram * (22 / 24) * 10);
  }

  // Silver: stored as USD/troy oz in DB, convert to INR/kg
  let silver = null;
  const silverUsd = db?.silver?.price ?? null;
  if (usdInr && silverUsd) {
    silver = Math.round((silverUsd * usdInr * 1.03) / 31.1035 * 1000);
  }

  const data = {
    usdInr,
    gold24k,
    gold22k,
    silver,
    sensex: db?.sensex ?? null,
    nifty:  db?.nifty  ?? null,
    btc:    cg?.btc    ?? null,
    eth:    cg?.eth    ?? null,
    ts: Date.now(),
  };

  writeCache(data);
  return data;
}
