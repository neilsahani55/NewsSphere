import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_KEY           = process.env.GEMINI_KEY;

const GEMINI_URL    = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const HISTORY_TABLE = 'today_history';
const KEEP_DAYS     = 30;
const MAX_RETRIES   = 5;
const RETRY_DELAY   = 60000; // 60 seconds between retries on quota errors

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

function todayIST() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()); // "YYYY-MM-DD"
}

function displayDateIST() {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric', month: 'long',
  }).format(new Date()); // e.g. "30 May"
}

async function alreadyFetched(date) {
  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select('id')
    .eq('history_date', date)
    .limit(1);
  if (error) throw new Error(`Supabase check failed: ${error.message}`);
  return data.length > 0;
}

async function fetchFromGemini(displayDate) {
  const prompt =
    `You are a historian and educator. List exactly 10 significant and fascinating historical events ` +
    `that happened on ${displayDate} across different years of world and Indian history.\n\n` +
    `Return ONLY a valid JSON array with no markdown fences, no explanation, no extra text.\n` +
    `Each element must have exactly these four string fields:\n` +
    `  "event_year"   — the year as a string, e.g. "1969"\n` +
    `  "title"        — a concise title, max 12 words\n` +
    `  "description"  — exactly 2-3 sentences with historical context and significance\n` +
    `  "category"     — exactly one of: Science, Politics, Sports, Technology, Art, World, India, Achievement, Disaster, History\n\n` +
    `Requirements:\n` +
    `- Exactly 10 events, each with a unique event_year\n` +
    `- Span ancient history through 2020\n` +
    `- At least 2 events related to India if historically possible\n` +
    `- Mix categories broadly — no more than 2 events per category\n` +
    `- Descriptions must be factual, educational, and specific\n` +
    `- Sort by event_year ascending\n\n` +
    `Example element:\n` +
    `{"event_year":"1969","title":"Apollo 11 Launched Toward the Moon","description":"NASA launched the Apollo 11 mission from Kennedy Space Center on July 16, 1969, carrying astronauts Neil Armstrong, Buzz Aldrin, and Michael Collins. Four days later, Armstrong and Aldrin became the first humans to walk on the lunar surface, fulfilling President Kennedy's 1961 goal.","category":"Science"}`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4000,
      responseMimeType: 'application/json',
    },
  });

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (res.status === 429) {
      const wait = RETRY_DELAY * attempt;
      console.log(`Gemini quota hit (429) — attempt ${attempt}/${MAX_RETRIES}, retrying in ${wait / 1000}s...`);
      await new Promise(r => setTimeout(r, wait));
      lastError = new Error(`Gemini quota exceeded after ${MAX_RETRIES} retries`);
      continue;
    }

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Gemini HTTP ${res.status}: ${txt.slice(0, 300)}`);
    }

    const json = await res.json();
    let rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    rawText = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let events;
    try {
      events = JSON.parse(rawText);
    } catch {
      const m = rawText.match(/\[[\s\S]*\]/);
      if (m) events = JSON.parse(m[0]);
      else throw new Error(`No JSON array found in Gemini output: ${rawText.slice(0, 400)}`);
    }

    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('Empty events array from Gemini');
    }

    return events;
  }

  throw lastError;
}

async function insertEvents(events, date) {
  const rows = [];
  for (const ev of events) {
    const yr    = String(ev.event_year  || '').trim().slice(0, 10);
    const title = String(ev.title       || '').trim().slice(0, 200);
    const desc  = String(ev.description || '').trim().slice(0, 1500);
    const cat   = String(ev.category    || 'History').trim().slice(0, 50);
    if (!yr || !title || !desc) continue;
    rows.push({ history_date: date, event_year: yr, title, description: desc, category: cat });
    if (rows.length >= 12) break;
  }

  if (rows.length === 0) throw new Error('No valid rows after validation');

  const { error } = await supabase.from(HISTORY_TABLE).insert(rows);
  if (error) throw new Error(`Insert failed: ${error.message}`);
  console.log(`Inserted ${rows.length} history events for ${date}`);
}

async function cleanupOld() {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000);
  const cutoffStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(cutoff);

  const { error } = await supabase
    .from(HISTORY_TABLE)
    .delete()
    .lt('history_date', cutoffStr);
  if (error) console.error(`Cleanup failed: ${error.message}`);
  else console.log(`Cleaned history older than ${cutoffStr}`);
}

async function main() {
  const date        = todayIST();
  const displayDate = displayDateIST();
  console.log(`Running history pipeline for ${date} (${displayDate})`);

  if (await alreadyFetched(date)) {
    console.log(`History for ${date} already exists — skipping fetch`);
  } else {
    const events = await fetchFromGemini(displayDate);
    await insertEvents(events, date);
  }

  await cleanupOld();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
