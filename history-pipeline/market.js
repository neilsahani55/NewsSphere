/**
 * Market data pipeline — fetches Sensex, Nifty 50, and Silver spot price
 * server-side (no CORS restrictions) and stores in Supabase market_data table.
 *
 * Run once in Supabase SQL Editor before first deployment:
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
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsSphere-Market/1.0)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status} for ${symbol}`);
  const json = await res.json();
  const m = json?.chart?.result?.[0]?.meta;
  if (!m?.regularMarketPrice) throw new Error(`No price for ${symbol}`);
  return { price: m.regularMarketPrice, change: m.regularMarketChangePercent ?? 0 };
}

async function main() {
  console.log('=== Market pipeline ===');

  const results = await Promise.allSettled([
    yahooQuote('^BSESN').then(d => ({ key: 'sensex', ...d })),
    yahooQuote('^NSEI').then(d  => ({ key: 'nifty',  ...d })),
    yahooQuote('SI=F').then(d   => ({ key: 'silver', ...d })),
  ]);

  results.forEach((r, i) => {
    const label = ['^BSESN', '^NSEI', 'SI=F'][i];
    if (r.status === 'fulfilled') {
      console.log(`  ✓ ${label}: ${r.value.price} (${r.value.change?.toFixed(2)}%)`);
    } else {
      console.warn(`  ✗ ${label}: ${r.reason?.message}`);
    }
  });

  const rows = results
    .filter(r => r.status === 'fulfilled')
    .map(r => ({
      key:        r.value.key,
      price:      r.value.price,
      change_pct: r.value.change,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) { console.warn('Nothing to store.'); return; }

  const { error } = await supabase
    .from('market_data')
    .upsert(rows, { onConflict: 'key' });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  console.log(`Stored ${rows.length} row(s): ${rows.map(r => r.key).join(', ')}`);
}

main().catch(err => { console.error(err); process.exit(1); });
