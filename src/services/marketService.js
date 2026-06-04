// Market data service — fetches forex, metals, indices, crypto in parallel.
// Every source fails independently; missing data shows "—" in the UI.
// Results are cached in sessionStorage for 10 minutes.

const CACHE_KEY = 'ns_markets_v2';
const CACHE_TTL = 10 * 60 * 1000; // 10 min

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

async function safeJson(url, opts = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(7000), ...opts });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// USD/INR — open.er-api.com (free, CORS, no key)
async function getForex() {
  const json = await safeJson('https://open.er-api.com/v6/latest/USD');
  return json?.rates?.INR ?? null;
}

// Gold & Silver spot in USD/troy oz — metals.live (free, no key)
async function getMetals() {
  const json = await safeJson('https://api.metals.live/v1/spot');
  if (!json) return null;
  const d = Array.isArray(json) ? json[0] : json;
  return { goldUsd: d?.gold ?? null, silverUsd: d?.silver ?? null };
}

// Sensex & Nifty — Yahoo Finance v8 chart (free, CORS best-effort)
async function getIndices() {
  const h = { Accept: 'application/json' };
  const [sR, nR] = await Promise.all([
    safeJson('https://query1.finance.yahoo.com/v8/finance/chart/%5EBSESN?interval=1d&range=1d', { headers: h }),
    safeJson('https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=1d', { headers: h }),
  ]);
  const parse = (d) => {
    const m = d?.chart?.result?.[0]?.meta;
    if (!m?.regularMarketPrice) return null;
    return { price: m.regularMarketPrice, change: m.regularMarketChangePercent ?? 0 };
  };
  return { sensex: parse(sR), nifty: parse(nR) };
}

// BTC & ETH in INR — CoinGecko (free, CORS, no key)
async function getCrypto() {
  const json = await safeJson(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=inr&include_24hr_change=true'
  );
  if (!json) return null;
  return {
    btc: { price: json.bitcoin?.inr, change: json.bitcoin?.inr_24h_change },
    eth: { price: json.ethereum?.inr, change: json.ethereum?.inr_24h_change },
  };
}

export async function fetchAllMarkets() {
  const cached = readCache();
  if (cached) return cached;

  const [forexR, metalsR, indicesR, cryptoR] = await Promise.allSettled([
    getForex(), getMetals(), getIndices(), getCrypto(),
  ]);

  const usdInr  = forexR.status   === 'fulfilled' ? forexR.value   : null;
  const metals  = metalsR.status  === 'fulfilled' ? metalsR.value  : null;
  const indices = indicesR.status === 'fulfilled' ? indicesR.value : null;
  const crypto  = cryptoR.status  === 'fulfilled' ? cryptoR.value  : null;

  // USD/troy oz → INR/10g. Indian market price ≈ intl price × ~1.15 (customs + GST).
  let gold24k = null, gold22k = null, silver = null;
  if (usdInr && metals?.goldUsd) {
    const perGram = (metals.goldUsd * usdInr * 1.15) / 31.1035;
    gold24k = Math.round(perGram * 10);
    gold22k = Math.round(perGram * (22 / 24) * 10);
  }
  if (usdInr && metals?.silverUsd) {
    silver = Math.round((metals.silverUsd * usdInr * 1.03) / 31.1035 * 1000); // per kg
  }

  const data = {
    usdInr,
    gold24k,
    gold22k,
    silver,
    sensex: indices?.sensex ?? null,
    nifty:  indices?.nifty  ?? null,
    btc:    crypto?.btc     ?? null,
    eth:    crypto?.eth     ?? null,
    ts: Date.now(),
  };

  writeCache(data);
  return data;
}
