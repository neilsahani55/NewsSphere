import { createClient } from '@supabase/supabase-js';

// Single shared Supabase client for the entire app.
// Multiple createClient() calls in the same tab trigger GoTrueClient warnings.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
