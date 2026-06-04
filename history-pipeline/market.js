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
}

main().catch(err => { console.error(err); process.exit(1); });
