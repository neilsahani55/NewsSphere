// Market data service — all sources are free with no API keys.
// Each source fails independently; missing data shows "—" in the UI.
// Results cached 10 min in sessionStorage.

const CACHE_KEY = 'ns_markets_v3';
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

async function safeJson(url, opts = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Proxy Yahoo Finance through allorigins.win (server-side fetch, no CORS issues)
async function yahooChart(symbol) {
  const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const json = await safeJson(`https://api.allorigins.win/raw?url=${encodeURIComponent(yUrl)}`);
  const m = json?.chart?.result?.[0]?.meta;
  if (!m?.regularMarketPrice) return null;
  return { price: m.regularMarketPrice, change: m.regularMarketChangePercent ?? 0 };
}

// USD/INR — Frankfurter (ECB data, free, CORS, no key)
async function getForex() {
  const json = await safeJson('https://api.frankfurter.app/latest?from=USD&to=INR');
  return json?.rates?.INR ?? null;
}

// Gold from CoinGecko PAXG (1 PAXG = 1 troy oz of gold, pegged to spot price)
// Silver from Yahoo Finance SI=F futures via allorigins proxy
async function getMetals() {
  const [goldJson, silverChart] = await Promise.all([
    safeJson('https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd'),
    yahooChart('SI=F'),
  ]);
  return {
    goldUsd:   goldJson?.['pax-gold']?.usd ?? null,
    silverUsd: silverChart?.price          ?? null,
  };
}

// Sensex and Nifty 50 from Yahoo Finance via allorigins proxy
async function getIndices() {
  const [s, n] = await Promise.all([
    yahooChart('^BSESN'),
    yahooChart('^NSEI'),
  ]);
  return { sensex: s, nifty: n };
}

// BTC & ETH in INR from CoinGecko (free, CORS, no key)
async function getCrypto() {
  const json = await safeJson(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=inr&include_24hr_change=true'
  );
  if (!json) return null;
  return {
    btc: { price: json.bitcoin?.inr,  change: json.bitcoin?.inr_24h_change  },
    eth: { price: json.ethereum?.inr, change: json.ethereum?.inr_24h_change },
  };
}

export async function fetchAllMarkets() {
  const cached = readCache();
  if (cached) return cached;

  // Fetch all in parallel — each resolves independently on failure
  const [forexR, metalsR, indicesR, cryptoR] = await Promise.allSettled([
    getForex(), getMetals(), getIndices(), getCrypto(),
  ]);

  const usdInr  = forexR.status   === 'fulfilled' ? forexR.value   : null;
  const metals  = metalsR.status  === 'fulfilled' ? metalsR.value  : null;
  const indices = indicesR.status === 'fulfilled' ? indicesR.value : null;
  const crypto  = cryptoR.status  === 'fulfilled' ? cryptoR.value  : null;

  // USD/troy oz → INR/10g. Indian price ≈ international × 1.15 (import duty + GST)
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
    gold24k, gold22k, silver,
    sensex: indices?.sensex ?? null,
    nifty:  indices?.nifty  ?? null,
    btc:    crypto?.btc     ?? null,
    eth:    crypto?.eth     ?? null,
    ts: Date.now(),
  };

  writeCache(data);
  return data;
}
