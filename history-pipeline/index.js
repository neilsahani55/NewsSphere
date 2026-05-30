import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const HISTORY_TABLE = 'today_history';
const KEEP_DAYS     = 30;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

function todayIST() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function monthDayIST() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  return {
    month: parts.find(p => p.type === 'month').value,
    day:   parts.find(p => p.type === 'day').value,
  };
}

async function alreadyFetched(date) {
  const { data, error } = await supabase
    .from(HISTORY_TABLE).select('id').eq('history_date', date).limit(1);
  if (error) throw new Error(`Supabase check failed: ${error.message}`);
  return data.length > 0;
}

const INDIA_RE = /\b(india|indian|mughal|delhi|mumbai|gandhi|nehru|pakistan|bangladesh|hindi|hindu|sikh|kolkata|calcutta|bombay|madras|chennai|british india|raj|subcontinent|maharaja|tipu|ashoka|maurya|maratha|gupta|punjab|hyderabad|mysore|nawab|bengal|tamil|kerala|gujarat|rajasthan)\b/;

function isIndia(text) {
  return INDIA_RE.test(text.toLowerCase());
}

function assignCategory(text) {
  const t = text.toLowerCase();
  if (INDIA_RE.test(t)) return 'India';
  if (/\b(discover|invent|scientist|physics|chemistry|astronomy|nasa|rocket|satellite|atom|dna|vaccine|medicine|laboratory)\b/.test(t)) return 'Science';
  if (/\b(computer|internet|telephone|aircraft|automobile|software|technology|digital|electric|telegraph)\b/.test(t)) return 'Technology';
  if (/\b(olympics|world cup|championship|tournament|football|cricket|tennis|basketball|baseball|athlete|stadium)\b/.test(t)) return 'Sports';
  if (/\b(president|prime minister|parliament|election|constitution|revolution|independence|treaty|war|battle|military|coup|republic)\b/.test(t)) return 'Politics';
  if (/\b(earthquake|tsunami|hurricane|tornado|flood|fire|disaster|explosion|accident|crash|famine|plague|eruption)\b/.test(t)) return 'Disaster';
  if (/\b(artist|painting|music|symphony|opera|literature|novel|film|cinema|theater|theatre|poet|composer)\b/.test(t)) return 'Art';
  if (/\b(world|international|united nations|global|europe|asia|africa|america|china|russia|france|germany|britain|japan)\b/.test(t)) return 'World';
  return 'History';
}

function makeTitle(text, pageTitle) {
  // Use Wikipedia article title when meaningful (not generic)
  if (pageTitle && pageTitle.length > 3 && pageTitle.length < 80) return pageTitle;
  // Otherwise take first clause (up to period/comma), max 80 chars
  const clause = text.split(/[.,]/)[0].trim();
  return clause.length <= 80 ? clause : clause.slice(0, 77) + '...';
}

async function fetchFromWikipedia(month, day) {
  const url = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${month}/${day}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'NewsSphere/1.0 (history-pipeline)' },
  });
  if (!res.ok) throw new Error(`Wikipedia API HTTP ${res.status}`);
  const data = await res.json();

  // Collect all unique events (selected first — most notable)
  const selected = data.selected || [];
  const events   = data.events   || [];
  const seen = new Set();
  const all  = [];
  for (const ev of [...selected, ...events]) {
    const key = String(ev.year);
    if (seen.has(key) || !ev.text) continue;
    seen.add(key);
    all.push(ev);
  }
  return all;
}

function toRow(ev, date) {
  const yr    = String(ev.year || '').trim();
  const text  = String(ev.text || '').trim();
  const pTitle = ev.pages?.[0]?.title || '';
  const title = makeTitle(text, pTitle).slice(0, 200);
  const desc  = text.slice(0, 1500);
  const cat   = assignCategory(text + ' ' + pTitle);
  if (!yr || !title || !desc) return null;
  return { history_date: date, event_year: yr, title, description: desc, category: cat };
}

async function insertEvents(raw, date) {
  // Split into India and non-India pools
  const indiaPool    = raw.filter(ev => isIndia(ev.text + ' ' + (ev.pages?.[0]?.title || '')));
  const nonIndiaPool = raw.filter(ev => !isIndia(ev.text + ' ' + (ev.pages?.[0]?.title || '')));

  // Guarantee at least 2 India events (up to 3), fill the rest from non-India
  const indiaCount = Math.min(indiaPool.length, 3);
  const picked = [
    ...indiaPool.slice(0, indiaCount),
    ...nonIndiaPool.slice(0, 10 - indiaCount),
  ].sort((a, b) => Number(a.year) - Number(b.year));

  console.log(`India events available: ${indiaPool.length}, picking: ${indiaCount}`);

  const rows = picked.map(ev => toRow(ev, date)).filter(Boolean);
  if (rows.length === 0) throw new Error('No valid rows after processing');

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
    .from(HISTORY_TABLE).delete().lt('history_date', cutoffStr);
  if (error) console.error(`Cleanup failed: ${error.message}`);
  else console.log(`Cleaned history older than ${cutoffStr}`);
}

async function main() {
  const date = todayIST();
  const { month, day } = monthDayIST();
  console.log(`Running history pipeline for ${date} (${month}/${day})`);

  if (await alreadyFetched(date)) {
    console.log(`History for ${date} already exists — skipping`);
  } else {
    const raw = await fetchFromWikipedia(month, day);
    await insertEvents(raw, date);
  }

  await cleanupOld();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
