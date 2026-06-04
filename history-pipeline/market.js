/**
 * Market data pipeline — one batched Yahoo Finance v7 quote call for all symbols.
 * The v7 quote endpoint returns reliable regularMarketChangePercent (unlike v8 chart).
 * Upserts into Supabase market_data: one row per key, old value replaced every run.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

// Fetch all symbols in a single Yahoo Finance v7 quote request.
// v7 quote returns proper regularMarketChangePercent for all asset types.
async function fetchYahooQuotes() {
  const symbols = ['^BSESN', '^NSEI', 'SI=F', 'USDINR=X', 'GC=F', 'BTC-INR', 'ETH-INR'];
  const url =
    'https://query2.finance.yahoo.com/v7/finance/quote' +
    `?symbols=${encodeURIComponent(symbols.join(','))}` +
    '&lang=en-IN&region=IN';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsSphere-Market/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Yahoo v7 HTTP ${res.status}`);
  const json = await res.json();
  const results = json?.quoteResponse?.result ?? [];
  if (!results.length) throw new Error('Empty quoteResponse from Yahoo');

  const map = {};
  for (const q of results) {
    if (!q.symbol || q.regularMarketPrice == null) continue;
    const price = q.regularMarketPrice;

    // Yahoo's regularMarketChangePercent can be 0 outside market hours even when
    // there IS a real day change. Always calculate from previous close directly —
    // this is the standard "day change %" shown on all financial sites.
    const prevClose =
      q.regularMarketPreviousClose ??
      q.previousClose             ??
      q.chartPreviousClose        ??
      null;

    const change =
      prevClose && Math.abs(prevClose) > 0.0001
        ? ((price - prevClose) / prevClose) * 100   // calculated — always accurate
        : (q.regularMarketChangePercent ?? null);    // Yahoo fallback

    map[q.symbol] = { price, change };
    console.log(
      `  ✓ ${q.symbol.padEnd(12)} ${price.toFixed(2)}` +
      (change != null ? `  (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)` : '  (no change data)'),
    );
  }
  return map;
}

async function main() {
  console.log(`=== Market pipeline: ${new Date().toISOString()} ===\n`);

  const quotes = await fetchYahooQuotes();
  const now    = new Date().toISOString();
  const q      = (sym) => quotes[sym];
  const usdInr = q('USDINR=X')?.price ?? null;
  const rows   = [];

  // USD / INR
  if (q('USDINR=X')) {
    rows.push({ key: 'usd_inr', price: q('USDINR=X').price, change_pct: q('USDINR=X').change, updated_at: now });
  }

  // Gold: GC=F (USD/troy oz) → INR/10g (24 K and 22 K)
  const goldUsd = q('GC=F')?.price ?? null;
  if (goldUsd && usdInr) {
    const perGram  = (goldUsd * usdInr * 1.15) / 31.1035;
    const goldChg  = q('GC=F').change;
    rows.push({ key: 'gold24k', price: Math.round(perGram * 10),              change_pct: goldChg, updated_at: now });
    rows.push({ key: 'gold22k', price: Math.round(perGram * (22 / 24) * 10),  change_pct: goldChg, updated_at: now });
  }

  // Silver: SI=F (USD/troy oz) → INR/kg
  const silverUsd = q('SI=F')?.price ?? null;
  if (silverUsd && usdInr) {
    rows.push({ key: 'silver', price: Math.round((silverUsd * usdInr * 1.03) / 31.1035 * 1000), change_pct: q('SI=F').change, updated_at: now });
  }

  // Sensex, Nifty, BTC, ETH
  if (q('^BSESN'))  rows.push({ key: 'sensex',  price: q('^BSESN').price,  change_pct: q('^BSESN').change,  updated_at: now });
  if (q('^NSEI'))   rows.push({ key: 'nifty',   price: q('^NSEI').price,   change_pct: q('^NSEI').change,   updated_at: now });
  if (q('BTC-INR')) rows.push({ key: 'btc_inr', price: q('BTC-INR').price, change_pct: q('BTC-INR').change, updated_at: now });
  if (q('ETH-INR')) rows.push({ key: 'eth_inr', price: q('ETH-INR').price, change_pct: q('ETH-INR').change, updated_at: now });

  console.log(`\nUpserting ${rows.length} rows → ${rows.map(r => r.key).join(', ')}`);
  if (!rows.length) { console.warn('Nothing to store.'); return; }

  // onConflict:'key' → UPDATE existing row (never adds a duplicate)
  const { error } = await supabase
    .from('market_data')
    .upsert(rows, { onConflict: 'key' });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  console.log('Done. Database has exactly one row per key (old values replaced).');
}

main().catch(err => { console.error(err); process.exit(1); });
