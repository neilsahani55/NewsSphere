import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, RETENTION_DAYS } from './config.js';

// Service-role bypasses RLS — used only server-side by the pipeline.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// Return article URLs inserted in the last `days` days for deduplication.
export async function getRecentUrls(days = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const urls = new Set();
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('news')
      .select('article_url')
      .eq('enriched', true)   // only count properly-enriched articles as "seen"
      .gte('created_at', cutoff)
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`getRecentUrls: ${error.message}`);
    if (!data.length) break;
    data.forEach(r => urls.add(r.article_url));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return urls;
}

// Insert fully AI-enriched articles. Every row already has content + key_points
// so the frontend never shows an incomplete article.
export async function insertEnrichedArticles(articles) {
  if (!articles.length) return 0;

  const now = new Date().toISOString();
  const rows = articles.map(a => ({
    fetched_at_ist:   now,
    category:         a.category    || '',
    article_url:      a.article_url,
    title:            a.title       || '',
    description:      a.description || '',
    content:          a.content     || '',
    key_points:       a.key_points  || '',
    image_url:        a.image_url   || '',
    published_at_ist: a.published_at || now,
    source_name:      a.source_name || '',
    language:         a.language    || 'en',
    country:          a.country     || '',
    sentiment:        '',
    enriched:         true,   // always true — we only insert complete articles
  }));

  // ignoreDuplicates: false so that any old blank row gets overwritten with
  // the fully-enriched version if the same URL appears again.
  // .select() returns the upserted rows including auto-generated IDs so the
  // caller can build /news/slug-id URLs for IndexNow pinging.
  const { data: inserted, error } = await supabase
    .from('news')
    .upsert(rows, { onConflict: 'article_url', ignoreDuplicates: false })
    .select('id, title, article_url');

  if (error) throw new Error(`insertEnrichedArticles: ${error.message}`);
  return inserted || [];
}

// Delete articles older than RETENTION_DAYS.
export async function deleteOldArticles() {
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error, count } = await supabase
    .from('news')
    .delete({ count: 'exact' })
    .lt('published_at_ist', cutoff);

  if (error) throw new Error(`deleteOldArticles: ${error.message}`);
  return count || 0;
}
