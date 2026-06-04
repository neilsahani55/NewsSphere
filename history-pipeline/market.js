/**
 * Market data pipeline — fetches ALL market values server-side (no CORS)
 * and upserts into Supabase market_data. Each key has exactly ONE row;
 * upsert replaces the old value every run.
 *
 * Keys stored: usd_inr, gold24k, gold22k, silver, sensex, nifty, btc_inr, eth_inr
 *
 * Run ONCE in Supabase SQL Editor if you haven't already:
 *
 *   CREATE TABLE IF NOT EXISTS market_data (
 *     key        TEXT PRIMARY KEY,
 *     price      NUMERIC,
 *     change_pct NUMERIC,
 *     updated_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Public read market_data"
 *     ON market_data FOR SELECT TO anon USING (true);
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

async function yahooQuote(symbol) {
  const url =
    `https://query2.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsSphere-Market/1.0)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const m = json?.chart?.result?.[0]?.meta;
  if (!m?.regularMarketPrice) throw new Error('No price in response');
  return { price: m.regularMarketPrice, change: m.regularMarketChangePercent ?? 0 };
}

async function main() {
  const now = new Date().toISOString();
  console.log(`=== Market pipeline: ${now} ===\n`);

  // Fetch all symbols in parallel
  const symbols = {
    usd:    'USDINR=X',   // USD/INR exchange rate
    gold:   'GC=F',       // Gold futures USD/troy oz
    silver: 'SI=F',       // Silver futures USD/troy oz
    sensex: '^BSESN',     // BSE Sensex
    nifty:  '^NSEI',      // Nifty 50
    btc:    'BTC-INR',    // Bitcoin in INR
    eth:    'ETH-INR',    // Ethereum in INR
  };

  const entries = Object.entries(symbols);
  const results = await Promise.allSettled(entries.map(([, sym]) => yahooQuote(sym)));

  const got = {};
  entries.forEach(([key, sym], i) => {
    const r = results[i];
    if (r.status === 'fulfilled') {
      got[key] = r.value;
      console.log(`  ✓ ${sym.padEnd(10)} ${r.value.price.toFixed(2)} (${r.value.change.toFixed(2)}%)`);
    } else {
      console.warn(`  ✗ ${sym.padEnd(10)} ${r.reason?.message}`);
    }
  });

  // Build rows to upsert — each replaces its existing DB row via PRIMARY KEY conflict
  const rows = [];

  if (got.usd) {
    rows.push({ key: 'usd_inr', price: got.usd.price, change_pct: got.usd.change, updated_at: now });
  }

  // Gold: convert USD/troy oz → INR/10g with Indian import duty (~15%) + GST (~3%)
  if (got.gold && got.usd) {
    const perGram = (got.gold.price * got.usd.price * 1.15) / 31.1035;
    rows.push({ key: 'gold24k', price: Math.round(perGram * 10),             change_pct: got.gold.change, updated_at: now });
    rows.push({ key: 'gold22k', price: Math.round(perGram * (22 / 24) * 10), change_pct: got.gold.change, updated_at: now });
  }

  // Silver: convert USD/troy oz → INR/kg with GST (~3%)
  if (got.silver && got.usd) {
    const silverInrKg = Math.round((got.silver.price * got.usd.price * 1.03) / 31.1035 * 1000);
    rows.push({ key: 'silver', price: silverInrKg, change_pct: got.silver.change, updated_at: now });
  }

  if (got.sensex) rows.push({ key: 'sensex', price: got.sensex.price, change_pct: got.sensex.change, updated_at: now });
  if (got.nifty)  rows.push({ key: 'nifty',  price: got.nifty.price,  change_pct: got.nifty.change,  updated_at: now });
  if (got.btc)    rows.push({ key: 'btc_inr', price: got.btc.price,   change_pct: got.btc.change,    updated_at: now });
  if (got.eth)    rows.push({ key: 'eth_inr', price: got.eth.price,   change_pct: got.eth.change,    updated_at: now });

  console.log(`\nUpserting ${rows.length} row(s) → ${rows.map(r => r.key).join(', ')}`);

  if (rows.length === 0) { console.warn('Nothing fetched — skipping DB write.'); return; }

  // onConflict:'key' means: if a row with this key already exists → UPDATE it (not insert)
  const { error } = await supabase
    .from('market_data')
    .upsert(rows, { onConflict: 'key' });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  console.log('Done. Database has exactly one row per key.');
}

main().catch(err => { console.error(err); process.exit(1); });
