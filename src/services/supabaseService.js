import { createClient } from '@supabase/supabase-js';

// Anon key is safe to expose in the frontend — Supabase RLS controls access.
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// Columns fetched on initial/background loads — excludes `content` (~2 KB/article)
// and `key_points` (~250 bytes/article) because both are only needed in the reader.
// They are fetched lazily the first time the user opens an article.
const CARD_COLUMNS = [
  'id',
  'fetched_at_ist',
  'category',
  'article_url',
  'title',
  'description',
  'image_url',
  'published_at_ist',
  'source_name',
  'language',
  'country',
  'sentiment',
].join(', ');

export const INITIAL_BATCH      = 50;  // shown to user immediately
export const BACKGROUND_BATCH   = 100; // each background page (smaller = snappier UI)
export const MAX_TOTAL_ARTICLES = 500; // stop after this many — nobody reads 2000+

export async function loadNews({ signal, from = 0, to = INITIAL_BATCH - 1 } = {}) {
  let query = supabase
    .from('news')
    .select(CARD_COLUMNS)
    .eq('enriched', true)
    .order('published_at_ist', { ascending: false })
    .range(from, to);

  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;

  if (error) {
    if (error.message?.includes('abort')) throw new DOMException('Aborted', 'AbortError');
    throw new Error(error.message);
  }

  return (data || []).filter(a => a.article_url && a.title);
}

// Full-database keyword search — bypasses the client-side 500-article limit.
// Searches title, description, and source_name with a case-insensitive LIKE.
export async function searchNews(q, signal) {
  const safe = q.trim();
  if (!safe) return [];
  let query = supabase
    .from('news')
    .select(CARD_COLUMNS)
    .eq('enriched', true)
    .or(`title.ilike.%${safe}%,description.ilike.%${safe}%,source_name.ilike.%${safe}%`)
    .order('published_at_ist', { ascending: false })
    .limit(300);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) {
    if (error.message?.includes('abort')) throw new DOMException('Aborted', 'AbortError');
    throw new Error(error.message);
  }
  return (data || []).filter(a => a.article_url && a.title);
}

// Fetch a single article's card-level fields by ID.
// Used when visiting /news/:slug directly for an article not in the loaded batch.
export async function fetchArticleById(id) {
  const { data, error } = await supabase
    .from('news')
    .select(CARD_COLUMNS)
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

// Per-article content + key_points fetch — called by DetailPanel the first time
// an article is opened. Both fields are excluded from card fetches to save data.
// Result is cached in the component so subsequent opens are instant.
export async function fetchArticleContent(id) {
  const { data, error } = await supabase
    .from('news')
    .select('id, content, key_points')
    .eq('id', id)
    .single();

  if (error) return { content: '', key_points: '' };
  return {
    content:    data?.content    ?? '',
    key_points: data?.key_points ?? '',
  };
}
