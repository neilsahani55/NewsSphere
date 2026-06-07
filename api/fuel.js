/**
 * /api/fuel  — reads live fuel prices from Supabase.
 *
 * All scraping happens in history-pipeline/fuel.js (GitHub Actions).
 * This function only reads what the pipeline stored — NO static baseline,
 * NO fake values. If the pipeline has not run yet, returns empty {}.
 *
 * CDN cache: 5 min (pipeline updates every 6 hours).
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!sbUrl || !sbKey) {
    return res.status(503).json({ error: 'Supabase not configured', _source: 'error' });
  }

  try {
    const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

    // Fetch all fuel keys from market_data
    const { data, error } = await sb
      .from('market_data')
      .select('key, price, updated_at')
      .or([
        'key.like.petrol_%',
        'key.like.diesel_%',
        'key.like.cng_%',
      ].join(','));

    if (error) throw new Error(error.message);
    if (!data?.length) {
      // Pipeline hasn't run yet — return empty, no fake data
      return res.status(200).json({ _source: 'empty', _updated: null });
    }

    // Build state map from Supabase rows
    const allStates = {};
    let updated = null;

    for (const row of data) {
      const [fuel, ...parts] = row.key.split('_');     // e.g. petrol_maharashtra
      const stateKey = parts.join('_');                // maharashtra
      if (!allStates[stateKey]) allStates[stateKey] = {};
      allStates[stateKey][fuel] = row.price;           // { petrol: 111.18 }
      if (!updated || row.updated_at > updated) updated = row.updated_at;
    }

    // Normalise to { maharashtra: { petrol, diesel, cng } }
    const result = {};
    for (const [state, fuels] of Object.entries(allStates)) {
      if (fuels.petrol || fuels.diesel) {   // only states that have at least one value
        result[state] = {
          petrol: fuels.petrol ?? null,
          diesel: fuels.diesel ?? null,
          cng:    fuels.cng    ?? null,
        };
      }
    }

    console.log(`/api/fuel: ${Object.keys(result).length} states from Supabase, updated=${updated}`);
    return res.status(200).json({ _source: 'pipeline', _updated: updated, ...result });

  } catch (e) {
    console.error('/api/fuel error:', e.message);
    return res.status(500).json({ error: e.message, _source: 'error' });
  }
}
