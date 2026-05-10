import { createClient } from '@supabase/supabase-js';

// Anon key is safe to expose in the frontend — Supabase RLS controls access.
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

const COLUMNS = [
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
  // Fetch all enriched articles, newest first.
  // Supabase returns rows up to the postgrest limit (1000 by default) so we
  // page through everything to match the previous sheet behaviour.
  const PAGE = 1000;
  let all = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('news')
      .select(COLUMNS)
      .eq('enriched', true)
      .order('published_at_ist', { ascending: false })
      .range(from, from + PAGE - 1);

    if (signal) query = query.abortSignal(signal);

    const { data, error } = await query;

    if (error) {
      if (error.message?.includes('abort')) throw new DOMException('Aborted', 'AbortError');
      throw new Error(error.message);
    }

    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }

  return all.filter(a => a.article_url && a.title);
}
