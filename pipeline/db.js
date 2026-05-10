import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, RETENTION_DAYS } from './config.js';

// Service-role client — bypasses RLS, used only by the pipeline server.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// Fetch URLs of articles created in the last `days` days.
// Checking recent articles is enough because RSS feeds don't republish old stories.
export async function getRecentUrls(days = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const urls = new Set();
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('news')
      .select('article_url')
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

// Insert new (unenriched) articles, ignoring duplicates on article_url.
export async function insertArticles(articles) {
  if (!articles.length) return 0;

  const now = new Date().toISOString();
  const rows = articles.map(a => ({
    fetched_at_ist:   now,
    category:         a.category   || '',
    article_url:      a.article_url,
    title:            a.title      || '',
    description:      a.description || '',
    content:          '',
    key_points:       '',
    image_url:        a.image_url  || '',
    published_at_ist: a.published_at || now,
    source_name:      a.source_name || '',
    language:         a.language   || 'en',
    country:          a.country    || '',
    sentiment:        '',
    enriched:         false,
  }));

  const { error } = await supabase
    .from('news')
    .upsert(rows, { onConflict: 'article_url', ignoreDuplicates: true });

  if (error) throw new Error(`insertArticles: ${error.message}`);
  return rows.length;
}

// Get the newest unenriched articles up to `limit`.
export async function getUnenrichedArticles(limit = 50) {
  const { data, error } = await supabase
    .from('news')
    .select('id, article_url, title, description, category, language')
    .eq('enriched', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getUnenrichedArticles: ${error.message}`);
  return data || [];
}

// Write AI-enriched fields back to the row and mark it enriched.
export async function updateEnriched(articleUrl, enriched, existingCategory) {
  // Merge source category with AI-detected categories, deduplicated.
  const merged = [existingCategory, ...(enriched.categories || [])]
    .flatMap(c => String(c || '').split(',').map(s => s.trim()))
    .filter(Boolean)
    .filter((c, i, a) => a.indexOf(c) === i)
    .join(', ');

  const { error } = await supabase
    .from('news')
    .update({
      description: enriched.description || '',
      content:     enriched.content,
      key_points:  enriched.key_points,
      category:    merged || existingCategory || '',
      enriched:    true,
    })
    .eq('article_url', articleUrl);

  if (error) throw new Error(`updateEnriched ${articleUrl}: ${error.message}`);
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
