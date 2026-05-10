import { fetchAllSources } from './fetchNews.js';
import { enrichBatch } from './enrichWithAI.js';
import {
  getRecentUrls,
  insertArticles,
  getUnenrichedArticles,
  updateEnriched,
  deleteOldArticles,
} from './db.js';
import { ENRICH_BATCH, SCRAPE_TIMEOUT_MS } from './config.js';

// ── Content scraper ────────────────────────────────────────────────────────────

function extractTextFromHTML(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);
}

async function scrapeArticle(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsSphereBot/2.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return '';
    const html = await res.text();
    return extractTextFromHTML(html);
  } catch {
    return '';
  }
}

// ── Main pipeline ──────────────────────────────────────────────────────────────

async function main() {
  const start = Date.now();
  console.log('═══════════════════════════════════════');
  console.log('  NewsSphere Pipeline v2');
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════');

  // ── Step 1: Fetch all RSS / API sources ─────────────────────────────
  console.log('\n[1/8] Fetching news sources...');
  const allArticles = await fetchAllSources();
  console.log(`      Total fetched: ${allArticles.length} articles`);

  // ── Step 2: Deduplicate against Supabase ────────────────────────────
  console.log('\n[2/8] Checking for duplicates (last 7 days)...');
  const existingUrls = await getRecentUrls(7);
  console.log(`      ${existingUrls.size} recent articles already in DB`);

  const newArticles = allArticles.filter(a => !existingUrls.has(a.article_url));
  console.log(`      ${newArticles.length} new articles to insert`);

  // ── Step 3: Insert new articles (unenriched) ────────────────────────
  if (newArticles.length > 0) {
    console.log(`\n[3/8] Inserting ${newArticles.length} new articles...`);
    const inserted = await insertArticles(newArticles);
    console.log(`      Inserted: ${inserted}`);
  } else {
    console.log('\n[3/8] No new articles — skipping insert.');
  }

  // ── Step 4: Get unenriched articles to process ──────────────────────
  console.log(`\n[4/8] Loading up to ${ENRICH_BATCH} unenriched articles...`);
  const unenriched = await getUnenrichedArticles(ENRICH_BATCH);
  console.log(`      Found: ${unenriched.length} articles need AI enrichment`);

  if (unenriched.length === 0) {
    console.log('\n  All articles are already enriched. Pipeline complete.');
    return summary(start, allArticles.length, newArticles.length, 0, 0);
  }

  // ── Step 5: Scrape full article content ─────────────────────────────
  console.log(`\n[5/8] Scraping full content for ${unenriched.length} articles...`);
  await Promise.all(
    unenriched.map(async a => {
      a.scraped_content = await scrapeArticle(a.article_url);
    }),
  );
  const scraped = unenriched.filter(a => (a.scraped_content || '').length > 150).length;
  console.log(`      Scraped successfully: ${scraped}/${unenriched.length}`);

  // ── Step 6: AI enrichment ────────────────────────────────────────────
  console.log(`\n[6/8] Enriching ${unenriched.length} articles with AI...`);
  const enriched = await enrichBatch(unenriched);
  console.log(`      AI succeeded: ${enriched.size}/${unenriched.length}`);

  // ── Step 7: Save enriched data to Supabase ──────────────────────────
  console.log(`\n[7/8] Saving ${enriched.size} enriched articles to Supabase...`);
  let saved = 0;
  for (const [url, data] of enriched) {
    const article = unenriched.find(a => a.article_url === url);
    await updateEnriched(url, data, article?.category || '');
    saved++;
  }
  console.log(`      Saved: ${saved}`);

  // ── Step 8: Clean up old articles ───────────────────────────────────
  console.log('\n[8/8] Deleting articles older than 30 days...');
  const deleted = await deleteOldArticles();
  console.log(`      Deleted: ${deleted} old articles`);

  summary(start, allArticles.length, newArticles.length, enriched.size, deleted);
}

function summary(start, fetched, inserted, enriched, deleted) {
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════');
  console.log('  Pipeline complete');
  console.log(`  Fetched=${fetched} | New=${inserted} | Enriched=${enriched} | Deleted=${deleted}`);
  console.log(`  Elapsed: ${elapsed}s`);
  console.log('═══════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n[FATAL] Pipeline error:', err.message || err);
  process.exit(1);
});
