import { createClient } from '@supabase/supabase-js';

// Anon key is safe to expose in the frontend — Supabase RLS controls access.
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

const COLUMNS = [
  'id',
  'fetched_at_ist',
  'category',
  'article_url',
  'title',
  'description',
  'content',
  'key_points',
  'image_url',
  'published_at_ist',
  'source_name',
  'language',
  'country',
  'sentiment',
].join(', ');

export async function loadNews({ signal } = {}) {
  let query = supabase
    .from('news')
    .select(COLUMNS)
    .eq('enriched', true)
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
