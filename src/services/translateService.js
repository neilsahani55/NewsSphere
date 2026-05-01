// On-demand translation via Google Translate's public gtx endpoint.
// CORS-friendly, no API key required. We chunk long inputs and share a
// module-scoped cache between the card-batch hook and the article-detail hook
// so a translation done for the card list is reused by the reader and vice-versa.

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const MAX_CHUNK = 1500;

// Key: `${article_url}::${target}::${field}` → { src, out }
// We store the original text alongside the translation so that when the sheet
// updates a row (e.g. content was empty and gets populated later), we can
// detect the source change and re-translate instead of returning a stale value.
export const translateCache = new Map();

function key(url, target, field) {
  return `${url}::${target}::${field}`;
}

// True when no work is needed: no target, "original" sentinel, source matches target.
function passthrough(article, target) {
  return !target || target === 'original' || article?.language === target;
}

export function isCached(article, field, target) {
  if (passthrough(article, target)) return true;
  const entry = translateCache.get(key(article.article_url, target, field));
  if (!entry) return false;
  // Stale cache entry — source text changed since we last translated.
  return entry.src === (article[field] || '');
}

export function getCached(article, field, target) {
  if (!article) return '';
  const original = article[field] || '';
  if (passthrough(article, target)) return original;
  const entry = translateCache.get(key(article.article_url, target, field));
  if (!entry || entry.src !== original) return original;
  return entry.out;
}

export function setCached(article, field, target, value) {
  translateCache.set(key(article.article_url, target, field), {
    src: article[field] || '',
    out: value,
  });
}

async function translateChunk(text, target, source = 'auto', signal) {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: source,
    tl: target,
    dt: 't',
    q: text,
  });
  const res = await fetch(`${ENDPOINT}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Translate request failed (${res.status})`);
  const data = await res.json();
  return (data?.[0] || []).map(seg => seg[0]).join('');
}

function chunkText(text) {
  if (text.length <= MAX_CHUNK) return [text];
  const chunks = [];
  for (const paragraph of text.split(/\n+/)) {
    if (!paragraph.trim()) continue;
    if (paragraph.length <= MAX_CHUNK) {
      chunks.push(paragraph);
      continue;
    }
    let buffer = '';
    for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
      if ((buffer + ' ' + sentence).length <= MAX_CHUNK) {
        buffer = buffer ? `${buffer} ${sentence}` : sentence;
      } else {
        if (buffer) chunks.push(buffer);
        buffer = sentence.length > MAX_CHUNK ? sentence.slice(0, MAX_CHUNK) : sentence;
      }
    }
    if (buffer) chunks.push(buffer);
  }
  return chunks;
}

export async function translate(text, target, signal) {
  if (!text || !target || target === 'original') return text || '';
  const chunks = chunkText(String(text));
  const out = [];
  // Sequential — parallel hits the gtx endpoint's rate limits hard.
  for (const c of chunks) {
    out.push(await translateChunk(c, target, 'auto', signal));
  }
  return out.join('\n\n');
}

// Translates one field of one article and writes the result into the cache.
// Returns the translated text (or the original on no-op / failure).
export async function translateField(article, field, target, signal) {
  if (passthrough(article, target)) return article[field] || '';
  if (isCached(article, field, target)) return getCached(article, field, target);
  const text = article[field];
  if (!text) return '';
  const translated = await translate(text, target, signal);
  setCached(article, field, target, translated);
  return translated;
}
