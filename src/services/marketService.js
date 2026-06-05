import { supabase } from '../lib/supabase.js';

// All market data read from Supabase (populated every 15 min by the pipeline).
// CoinGecko used as fallback only when the DB table is still empty (first run).
// Client cache: 5 min sessionStorage so page refreshes don't re-fetch instantly.

const CACHE_KEY = 'ns_markets_v9';
const CACHE_TTL = 5 * 60 * 1000;

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

// Primary source: read all keys from Supabase including updated_at
async function getAllFromDB() {
  try {
    const { data, error } = await supabase
      .from('market_data')
      .select('key, price, change_pct, updated_at');
    if (error || !data?.length) return null;

    const map = {};
    let latestTs = 0;
    for (const r of data) {
      map[r.key] = { price: r.price, change: r.change_pct };
      const t = r.updated_at ? new Date(r.updated_at).getTime() : 0;
      if (t > latestTs) latestTs = t;
    }
    map._dbUpdatedAt = latestTs || null;
    return map;
  } catch { return null; }
}

// Fallback: CoinGecko for crypto/gold when DB is still empty
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
      usd_inr: usdInr  ? { price: usdInr,  change: null } : null,
      gold24k: gold24k ? { price: gold24k, change: null } : null,
      gold22k: gold22k ? { price: gold22k, change: null } : null,
      btc_inr: { price: btcInr, change: j.bitcoin?.inr_24h_change },
      eth_inr: { price: j.ethereum?.inr, change: j.ethereum?.inr_24h_change },
    };
  } catch { return null; }
}

export async function fetchAllMarkets() {
  const cached = readCache();
  if (cached) return cached;

  // Supabase first; CoinGecko only if Supabase returns nothing (first-run / empty DB)
  const db = await getAllFromDB();
  const cg = db ? null : await getCoinGeckoFallback();

  // Prefer Supabase DB values; fall back to CoinGecko for empty initial state
  const val = (key) => db?.[key] ?? cg?.[key] ?? null;

  const data = {
    usdInr:        val('usd_inr')?.price  ?? null,
    usdInrChange:  val('usd_inr')?.change ?? null,
    gold24k:       val('gold24k')?.price  ?? null,
    gold24kChange: val('gold24k')?.change ?? null,
    gold22k:       val('gold22k')?.price  ?? null,
    gold22kChange: val('gold22k')?.change ?? null,
    silver:        val('silver')?.price   ?? null,
    silverChange:  val('silver')?.change  ?? null,
    sensex: db?.sensex  ? { price: db.sensex.price,  change: db.sensex.change  } : null,
    nifty:  db?.nifty   ? { price: db.nifty.price,   change: db.nifty.change   } : null,
    btc:    val('btc_inr') ? { price: val('btc_inr').price, change: val('btc_inr').change } : null,
    eth:    val('eth_inr') ? { price: val('eth_inr').price, change: val('eth_inr').change } : null,
    dbUpdatedAt: db?._dbUpdatedAt ?? null,
    ts: Date.now(),
  };

  writeCache(data);
  return data;
}
