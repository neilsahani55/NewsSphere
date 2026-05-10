// Enrich-first pipeline:
//   Fetch → Deduplicate → AI enrich → Insert (only complete articles)
//
// Nothing goes into Supabase until it has AI-written description, content,
// and key_points. This guarantees the frontend never shows a blank article.

import { fetchAllSources } from './fetchNews.js';
import { enrichBatch } from './enrichWithAI.js';
import { getRecentUrls, insertEnrichedArticles, deleteOldArticles } from './db.js';
import { MAX_NEW_PER_RUN } from './config.js';

async function main() {
  const start = Date.now();
  const pipelineGroup = process.env.PIPELINE_GROUP ? parseInt(process.env.PIPELINE_GROUP) : null;

  console.log('═══════════════════════════════════════════');
  console.log(`  NewsSphere Pipeline v4  (enrich-first)${pipelineGroup ? `  [Group ${pipelineGroup}]` : ''}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════');

  // ── 1. Fetch RSS / API sources for this pipeline group ──────────────
  console.log('\n[1/5] Fetching news sources...');
  const allArticles = await fetchAllSources(pipelineGroup);
  console.log(`      Fetched: ${allArticles.length} articles across all sources`);

  // ── 2. Deduplicate against Supabase (last 7 days) ───────────────────
  console.log('\n[2/5] Deduplicating against Supabase...');
  const existingUrls = await getRecentUrls(7);
  console.log(`      Already in DB: ${existingUrls.size}`);

  const newArticles = allArticles.filter(a => !existingUrls.has(a.article_url));
  console.log(`      New this run:  ${newArticles.length}`);
  if (newArticles.length === 0 && allArticles.length > 0) {
    console.log(`      ℹ All ${allArticles.length} fetched articles are already in DB (enriched=true).`);
    console.log(`      ℹ This is normal — sources haven't published new stories since last run.`);
  }

  if (newArticles.length === 0) {
    console.log('\n  No new articles. Pipeline complete.');
    return summary(start, allArticles.length, 0, 0, 0);
  }

  // ── 3. Limit to MAX_NEW_PER_RUN (keeps runtime under 10 min) ────────
  const toEnrich = newArticles.slice(0, MAX_NEW_PER_RUN);
  console.log(`\n[3/5] Enriching ${toEnrich.length} articles with AI (original content)...`);

  // ── 4. AI enrichment — generates original description + content + key_points
  const enrichedMap = await enrichBatch(toEnrich);
  console.log(`\n      AI succeeded: ${enrichedMap.size}/${toEnrich.length}`);

  // Build final rows: merge RSS metadata with AI-generated content.
  // Merge category: keep the RSS source category + any extra ones the AI detected.
  const enrichedRows = toEnrich
    .filter(a => enrichedMap.has(a.article_url))
    .map(a => {
      const ai = enrichedMap.get(a.article_url);
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
    });

  // ── 5. Insert enriched articles into Supabase ────────────────────────
  console.log(`\n[4/5] Inserting ${enrichedRows.length} enriched articles into Supabase...`);
  const inserted = await insertEnrichedArticles(enrichedRows);
  console.log(`      Inserted: ${inserted}`);

  // ── 6. Clean up articles older than 30 days ──────────────────────────
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
