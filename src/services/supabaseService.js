import { createClient } from '@supabase/supabase-js';

// Anon key is safe to expose in the frontend — Supabase RLS controls access.
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// Columns fetched on initial load — excludes `content` (the largest field,
// ~2 KB per article) so the first payload is small and renders fast.
// Content is fetched lazily the first time the user opens an article.
const CARD_COLUMNS = [
  'id',
  'fetched_at_ist',
  'category',
  'article_url',
  'title',
  'description',
  'key_points',
  'image_url',
  'published_at_ist',
  'source_name',
  'language',
  'country',
  'sentiment',
].join(', ');

export const INITIAL_BATCH = 50;   // shown to user immediately
export const BACKGROUND_BATCH = 200; // each subsequent background page

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

// Per-article content fetch — called by DetailPanel the first time an article
// is opened. Result is cached in the component so subsequent opens are instant.
export async function fetchArticleContent(id) {
  const { data, error } = await supabase
    .from('news')
    .select('id, content')
    .eq('id', id)
    .single();

  if (error) return '';
  return data?.content ?? '';
}
