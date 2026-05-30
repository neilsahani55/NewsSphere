// Enrich-first pipeline:
//   Fetch → Deduplicate → AI enrich (per-batch insert) → Cleanup
//
// Articles are written to Supabase immediately after each enrichment batch,
// so data is never lost even if the GitHub Actions job is cancelled mid-run.

import { fetchAllSources } from './fetchNews.js';
import { enrichBatch } from './enrichWithAI.js';
import { getRecentUrls, insertEnrichedArticles, deleteOldArticles } from './db.js';
import { MAX_NEW_PER_RUN } from './config.js';

const INDEXNOW_KEY = '4804f77a51214d43b2dc68dd0ada6901';
const SITE_BASE    = 'https://newssphere.tech';

function slugify(title) {
  if (!title) return 'article';
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-')
    .slice(0, 80).replace(/-$/, '');
}

async function pingIndexNow(articles) {
  if (!articles.length) return;
  const urls = articles
    .filter(a => a.id && a.title)
    .map(a => `${SITE_BASE}/news/${slugify(a.title)}-${a.id}`);
  if (!urls.length) return;

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'newssphere.tech',
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_BASE}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });
    console.log(`  ↗ IndexNow ping: ${urls.length} URLs → HTTP ${res.status}`);
  } catch (err) {
    console.warn(`  ↗ IndexNow ping failed: ${err.message}`);
  }
}

function buildRow(a, ai) {
  const mergedCategory = [a.category, ...(ai.categories || [])]
    .flatMap(c => String(c || '').split(',').map(s => s.trim()))
    .filter(Boolean)
    .filter((c, i, arr) => arr.indexOf(c) === i)
    .join(', ');
  return {
    ...a,
    description: ai.description || a.description,
    content:     ai.content,
    key_points:  ai.key_points,
    category:    mergedCategory || a.category,
  };
}

async function main() {
  const start = Date.now();
  const pipelineGroup = process.env.PIPELINE_GROUP ? parseInt(process.env.PIPELINE_GROUP) : null;

  console.log('═══════════════════════════════════════════');
  console.log(`  NewsSphere Pipeline v6  (enrich-first, batch-save, IndexNow)${pipelineGroup ? `  [Group ${pipelineGroup}]` : ''}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════');

  // ── 1. Fetch RSS / API sources ───────────────────────────────────────
  console.log('\n[1/4] Fetching news sources...');
  const allArticles = await fetchAllSources(pipelineGroup);
  console.log(`      Fetched: ${allArticles.length} articles`);

  // ── 2. Deduplicate against Supabase (last 7 days) ────────────────────
  console.log('\n[2/4] Deduplicating against Supabase...');
  const existingUrls = await getRecentUrls(7);
  console.log(`      Already in DB: ${existingUrls.size}`);

  const newArticles = allArticles.filter(a => !existingUrls.has(a.article_url));
  console.log(`      New this run:  ${newArticles.length}`);

  if (newArticles.length === 0) {
    console.log('\n  No new articles. Pipeline complete.');
    return summary(start, allArticles.length, 0, 0, 0);
  }

  // ── 3. Enrich + immediately save each batch ──────────────────────────
  const toEnrich = newArticles.slice(0, MAX_NEW_PER_RUN);
  console.log(`\n[3/4] Enriching ${toEnrich.length} articles with AI (saving each batch on completion)...`);

  let totalInserted = 0;
  const allInserted = []; // collects {id, title} for IndexNow pinging

  const enrichedMap = await enrichBatch(toEnrich, async (chunkMap, chunkArticles) => {
    const rows = chunkArticles
      .filter(a => chunkMap.has(a.article_url))
      .map(a => buildRow(a, chunkMap.get(a.article_url)));

    if (rows.length === 0) return;
    const inserted = await insertEnrichedArticles(rows);
    totalInserted += inserted.length;
    allInserted.push(...inserted);
    console.log(`    ✓ Saved ${inserted.length} to DB (running total: ${totalInserted})`);
  });

  console.log(`\n      AI succeeded: ${enrichedMap.size}/${toEnrich.length}`);
  console.log(`      Total saved:  ${totalInserted}`);

  // ── 4. Ping IndexNow so search engines index new articles immediately ─
  console.log('\n[4/5] Pinging IndexNow...');
  await pingIndexNow(allInserted);

  // ── 5. Clean up articles older than 30 days ──────────────────────────
  console.log('\n[5/5] Deleting articles older than 30 days...');
  const deleted = await deleteOldArticles();
  console.log(`      Deleted: ${deleted}`);

  summary(start, allArticles.length, toEnrich.length, enrichedMap.size, deleted);
}

function summary(start, fetched, attempted, enriched, deleted) {
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const skipped = attempted - enriched;
  console.log('\n═══════════════════════════════════════════');
  console.log('  Pipeline complete');
  console.log(`  Fetched=${fetched} | Attempted=${attempted} | Enriched=${enriched} | Skipped=${skipped} | Deleted=${deleted}`);
  console.log(`  Elapsed: ${elapsed}s`);
  console.log('═══════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n[FATAL]', err.message || err);
  process.exit(1);
});
