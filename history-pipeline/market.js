/**
 * Market data pipeline — most accurate change% possible:
 *
 * Traditional markets (Sensex, Nifty, Gold, Silver, USD/INR):
 *   Yahoo Finance v8 chart API → meta.chartPreviousClose is the
 *   authoritative previous-session close Yahoo itself uses for its own
 *   charts. We calculate: (currentPrice - chartPreviousClose) / chartPreviousClose × 100
 *   This is never 0 when the market has actually moved, regardless of
 *   whether the market is currently open or closed.
 *
 * Crypto (BTC, ETH in INR):
 *   CoinGecko → inr_24h_change — purpose-built, continuously updated,
 *   always accurate for crypto.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

// Yahoo Finance v8 chart — 5-day daily data.
// Returns currentPrice from meta.regularMarketPrice (live or last close)
// and change% calculated from meta.chartPreviousClose (official prev-session close).
async function yahooChartQuote(symbol) {
  const url =
    `https://query2.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsSphere-Market/1.0)' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status} for ${symbol}`);
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) throw new Error(`No price in response for ${symbol}`);

  const price = meta.regularMarketPrice;

  // chartPreviousClose = the official previous-session closing price that
  // Yahoo uses as the baseline for its own chart's %change display.
  // This is ALWAYS accurate regardless of market hours or day-of-week.
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const change = prevClose && Math.abs(prevClose) > 0.0001
    ? ((price - prevClose) / prevClose) * 100
    : null;

  return { price, change };
}

// CoinGecko — inr_24h_change is continuously updated and purpose-built
// for crypto. Far more reliable than Yahoo Finance for BTC/ETH.
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

async function main() {
  console.log(`=== Market pipeline: ${new Date().toISOString()} ===\n`);

  // All requests in parallel
  const [usdR, goldR, silverR, sensexR, niftyR, cryptoR] = await Promise.allSettled([
    yahooChartQuote('USDINR=X'),
    yahooChartQuote('GC=F'),
    yahooChartQuote('SI=F'),
    yahooChartQuote('^BSESN'),
    yahooChartQuote('^NSEI'),
    coingeckoCrypto(),
  ]);

  const label = ['USDINR=X', 'GC=F', 'SI=F', '^BSESN', '^NSEI', 'CoinGecko'];
  [usdR, goldR, silverR, sensexR, niftyR, cryptoR].forEach((r, i) => {
    if (r.status === 'fulfilled') {
      const v = r.value;
      if (label[i] === 'CoinGecko') {
        console.log(`  ✓ BTC-INR       ${v.btc.price}  (${v.btc.change?.toFixed(2)}%)`);
        console.log(`  ✓ ETH-INR       ${v.eth.price}  (${v.eth.change?.toFixed(2)}%)`);
      } else {
        console.log(`  ✓ ${label[i].padEnd(12)} ${v.price.toFixed(2)}  (${v.change != null ? v.change.toFixed(2) + '%' : 'n/a'})`);
      }
    } else {
      console.warn(`  ✗ ${label[i]}:  ${r.reason?.message}`);
    }
  });

  const now    = new Date().toISOString();
  const usd    = usdR.status    === 'fulfilled' ? usdR.value    : null;
  const gold   = goldR.status   === 'fulfilled' ? goldR.value   : null;
  const silver = silverR.status === 'fulfilled' ? silverR.value : null;
  const sensex = sensexR.status === 'fulfilled' ? sensexR.value : null;
  const nifty  = niftyR.status  === 'fulfilled' ? niftyR.value  : null;
  const crypto = cryptoR.status === 'fulfilled' ? cryptoR.value : null;

  const rows = [];

  if (usd) {
    rows.push({ key: 'usd_inr', price: usd.price, change_pct: usd.change, updated_at: now });
  }

  const usdInr = usd?.price ?? null;

  if (gold && usdInr) {
    const perGram = (gold.price * usdInr * 1.15) / 31.1035;
    rows.push({ key: 'gold24k', price: Math.round(perGram * 10),              change_pct: gold.change, updated_at: now });
    rows.push({ key: 'gold22k', price: Math.round(perGram * (22 / 24) * 10), change_pct: gold.change, updated_at: now });
  }

  if (silver && usdInr) {
    rows.push({
      key: 'silver',
      price: Math.round((silver.price * usdInr * 1.03) / 31.1035 * 1000),
      change_pct: silver.change,
      updated_at: now,
    });
  }

  if (sensex) rows.push({ key: 'sensex',  price: sensex.price, change_pct: sensex.change, updated_at: now });
  if (nifty)  rows.push({ key: 'nifty',   price: nifty.price,  change_pct: nifty.change,  updated_at: now });

  if (crypto?.btc?.price) rows.push({ key: 'btc_inr', price: crypto.btc.price, change_pct: crypto.btc.change, updated_at: now });
  if (crypto?.eth?.price) rows.push({ key: 'eth_inr', price: crypto.eth.price, change_pct: crypto.eth.change, updated_at: now });

  console.log(`\nUpserting ${rows.length} rows → ${rows.map(r => r.key).join(', ')}`);
  if (!rows.length) { console.warn('Nothing to store.'); return; }

  const { error } = await supabase
    .from('market_data')
    .upsert(rows, { onConflict: 'key' });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  console.log('Done. Each key has exactly one row (old values replaced).');
}

main().catch(err => { console.error(err); process.exit(1); });
