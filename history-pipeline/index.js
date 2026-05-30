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
  if (pageTitle && pageTitle.length > 3 && pageTitle.length < 80) return pageTitle;
  const clause = text.split(/[.,]/)[0].trim();
  return clause.length <= 80 ? clause : clause.slice(0, 77) + '...';
}

async function fetchFromWikipedia(month, day) {
  const url = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${month}/${day}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'NewsSphere/1.0 (history-pipeline)' },
  });
  if (!res.ok) throw new Error(`Wikipedia feed API HTTP ${res.status}`);
  const data = await res.json();

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

// Uses the MediaWiki action API — returns full intro section (2–5 paragraphs)
// Falls back to REST summary if the action API fails
async function fetchWikiExtract(title) {
  if (!title) return '';

  // Primary: MediaWiki action API with full intro section
  try {
    const params = new URLSearchParams({
      action:      'query',
      prop:        'extracts',
      exintro:     '1',
      explaintext: '1',
      redirects:   '1',
      titles:      title,
      format:      'json',
      origin:      '*',
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: { 'User-Agent': 'NewsSphere/1.0 (history-pipeline)' },
    });
    if (res.ok) {
      const json = await res.json();
      const pages = json?.query?.pages || {};
      const page  = Object.values(pages)[0];
      if (page && !page.missing && page.extract) {
        const text = page.extract.trim();
        if (text.length > 100) {
          console.log(`    MediaWiki extract: ${text.length} chars`);
          return text.slice(0, 4000);
        }
      }
    }
  } catch (e) {
    console.warn(`    MediaWiki API error for "${title}": ${e.message}`);
  }

  // Fallback: REST summary endpoint
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { headers: { 'User-Agent': 'NewsSphere/1.0 (history-pipeline)' } },
    );
    if (res.ok) {
      const json = await res.json();
      const text = (json.extract || '').trim();
      if (text) {
        console.log(`    REST summary fallback: ${text.length} chars`);
        return text.slice(0, 4000);
      }
    }
  } catch (e) {
    console.warn(`    REST summary error for "${title}": ${e.message}`);
  }

  console.warn(`    No extract found for "${title}"`);
  return '';
}

async function insertEvents(raw, date) {
  const indiaPool    = raw.filter(ev => isIndia(ev.text + ' ' + (ev.pages?.[0]?.title || '')));
  const nonIndiaPool = raw.filter(ev => !isIndia(ev.text + ' ' + (ev.pages?.[0]?.title || '')));

  const indiaCount = Math.min(indiaPool.length, 3);
  const picked = [
    ...indiaPool.slice(0, indiaCount),
    ...nonIndiaPool.slice(0, 10 - indiaCount),
  ].sort((a, b) => Number(a.year) - Number(b.year));

  console.log(`India events available: ${indiaPool.length}, picking: ${indiaCount}`);

  const rows = [];
  for (const ev of picked) {
    const yr     = String(ev.year || '').trim();
    const text   = String(ev.text || '').trim();
    const pTitle = ev.pages?.[0]?.title || '';
    const title  = makeTitle(text, pTitle).slice(0, 200);
    const desc   = text.slice(0, 1500);
    const cat    = assignCategory(text + ' ' + pTitle);
    if (!yr || !title || !desc) continue;

    console.log(`  Fetching details for [${yr}] ${title}`);
    const details = await fetchWikiExtract(pTitle);

    rows.push({ history_date: date, event_year: yr, title, description: desc, category: cat, details });
  }

  if (rows.length === 0) throw new Error('No valid rows after processing');

  const { error } = await supabase.from(HISTORY_TABLE).insert(rows);
  if (error) throw new Error(`Insert failed: ${error.message}`);

  const withDetails = rows.filter(r => r.details.length > 0).length;
  console.log(`Inserted ${rows.length} events (${withDetails} with details) for ${date}`);
}

async function cleanupOld() {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000);
  const cutoffStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(cutoff);

  console.log(`Deleting history older than ${cutoffStr} (keeping last ${KEEP_DAYS} days)...`);
  const { error } = await supabase
    .from(HISTORY_TABLE)
    .delete()
    .lt('history_date', cutoffStr);
  if (error) console.error(`Cleanup failed: ${error.message}`);
  else console.log(`Cleanup done — records before ${cutoffStr} removed`);
}

async function main() {
  const date = todayIST();
  const { month, day } = monthDayIST();
  console.log(`Running history pipeline for ${date} (${month}/${day})`);

  if (await alreadyFetched(date)) {
    console.log(`History for ${date} already exists — skipping fetch`);
  } else {
    const raw = await fetchFromWikipedia(month, day);
    await insertEvents(raw, date);
  }

  await cleanupOld();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
