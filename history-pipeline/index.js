import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const HISTORY_TABLE = 'today_history';
const KEEP_DAYS     = 30;
const MAX_EVENTS    = 20; // store up to 20 events per day

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

// Returns false if we should fetch (no rows, or rows missing details).
// Auto-deletes incomplete rows so re-insertion doesn't conflict.
async function shouldSkip(date) {
  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select('id, details')
    .eq('history_date', date);
  if (error) throw new Error(`Supabase check failed: ${error.message}`);
  if (data.length === 0) return false;

  const hasDetails = data.some(r => r.details && r.details.length > 50);
  if (!hasDetails) {
    console.log(`Found ${data.length} rows with no details — deleting and re-fetching...`);
    await supabase.from(HISTORY_TABLE).delete().eq('history_date', date);
    return false;
  }
  return true;
}

const INDIA_RE = /\b(india|indian|mughal|delhi|mumbai|gandhi|nehru|pakistan|bangladesh|hindi|hindu|sikh|kolkata|calcutta|bombay|madras|chennai|british raj|raj|subcontinent|maharaja|tipu|ashoka|maurya|maratha|gupta|punjab|hyderabad|mysore|nawab|bengal|tamil|kerala|gujarat|rajasthan|bollywood|ipl|bcci)\b/;

function isIndia(text) {
  return INDIA_RE.test(text.toLowerCase());
}

function assignCategory(text) {
  const t = text.toLowerCase();
  if (INDIA_RE.test(t)) return 'India';
  if (/\b(discover|invent|scientist|physics|chemistry|astronomy|nasa|rocket|satellite|atom|dna|vaccine|medicine|laboratory|biology)\b/.test(t)) return 'Science';
  if (/\b(computer|internet|telephone|aircraft|automobile|software|technology|digital|electric|telegraph|launch|spacecraft)\b/.test(t)) return 'Technology';
  if (/\b(olympics|world cup|championship|tournament|football|cricket|tennis|basketball|baseball|athlete|stadium|medal)\b/.test(t)) return 'Sports';
  if (/\b(president|prime minister|parliament|election|constitution|revolution|independence|treaty|war|battle|military|coup|republic|assassination)\b/.test(t)) return 'Politics';
  if (/\b(earthquake|tsunami|hurricane|tornado|flood|fire|disaster|explosion|accident|crash|famine|plague|eruption|sinking)\b/.test(t)) return 'Disaster';
  if (/\b(artist|painting|music|symphony|opera|literature|novel|film|cinema|theater|theatre|poet|composer|author|book)\b/.test(t)) return 'Art';
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
  const births   = data.births   || [];
  const deaths   = data.deaths   || [];

  // Dedup by year (one event per year)
  const seen = new Set();
  const dedup = (arr, tag) => arr
    .filter(ev => ev.text && !seen.has(String(ev.year)))
    .map(ev => { seen.add(String(ev.year)); return { ...ev, _tag: tag }; });

  // 1. All "selected" (Wikipedia's own curated picks — most notable)
  const selPool    = dedup(selected, 'selected');
  // 2. India-specific from events + births + deaths
  const indiaEvs   = dedup([...events, ...births, ...deaths].filter(
    ev => isIndia(ev.text + ' ' + (ev.pages?.[0]?.title || ''))
  ), 'india');
  // 3. Remaining events to fill up to MAX_EVENTS
  const restEvs    = dedup(events, 'event');

  // Combine: selected first, then India, then rest — sorted by year ascending
  const combined = [...selPool, ...indiaEvs, ...restEvs].slice(0, MAX_EVENTS);
  combined.sort((a, b) => Number(a.year) - Number(b.year));

  const indiaCount = combined.filter(e => isIndia(e.text + ' ' + (e.pages?.[0]?.title || ''))).length;
  console.log(`Events: ${combined.length} total, ${selPool.length} selected, ${indiaCount} India-related`);
  return combined;
}

// MediaWiki action API — returns full intro section (typically 3–6 paragraphs)
// Falls back to REST summary if the action API returns too little text.
async function fetchWikiExtract(title) {
  if (!title) return '';

  // Primary: MediaWiki action API with full intro
  try {
    const params = new URLSearchParams({
      action:      'query',
      prop:        'extracts',
      exintro:     '1',
      explaintext: '1',
      redirects:   '1',
      titles:      title,
      format:      'json',
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
        if (text.length >= 100) {
          console.log(`    ✓ MediaWiki extract: ${text.length} chars`);
          return text.slice(0, 5000);
        }
      }
    }
  } catch (e) {
    console.warn(`    MediaWiki error for "${title}": ${e.message}`);
  }

  // Fallback: REST summary
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { headers: { 'User-Agent': 'NewsSphere/1.0 (history-pipeline)' } },
    );
    if (res.ok) {
      const json = await res.json();
      const text = (json.extract || '').trim();
      if (text.length >= 50) {
        console.log(`    ✓ REST summary fallback: ${text.length} chars`);
        return text.slice(0, 5000);
      }
    }
  } catch (e) {
    console.warn(`    REST summary error for "${title}": ${e.message}`);
  }

  console.warn(`    ✗ No extract found for "${title}"`);
  return '';
}

async function insertEvents(raw, date) {
  const rows = [];
  for (const ev of raw) {
    const yr     = String(ev.year || '').trim();
    const text   = String(ev.text || '').trim();
    const pTitle = ev.pages?.[0]?.title || '';
    const title  = makeTitle(text, pTitle).slice(0, 200);
    const desc   = text.slice(0, 1500);
    const cat    = assignCategory(text + ' ' + pTitle);
    if (!yr || !title || !desc) continue;

    console.log(`  [${yr}] ${title}`);
    const details = await fetchWikiExtract(pTitle);
    rows.push({ history_date: date, event_year: yr, title, description: desc, category: cat, details });
  }

  if (rows.length === 0) throw new Error('No valid rows after processing');

  const { error } = await supabase.from(HISTORY_TABLE).insert(rows);
  if (error) throw new Error(`Insert failed: ${error.message}`);

  const withDetails = rows.filter(r => r.details && r.details.length > 50).length;
  console.log(`\nInserted ${rows.length} events — ${withDetails} with details — for ${date}`);
}

async function cleanupOld() {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000);
  const cutoffStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(cutoff);

  console.log(`\nDeleting records before ${cutoffStr} (keeping ${KEEP_DAYS} days)...`);
  const { error } = await supabase
    .from(HISTORY_TABLE).delete().lt('history_date', cutoffStr);
  if (error) console.error(`Cleanup failed: ${error.message}`);
  else console.log('Cleanup complete.');
}

async function main() {
  const date = todayIST();
  const { month, day } = monthDayIST();
  console.log(`=== History pipeline: ${date} (${month}/${day}) ===\n`);

  if (await shouldSkip(date)) {
    console.log(`History for ${date} already exists with details — skipping fetch`);
  } else {
    const raw = await fetchFromWikipedia(month, day);
    await insertEvents(raw, date);
  }

  await cleanupOld();
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
