import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const HISTORY_TABLE = 'today_history';
const KEEP_DAYS     = 30;
const MAX_EVENTS    = 40; // events stored per day

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// Add 90 min so that when run at 23:00 IST (17:30 UTC) we resolve to the
// upcoming day's date, and a backup run at 00:30 IST still resolves correctly.
function targetDate() {
  return new Date(Date.now() + 90 * 60 * 1000);
}

function todayIST() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(targetDate());
}

function monthDayIST() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', month: '2-digit', day: '2-digit',
  }).formatToParts(targetDate());
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

const INDIA_RE = /\b(india|indian|mughal|delhi|mumbai|gandhi|nehru|pakistan|bangladesh|hindi|hindu|sikh|kolkata|calcutta|bombay|madras|chennai|british raj|subcontinent|maharaja|tipu|tipu sultan|ashoka|maurya|maratha|gupta|punjab|hyderabad|mysore|nawab|bengal|tamil|kerala|gujarat|rajasthan|bollywood|ipl|bcci|cricket|hindustan|ambedkar|sardar patel|vallabhbhai|subhas chandra|netaji|bal gangadhar|tilak|gokhale|aurangzeb|akbar|babur|humayun|shah jahan|chandragupta|chola|vijayanagara|peshwa|nizam|deccan|bengaluru|bangalore|pune|patna|bhopal|lucknow|varanasi|agra|jaipur|ahmedabad|surat|guwahati|isro|chandrayaan|mangalyaan|indira|vajpayee|manmohan|narendra modi|kashmir|kargil|partition|andhra|karnataka|odisha|assam|goa|manipur|nagaland|tripura|meghalaya|sikkim|haryana|uttarakhand|jharkhand|chhattisgarh|rupee|reserve bank of india|east india company|indian national congress|indian mutiny|sepoy mutiny|dandi|salt march|quit india|non-cooperation|swadeshi|jallianwala|amritsar massacre|indian ocean|bay of bengal|arabian sea|himalayas|ganges|brahmaputra|indus)\b/;

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
  // Wikipedia page titles sometimes come with underscores instead of spaces
  const clean = (pageTitle || '').replace(/_/g, ' ').trim();
  if (clean && clean.length > 3 && clean.length < 80) return clean;
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
  const allItems = [...events, ...births, ...deaths];

  // seenText prevents the exact same event appearing twice across pools
  const seenText = new Set();

  // Pool 1: Wikipedia's curated highlights (all of them, usually 5-10)
  const selPool = selected.filter(ev => ev.text).map(ev => {
    seenText.add(ev.text);
    return { ...ev, _tag: 'selected' };
  });

  // Pool 2: India events with their OWN year-dedup — not blocked by selPool.
  // A year can appear in both selPool and indiaPool (different events).
  const indiaSeenYr = new Set();
  const indiaPool = allItems.reduce((acc, ev) => {
    const yr = String(ev.year);
    if (!ev.text || seenText.has(ev.text) || indiaSeenYr.has(yr)) return acc;
    if (!isIndia(ev.text + ' ' + (ev.pages?.[0]?.title || ''))) return acc;
    indiaSeenYr.add(yr);
    seenText.add(ev.text);
    acc.push({ ...ev, _tag: 'india' });
    return acc;
  }, []);

  // Pool 3: General events (events + births + deaths) to fill remaining slots.
  // Skip years already used in selPool OR indiaPool to avoid repetition.
  const usedYears = new Set([
    ...selPool.map(e => String(e.year)),
    ...indiaPool.map(e => String(e.year)),
  ]);
  const restPool = allItems.reduce((acc, ev) => {
    const yr = String(ev.year);
    if (!ev.text || seenText.has(ev.text) || usedYears.has(yr)) return acc;
    usedYears.add(yr);
    seenText.add(ev.text);
    acc.push({ ...ev, _tag: 'event' });
    return acc;
  }, []);

  // Combine: selected → india → rest, cap at MAX_EVENTS, sort by year
  const combined = [...selPool, ...indiaPool, ...restPool].slice(0, MAX_EVENTS);
  combined.sort((a, b) => Number(a.year) - Number(b.year));

  console.log(`Events: ${combined.length} total | ${selPool.length} selected | ${indiaPool.length} India | ${Math.min(restPool.length, MAX_EVENTS - selPool.length - indiaPool.length)} general`);
  return combined;
}

// Fetch full intro extract from Wikipedia's MediaWiki action API
async function extractByTitle(title) {
  if (!title) return '';
  try {
    const params = new URLSearchParams({
      action: 'query', prop: 'extracts',
      exintro: '1', explaintext: '1', redirects: '1',
      titles: title, format: 'json',
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: { 'User-Agent': 'NewsSphere/1.0 (history-pipeline)' },
    });
    if (!res.ok) return '';
    const json = await res.json();
    const page = Object.values(json?.query?.pages || {})[0];
    if (page && !page.missing && page.extract) {
      const t = page.extract.trim();
      if (t.length >= 80) return t.slice(0, 5000);
    }
  } catch {}

  // REST summary fallback (shorter but reliable)
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { headers: { 'User-Agent': 'NewsSphere/1.0 (history-pipeline)' } },
    );
    if (res.ok) {
      const json = await res.json();
      const t = (json.extract || '').trim();
      if (t.length >= 50) return t.slice(0, 5000);
    }
  } catch {}

  return '';
}

// Search Wikipedia for the most relevant article title given a query string
async function searchWikiTitle(query) {
  try {
    const params = new URLSearchParams({
      action: 'query', list: 'search',
      srsearch: query, srlimit: '1', format: 'json',
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: { 'User-Agent': 'NewsSphere/1.0 (history-pipeline)' },
    });
    if (!res.ok) return '';
    const json = await res.json();
    return json?.query?.search?.[0]?.title || '';
  } catch { return ''; }
}

// Three-tier extraction:
//  1. Linked Wikipedia page title (direct)
//  2. REST summary of same title (shorter)
//  3. Wikipedia search using the event text → fetch that article
async function fetchWikiExtract(pageTitle, eventText) {
  // Tier 1 & 2: direct title lookup
  if (pageTitle) {
    const extract = await extractByTitle(pageTitle);
    if (extract.length >= 80) {
      console.log(`    ✓ Direct "${pageTitle}": ${extract.length} chars`);
      return extract;
    }
  }

  // Tier 3: search Wikipedia with the event description
  const query = eventText.slice(0, 120);
  const found = await searchWikiTitle(query);
  if (found && found !== pageTitle) {
    const extract = await extractByTitle(found);
    if (extract.length >= 80) {
      console.log(`    ✓ Search→"${found}": ${extract.length} chars`);
      return extract;
    }
  }

  console.warn(`    ✗ No extract (title="${pageTitle}")`);
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
    const details = await fetchWikiExtract(pTitle, text);
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
