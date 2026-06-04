// Market data — free APIs, no keys required.
// Cache: 10 min sessionStorage. Each source fails independently → shows "—".

const CACHE_KEY = 'ns_markets_v5';
const CACHE_TTL = 10 * 60 * 1000;

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

async function safeJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text')) return null; // skip HTML error pages
    return await res.json();
  } catch { return null; }
}

// Try Yahoo Finance through two different CORS proxies in sequence.
// codetabs.com → allorigins.win → return null
async function yahooChart(symbol) {
  const yUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

  // Proxy 1: codetabs.com
  let json = await safeJson(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(yUrl)}`);

  // Proxy 2: allorigins (fallback)
  if (!json?.chart?.result) {
    json = await safeJson(`https://api.allorigins.win/raw?url=${encodeURIComponent(yUrl)}`);
  }

  const m = json?.chart?.result?.[0]?.meta;
  if (!m?.regularMarketPrice) return null;
  return { price: m.regularMarketPrice, change: m.regularMarketChangePercent ?? 0 };
}

// Single CoinGecko call: BTC, ETH, Gold (PAXG) in INR + USD.
// USD/INR = BTC_INR ÷ BTC_USD  (arbitrage-accurate to <0.1%)
async function getCoinGeckoAll() {
  const json = await safeJson(
    'https://api.coingecko.com/api/v3/simple/price' +
    '?ids=bitcoin,ethereum,pax-gold' +
    '&vs_currencies=inr,usd' +
    '&include_24hr_change=true'
  );
  if (!json) return null;
  const btcInr = json.bitcoin?.inr;
  const btcUsd = json.bitcoin?.usd;
  return {
    usdInr:  (btcInr && btcUsd) ? btcInr / btcUsd : null,
    goldUsd: json['pax-gold']?.usd ?? null,
    btc: { price: btcInr, change: json.bitcoin?.inr_24h_change },
    eth: { price: json.ethereum?.inr, change: json.ethereum?.inr_24h_change },
  };
}

export async function fetchAllMarkets() {
  const cached = readCache();
  if (cached) return cached;

  const [cgR, sensexR, niftyR, silverR] = await Promise.allSettled([
    getCoinGeckoAll(),
    yahooChart('^BSESN'),
    yahooChart('^NSEI'),
    yahooChart('SI=F'),
  ]);

  const cg     = cgR.status     === 'fulfilled' ? cgR.value     : null;
  const sensex = sensexR.status === 'fulfilled' ? sensexR.value : null;
  const nifty  = niftyR.status  === 'fulfilled' ? niftyR.value  : null;
  const silver_chart = silverR.status === 'fulfilled' ? silverR.value : null;

  const usdInr = cg?.usdInr ?? null;

  // Gold: PAXG (USD/troy oz) × USD/INR × 1.15 (import duty+GST) ÷ 31.1035 g × 10g
  let gold24k = null, gold22k = null, silver = null;
  if (usdInr && cg?.goldUsd) {
    const perGram = (cg.goldUsd * usdInr * 1.15) / 31.1035;
    gold24k = Math.round(perGram * 10);
    gold22k = Math.round(perGram * (22 / 24) * 10);
  }
  if (usdInr && silver_chart?.price) {
    silver = Math.round((silver_chart.price * usdInr * 1.03) / 31.1035 * 1000);
  }

  const data = {
    usdInr, gold24k, gold22k, silver, sensex, nifty,
    btc: cg?.btc ?? null,
    eth: cg?.eth ?? null,
    ts: Date.now(),
  };

  writeCache(data);
  return data;
}
