import 'dotenv/config';

const required = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
};

export const SUPABASE_URL         = required('SUPABASE_URL');
export const SUPABASE_SERVICE_KEY = required('SUPABASE_SERVICE_KEY');
export const NVIDIA_KEY           = required('NVIDIA_KEY');

export const NVIDIA_MODEL    = 'meta/llama-3.1-8b-instruct';
export const NVIDIA_URL      = 'https://integrate.api.nvidia.com/v1/chat/completions';

// Enrich-first: AI writes content BEFORE inserting into Supabase.
// Only fully-enriched articles ever touch the DB — no blank rows.
export const MAX_NEW_PER_RUN  = 25;    // max new articles to process per run
export const ITEMS_PER_FEED   = 5;     // items fetched per RSS feed (keep volume low)
export const PARALLEL_NVIDIA  = 3;     // concurrent NVIDIA requests (stay under rate limit)
export const BATCH_SLEEP_MS   = 12000; // ms between NVIDIA batches
export const RETRY_SLEEP_MS   = 25000; // ms before retrying a 429
export const MIN_CONTENT_LEN  = 200;   // minimum AI content chars to accept
export const RETENTION_DAYS   = 30;    // delete articles older than this

export const CATEGORIES = [
  'India', 'Politics', 'Health', 'Crime', 'Science', 'Business',
  'Sports', 'Entertainment', 'Tech', 'Crypto', 'World', 'Environment',
];
