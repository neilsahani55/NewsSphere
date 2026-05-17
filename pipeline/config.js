import 'dotenv/config';

const required = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
};
const optional = (key) => process.env[key] || null;

export const SUPABASE_URL         = required('SUPABASE_URL');
export const SUPABASE_SERVICE_KEY = required('SUPABASE_SERVICE_KEY');
export const NVIDIA_KEY           = required('NVIDIA_KEY');

// Optional fallback providers — pipeline works without them but uses them when available
export const GEMINI_KEY   = optional('GEMINI_KEY');
export const OPENAI_KEY   = optional('OPENAI_KEY');

// 70b model follows JSON instructions far more reliably than 8b
export const NVIDIA_MODEL  = 'meta/llama-3.3-70b-instruct';
export const NVIDIA_URL    = 'https://integrate.api.nvidia.com/v1/chat/completions';
export const GEMINI_MODEL  = 'gemini-2.0-flash';
export const GEMINI_URL    = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
export const OPENAI_MODEL  = 'gpt-4o-mini';
export const OPENAI_URL    = 'https://api.openai.com/v1/chat/completions';

// Enrich-first: AI writes content BEFORE inserting into Supabase.
// Only fully-enriched articles ever touch the DB — no blank rows.
//
// Timing budget (worst case, all NVIDIA timeouts + one retry per batch):
//   30 articles ÷ 6 parallel = 5 batches
//   5 × (40s timeout + 10s retry-wait + 40s retry) = 450s ≈ 7.5 min
//   + 4 × 4s batch sleeps = 16s
//   + Gemini/OpenAI fallbacks on stragglers ≈ 2 min
//   Total worst case ≈ 10 min  →  well under the 30-min GitHub Actions limit
export const MAX_NEW_PER_RUN  = 30;    // reduced from 60; keeps runtime ~10 min worst case
export const ITEMS_PER_FEED   = 8;     // items fetched per RSS feed
export const PARALLEL_NVIDIA  = 6;     // concurrent NVIDIA requests per batch (was 5)
export const BATCH_SLEEP_MS   = 4000;  // ms between NVIDIA batches (was 6000)
export const RETRY_SLEEP_MS   = 10000; // ms before retrying a 429 (was 20000)
export const NVIDIA_TIMEOUT_MS = 40000; // ms per NVIDIA API call (was 70000)
export const MIN_CONTENT_LEN  = 200;   // minimum AI content chars to accept
export const RETENTION_DAYS   = 30;    // delete articles older than this

export const CATEGORIES = [
  'India', 'Politics', 'Health', 'Crime', 'Science', 'Business',
  'Sports', 'Entertainment', 'Tech', 'Crypto', 'World', 'Environment',
];
