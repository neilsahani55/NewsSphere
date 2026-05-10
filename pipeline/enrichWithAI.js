import {
  NVIDIA_KEY, NVIDIA_MODEL, NVIDIA_URL,
  GEMINI_KEY, GEMINI_URL,
  OPENAI_KEY, OPENAI_MODEL, OPENAI_URL,
  MIN_CONTENT_LEN, CATEGORIES,
  BATCH_SLEEP_MS, RETRY_SLEEP_MS, PARALLEL_NVIDIA, NVIDIA_TIMEOUT_MS,
} from './config.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// AI is asked to write completely original content — not a rewrite of the source.
// We pass title + brief description only (no scraped HTML) to ensure the output
// is the AI's own journalistic work, not a paraphrase of the publisher's text.
function buildPrompt(title, briefContext) {
  return `You are an experienced journalist writing for a major international digital news platform.

Your task: Write a COMPLETELY ORIGINAL news article about the topic below. Use your own words, sentences, and journalistic voice throughout. Every sentence must be freshly written — do not copy, paraphrase, or closely mirror the brief context provided.

Draw on your knowledge of the topic, relevant history, key people involved, and broader implications to produce a thorough, well-rounded piece that a reader would find genuinely informative.

RESPOND WITH ONLY VALID JSON — no markdown fences, no text outside the JSON object:
{"description":"...","content":"...","key_points":["p1","p2","p3","p4"],"categories":["Cat1"]}

REQUIREMENTS:
- description: 2 original sentences, 60–80 words. Your own words only.
- content: 300–450 words. EXACTLY 3 paragraphs, separated by \\n\\n.
    § 1 — Core news: what happened and why it matters (2–3 sentences).
    § 2 — Background & context: relevant history, key players, timeline (3–4 sentences).
    § 3 — Implications & outlook: what comes next, reactions, significance (2–3 sentences).
  Every sentence must be original. Do not lift phrases from the brief context.
- key_points: 4 bullets, max 15 words each. The most important facts a busy reader needs.
- categories: 1–4 EXACT matches from: India, Politics, Health, Crime, Science, Business, Sports, Entertainment, Tech, Crypto, World, Environment

Topic title: ${title}
Brief context (for background only — do NOT copy this text): ${(briefContext || '').slice(0, 600)}`;
}

// ── Provider calls ────────────────────────────────────────────────────────────

async function callNvidia(prompt) {
  return fetch(NVIDIA_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${NVIDIA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.5,
      top_p: 0.9,
    }),
    signal: AbortSignal.timeout(NVIDIA_TIMEOUT_MS),
  });
}

async function callGemini(prompt) {
  return fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2000, temperature: 0.5, topP: 0.9 },
    }),
    signal: AbortSignal.timeout(NVIDIA_TIMEOUT_MS),
  });
}

async function callOpenAI(prompt) {
  return fetch(OPENAI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.5,
      top_p: 0.9,
    }),
    signal: AbortSignal.timeout(NVIDIA_TIMEOUT_MS),
  });
}

// ── Response parsing (provider-agnostic) ──────────────────────────────────────

function parseResponse(raw) {
  try {
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch {
      const m = clean.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    if (!parsed?.content || typeof parsed.content !== 'string') return null;
    if (parsed.content.length < MIN_CONTENT_LEN) return null;
    if (!Array.isArray(parsed.key_points) || parsed.key_points.length === 0) return null;

    return {
      description: String(parsed.description || '').trim(),
      content:     parsed.content.trim(),
      key_points:  parsed.key_points
        .slice(0, 4)
        .map(p => `• ${String(p).replace(/^[•\-*]\s*/, '').trim()}`)
        .join('\n'),
      categories: (parsed.categories || [])
        .map(c => String(c).trim())
        .filter(c => CATEGORIES.includes(c)),
    };
  } catch { return null; }
}

// Extract the text string from a provider's JSON response
function extractRaw(json, provider) {
  if (provider === 'Gemini') {
    return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  // NVIDIA and OpenAI both use the same OpenAI-compatible format
  return json?.choices?.[0]?.message?.content || '';
}

// ── Enrichment with 3-provider fallback ──────────────────────────────────────

async function enrichOne(article) {
  const prompt = buildPrompt(article.title, article.description || '');
  const label  = article.title.slice(0, 50);

  // ── 1. NVIDIA (primary) — one retry on 429 ──────────────────────────
  let nvidiaRes = null;
  try {
    nvidiaRes = await callNvidia(prompt);
  } catch (e) {
    console.warn(`    ✗ NVIDIA network error "${label}": ${e.message}`);
  }

  if (nvidiaRes?.status === 429) {
    console.warn(`    429 NVIDIA rate-limit — waiting ${RETRY_SLEEP_MS / 1000}s then retrying...`);
    await sleep(RETRY_SLEEP_MS);
    try { nvidiaRes = await callNvidia(prompt); }
    catch (e) { console.warn(`    NVIDIA retry failed: ${e.message}`); nvidiaRes = null; }
  }

  if (nvidiaRes?.status === 200) {
    let json;
    try { json = await nvidiaRes.json(); } catch { json = null; }
    const raw = extractRaw(json, 'NVIDIA');
    const result = parseResponse(raw);
    if (result) { console.log(`    ✓ [NVIDIA] "${article.title.slice(0, 65)}"`); return result; }
    console.warn(`    ✗ [NVIDIA] parse failed — trying Gemini`);
    console.warn(`    ⚠ NVIDIA raw (first 300): ${raw.slice(0, 300)}`);
  } else if (nvidiaRes) {
    console.warn(`    ✗ NVIDIA ${nvidiaRes.status} — trying Gemini`);
  }

  // ── 2. Gemini fallback ───────────────────────────────────────────────
  if (GEMINI_KEY) {
    try {
      const gRes = await callGemini(prompt);
      if (gRes.status === 200) {
        let json;
        try { json = await gRes.json(); } catch { json = null; }
        const result = parseResponse(extractRaw(json, 'Gemini'));
        if (result) { console.log(`    ✓ [Gemini] "${article.title.slice(0, 65)}"`); return result; }
        console.warn(`    ✗ [Gemini] parse failed — trying OpenAI`);
      } else {
        let body = '';
        try { body = await gRes.text(); } catch { /**/ }
        console.warn(`    ✗ Gemini ${gRes.status}: ${body.slice(0, 120)} — trying OpenAI`);
      }
    } catch (e) {
      console.warn(`    ✗ Gemini error: ${e.message} — trying OpenAI`);
    }
  }

  // ── 3. OpenAI fallback (sequential — free tier allows only 3 RPM) ────
  if (OPENAI_KEY) {
    // Brief pause so parallel articles don't all hit OpenAI simultaneously
    await sleep(3000);
    try {
      let oRes = await callOpenAI(prompt);
      // One retry on 429
      if (oRes.status === 429) {
        console.warn(`    429 OpenAI rate-limit — waiting 20s then retrying...`);
        await sleep(20000);
        try { oRes = await callOpenAI(prompt); } catch (e) { oRes = null; }
      }
      if (oRes?.status === 200) {
        let json;
        try { json = await oRes.json(); } catch { json = null; }
        const result = parseResponse(extractRaw(json, 'OpenAI'));
        if (result) { console.log(`    ✓ [OpenAI] "${article.title.slice(0, 65)}"`); return result; }
        console.warn(`    ✗ [OpenAI] parse failed`);
      } else if (oRes) {
        console.warn(`    ✗ OpenAI ${oRes.status}`);
      }
    } catch (e) {
      console.warn(`    ✗ OpenAI error: ${e.message}`);
    }
  }

  console.warn(`    ✗ All providers failed: "${label}"`);
  return null;
}

// Process articles in parallel batches of PARALLEL_NVIDIA (default 5).
// Returns Map<article_url, enrichedData> for articles that succeeded.
export async function enrichBatch(articles) {
  const results = new Map();
  const chunks = [];
  for (let i = 0; i < articles.length; i += PARALLEL_NVIDIA) {
    chunks.push(articles.slice(i, i + PARALLEL_NVIDIA));
  }

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    console.log(`  AI batch ${ci + 1}/${chunks.length} (${chunk.length} articles)...`);

    const settled = await Promise.allSettled(chunk.map(a => enrichOne(a)));
    settled.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value) {
        results.set(chunk[idx].article_url, r.value);
      }
    });

    if (ci < chunks.length - 1) {
      console.log(`  Sleeping ${BATCH_SLEEP_MS / 1000}s...`);
      await sleep(BATCH_SLEEP_MS);
    }
  }

  return results;
}
