import { NVIDIA_KEY, NVIDIA_MODEL, NVIDIA_URL, MIN_CONTENT_LEN, CATEGORIES, BATCH_SLEEP_MS, RETRY_SLEEP_MS } from './config.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPrompt(title, sourceText) {
  const text = (sourceText || '').slice(0, 4000);
  return `You are a professional news journalist working for a major international news agency. Based on the article title and available source content below, write a COMPLETELY ORIGINAL, WELL-RESEARCHED news article entirely in your own words.

Do NOT simply rephrase the input. Write like an experienced journalist — provide real context, historical background, key players involved, broader implications, and why this story matters to readers today.

RESPOND WITH ONLY VALID JSON (no markdown fences, no commentary outside the JSON):
{"description":"...","content":"...","key_points":["p1","p2","p3","p4"],"categories":["Cat1"]}

STRICT REQUIREMENTS:
- description: Exactly 2 sentences, 60–80 words. Captures what happened and why it matters.
- content: MINIMUM 300 words, target 400–500 words. Write EXACTLY 3 paragraphs separated by \\n\\n.
    Paragraph 1 — What happened, the core news (2–3 sentences).
    Paragraph 2 — Background, context, key players, timeline (3–4 sentences).
    Paragraph 3 — Implications, reactions, what to watch next (2–3 sentences).
- key_points: 4 concise bullets, max 15 words each. The most important facts a busy reader must know.
- categories: 1–4 EXACT matches only from this list:
    India, Politics, Health, Crime, Science, Business, Sports, Entertainment, Tech, Crypto, World, Environment

Title: ${title}
Source content: ${text || '(no source content — use your knowledge of this topic)'}`;
}

async function callNvidiaOne(prompt) {
  const res = await fetch(NVIDIA_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NVIDIA_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.45,
      top_p: 0.95,
    }),
    signal: AbortSignal.timeout(90000),
  });
  return res;
}

function parseAIResponse(raw) {
  try {
    const clean = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      const m = clean.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    if (!parsed) return null;
    if (!parsed.content || typeof parsed.content !== 'string') return null;
    if (parsed.content.length < MIN_CONTENT_LEN) return null;
    if (!Array.isArray(parsed.key_points) || parsed.key_points.length === 0) return null;

    const validCats = (parsed.categories || [])
      .map(c => String(c).trim())
      .filter(c => CATEGORIES.includes(c));

    return {
      description: parsed.description || '',
      content: parsed.content,
      key_points: parsed.key_points
        .slice(0, 4)
        .map(p => `• ${String(p).replace(/^[•\-*]\s*/, '').trim()}`)
        .join('\n'),
      categories: validCats,
    };
  } catch {
    return null;
  }
}

// Process a single article — returns enriched data or null.
async function enrichOne(article) {
  const prompt = buildPrompt(
    article.title,
    article.scraped_content || article.description || '',
  );

  let res;
  try {
    res = await callNvidiaOne(prompt);
  } catch (e) {
    console.warn(`    NVIDIA request error for "${article.title.slice(0, 50)}": ${e.message}`);
    return null;
  }

  if (res.status === 429) {
    console.warn(`    429 rate-limit — sleeping ${RETRY_SLEEP_MS / 1000}s then retrying...`);
    await sleep(RETRY_SLEEP_MS);
    try {
      res = await callNvidiaOne(prompt);
    } catch (e) {
      console.warn(`    Retry failed: ${e.message}`);
      return null;
    }
  }

  if (res.status !== 200) {
    console.warn(`    NVIDIA ${res.status} for "${article.title.slice(0, 50)}"`);
    return null;
  }

  let json;
  try {
    json = await res.json();
  } catch (e) {
    console.warn(`    JSON parse error: ${e.message}`);
    return null;
  }

  const raw = json.choices?.[0]?.message?.content || '';
  const parsed = parseAIResponse(raw);

  if (parsed) {
    console.log(`    ✓ "${article.title.slice(0, 60)}"`);
  } else {
    console.warn(`    ✗ Parse failed: "${article.title.slice(0, 50)}"`);
  }

  return parsed;
}

// Enrich articles in parallel batches of PARALLEL_NVIDIA.
// Returns Map<article_url, enrichedData>.
export async function enrichBatch(articles) {
  const results = new Map();
  const chunkSize = 5; // PARALLEL_NVIDIA
  const chunks = [];
  for (let i = 0; i < articles.length; i += chunkSize) {
    chunks.push(articles.slice(i, i + chunkSize));
  }

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    console.log(`  AI batch ${ci + 1}/${chunks.length} (${chunk.length} articles)...`);

    const settled = await Promise.allSettled(chunk.map(a => enrichOne(a)));

    settled.forEach((r, idx) => {
      const article = chunk[idx];
      const data = r.status === 'fulfilled' ? r.value : null;
      if (data) results.set(article.article_url, data);
    });

    if (ci < chunks.length - 1) {
      console.log(`  Sleeping ${BATCH_SLEEP_MS / 1000}s between batches...`);
      await sleep(BATCH_SLEEP_MS);
    }
  }

  return results;
}
