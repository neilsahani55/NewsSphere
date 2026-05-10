import 'dotenv/config';

const required = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
};

export const SUPABASE_URL         = required('SUPABASE_URL');
export const SUPABASE_SERVICE_KEY = required('SUPABASE_SERVICE_KEY');
export const NVIDIA_KEY           = required('NVIDIA_KEY');

export const NVIDIA_MODEL      = 'meta/llama-3.1-8b-instruct';
export const NVIDIA_URL        = 'https://integrate.api.nvidia.com/v1/chat/completions';

export const ENRICH_BATCH      = 50;    // articles enriched per run
export const PARALLEL_NVIDIA   = 5;     // concurrent NVIDIA requests per chunk
export const BATCH_SLEEP_MS    = 8000;  // ms between NVIDIA batches (rate-limit headroom)
export const RETRY_SLEEP_MS    = 20000; // ms before 429 retry
export const MIN_CONTENT_LEN   = 250;   // minimum chars for valid AI content
export const RETENTION_DAYS    = 30;    // delete articles older than this
export const ITEMS_PER_FEED    = 10;    // max items fetched per RSS feed
export const SCRAPE_TIMEOUT_MS = 10000; // per-article scrape timeout (ms)

export const CATEGORIES = [
  'India', 'Politics', 'Health', 'Crime', 'Science', 'Business',
  'Sports', 'Entertainment', 'Tech', 'Crypto', 'World', 'Environment',
];
