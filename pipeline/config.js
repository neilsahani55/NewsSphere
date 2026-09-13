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

// DeepSeek v4 flash is the only model still invokable on this NVIDIA account —
// every llama/mistral/nemotron catalog entry returns 404 "Function not found",
// and the old meta/llama-3.3-70b-instruct was retired (410 Gone).
export const NVIDIA_MODEL  = 'deepseek-ai/deepseek-v4-flash-0731';
export const NVIDIA_URL    = 'https://integrate.api.nvidia.com/v1/chat/completions';
// Auto-updating alias for the newest stable Flash model — survives Google's
// model retirements (gemini-2.0-flash was shut down 2026-06-01).
export const GEMINI_MODEL  = 'gemini-flash-latest';
export const GEMINI_URL    = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
export const OPENAI_MODEL  = 'gpt-4o-mini';
export const OPENAI_URL    = 'https://api.openai.com/v1/chat/completions';

// Enrich-first: AI writes content BEFORE inserting into Supabase.
// Only fully-enriched articles ever touch the DB — no blank rows.
//
// Provider order is Gemini → NVIDIA → OpenAI: Gemini Flash answers in seconds,
// while NVIDIA's deepseek-v4-flash measures 35–120s+ per call and times out
// intermittently, so it serves as fallback only.
//
// Timing budget (worst case, Gemini down + all NVIDIA timeouts):
//   30 articles ÷ 6 parallel = 5 batches
//   5 × (120s NVIDIA timeout + OpenAI straggler ~25s) ≈ 12 min
//   + 4 × 4s batch sleeps = 16s
//   Total worst case ≈ 13 min  →  under the 30-min GitHub Actions limit
export const MAX_NEW_PER_RUN  = 30;    // keeps runtime bounded per run
export const ITEMS_PER_FEED   = 8;     // items fetched per RSS feed
export const PARALLEL_NVIDIA  = 6;     // concurrent AI requests per batch
export const BATCH_SLEEP_MS   = 4000;  // ms between AI batches
export const RETRY_SLEEP_MS   = 10000; // ms before retrying a 429
export const NVIDIA_TIMEOUT_MS = 120000; // ms per AI call (deepseek measures 35–120s)
export const MIN_CONTENT_LEN  = 200;   // minimum AI content chars to accept
export const RETENTION_DAYS   = 30;    // delete articles older than this

export const CATEGORIES = [
  'India', 'Politics', 'Health', 'Crime', 'Science', 'Business',
  'Sports', 'Entertainment', 'Tech', 'Crypto', 'World', 'Environment',
];
