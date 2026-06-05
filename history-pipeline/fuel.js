/**
 * Fuel price pipeline — triggers the Vercel /api/fuel function which:
 *   1. Scrapes goodreturns.in petrol / diesel / cng state tables
 *   2. Upserts all 36 states into Supabase market_data
 *   3. Returns the complete dataset as JSON
 *
 * The pipeline is intentionally thin — all scraping + storage logic lives
 * in api/fuel.js (Vercel serverless).  This script just calls that endpoint
 * so GitHub Actions keeps Supabase fresh even when no user visits the site.
 *
 * Runs every 6 hours via .github/workflows/fuel.yml
 */

const SITE = process.env.SITE_URL || 'https://newssphere.tech';

async function main() {
  const url = `${SITE}/api/fuel`;
  console.log(`=== Fuel pipeline: ${new Date().toISOString()} ===`);
  console.log(`Calling ${url} ...\n`);

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);

  const data = await res.json();
  const states = Object.keys(data).filter(k => !k.startsWith('_'));

  console.log(`Source : ${data._source}`);
  console.log(`Updated: ${data._updated}`);
  console.log(`States : ${states.length}\n`);

  // Print a sample for quick verification
  for (const key of ['maharashtra', 'delhi', 'karnataka', 'gujarat', 'telangana', 'tamil_nadu']) {
    const s = data[key];
    if (s) console.log(`  ${key.padEnd(22)} petrol=₹${s.petrol}  diesel=₹${s.diesel}${s.cng ? `  cng=₹${s.cng}` : ''}`);
  }

  console.log('\nDone. Supabase updated by the Vercel function.');
}

main().catch(err => { console.error(err); process.exit(1); });
