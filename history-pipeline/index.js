import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const HISTORY_TABLE = 'today_history';
const KEEP_DAYS     = 30;
const MAX_EVENTS    = 50; // events stored per day

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const pause = ms => new Promise(r => setTimeout(r, ms));

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

// Re-fetches if less than 60% of today's events have details — not just "some".
async function shouldSkip(date) {
  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select('id, details')
    .eq('history_date', date);
  if (error) throw new Error(`Supabase check failed: ${error.message}`);
  if (data.length === 0) return false;

  const withDetails = data.filter(r => r.details && r.details.length > 50).length;
  const ratio = withDetails / data.length;

  if (ratio < 0.6) {
    console.log(`Found ${data.length} rows but only ${withDetails} have details (${Math.round(ratio * 100)}%) — deleting and re-fetching...`);
    await supabase.from(HISTORY_TABLE).delete().eq('history_date', date);
    return false;
  }
  console.log(`${withDetails}/${data.length} events have details — skipping`);
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
  const clause = text.split(/[.,]/)[0].trim();
  const clean  = (pageTitle || '').replace(/_/g, ' ').trim();
  // Prefer the event-text clause — it's always specific to what happened.
  // Fall back to the page title only when the clause is too short to be useful.
  if (clause.length >= 20) return clause.length <= 90 ? clause : clause.slice(0, 87) + '...';
  if (clean && clean.length > 3 && clean.length < 80) return clean;
  return clause || clean;
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

  const seenText  = new Set();
  const selSeenYr = new Set();

  // selPool: curated picks, deduplicated by year (Wikipedia occasionally lists
  // two selected events from the same year which produces duplicate titles).
  const selPool = selected.filter(ev => ev.text).reduce((acc, ev) => {
    const yr = String(ev.year);
    if (selSeenYr.has(yr)) return acc;
    selSeenYr.add(yr);
    seenText.add(ev.text);
    acc.push({ ...ev, _tag: 'selected' });
    return acc;
  }, []);

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

  const combined = [...selPool, ...indiaPool, ...restPool].slice(0, MAX_EVENTS);
  combined.sort((a, b) => Number(a.year) - Number(b.year));

  console.log(`Events: ${combined.length} total | ${selPool.length} selected | ${indiaPool.length} India | ${Math.min(restPool.length, MAX_EVENTS - selPool.length - indiaPool.length)} general`);
  return combined;
}

// Fetch with automatic retry on 429 (rate limit) — up to 3 attempts.
async function wikiGet(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'NewsSphere/1.0 (history-pipeline)' },
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 429) {
        const wait = 4000 * (attempt + 1);
        console.warn(`    Wikipedia 429 — backing off ${wait / 1000}s (attempt ${attempt + 1}/3)`);
        await pause(wait);
        continue;
      }
      return res;
    } catch (err) {
      if (attempt === 2) {
        console.warn(`    Wikipedia fetch error: ${err.message}`);
        return null;
      }
      await pause(1000 * (attempt + 1));
    }
  }
  return null;
}

// Two-pass Wikipedia extract: MediaWiki exintro → REST summary.
// Both passes go through wikiGet so 429s are retried automatically.
async function extractByTitle(title) {
  if (!title) return '';

  // Pass 1: MediaWiki action API — full intro section (cleanest text)
  try {
    const params = new URLSearchParams({
      action: 'query', prop: 'extracts',
      exintro: '1', explaintext: '1', redirects: '1',
      titles: title, format: 'json',
    });
    const res = await wikiGet(`https://en.wikipedia.org/w/api.php?${params}`);
    if (res?.ok) {
      const json = await res.json();
      const page = Object.values(json?.query?.pages || {})[0];
      if (page && !page.missing && page.extract) {
        const t = page.extract.trim();
        if (t.length >= 50) return t.slice(0, 5000);
      }
    }
  } catch {}

  await pause(400);

  // Pass 2: REST summary API (shorter but rock-solid, different CDN path)
  try {
    const encoded = encodeURIComponent((title).replace(/ /g, '_'));
    const res = await wikiGet(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`
    );
    if (res?.ok) {
      const json = await res.json();
      const t = (json.extract || '').trim();
      if (t.length >= 50) return t.slice(0, 5000);
    }
  } catch {}

  return '';
}

// Search Wikipedia for the most relevant article title.
async function searchWikiTitle(query) {
  try {
    const params = new URLSearchParams({
      action: 'query', list: 'search',
      srsearch: query, srlimit: '1', format: 'json',
    });
    const res = await wikiGet(`https://en.wikipedia.org/w/api.php?${params}`);
    if (!res?.ok) return '';
    const json = await res.json();
    return json?.query?.search?.[0]?.title || '';
  } catch { return ''; }
}

// Generate a factual write-up using Gemini AI when Wikipedia has nothing.
// Tries gemini-2.0-flash first (faster), falls back to gemini-1.5-flash.
async function generateWithGemini(title, year, desc) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return '';

  const prompt =
    `Write a factual, educational 2-3 paragraph description about this historical event ` +
    `for a "Today in History" feature:\n\nEvent: ${title} (${year})\nContext: ${desc}\n\n` +
    `Write in engaging plain prose. No markdown, no bullet points, no headers.`;

  for (const model of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 700, temperature: 0.2 },
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.warn(`    Gemini ${model} HTTP ${res.status}: ${errBody.slice(0, 120)}`);
        await pause(500);
        continue;
      }
      const json = await res.json();
      const text = (json?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      if (text.length >= 100) {
        console.log(`    ✓ Gemini (${model}): ${text.length} chars`);
        return text.slice(0, 5000);
      }
      console.warn(`    Gemini ${model} returned too-short text: "${text.slice(0, 60)}..."`);
    } catch (err) {
      console.warn(`    Gemini ${model} error: ${err.message}`);
    }
    await pause(500);
  }
  return '';
}

// Four-tier extraction: linked pages → event search → short search → Gemini AI
async function fetchWikiExtract(pageTitles, eventText) {
  const tried = new Set();

  // Tier 1: all linked page titles (cap at 3 to limit API calls)
  for (const title of pageTitles.slice(0, 3)) {
    tried.add(title);
    const extract = await extractByTitle(title);
    if (extract.length >= 50) {
      console.log(`    ✓ "${title}": ${extract.length} chars`);
      return extract;
    }
    await pause(400);
  }

  // Tier 2: Wikipedia search with first clause of the event text
  const clause = eventText.split(/[.,;]/)[0].trim().slice(0, 100);
  const found2 = await searchWikiTitle(clause);
  if (found2 && !tried.has(found2)) {
    tried.add(found2);
    await pause(300);
    const extract = await extractByTitle(found2);
    if (extract.length >= 50) {
      console.log(`    ✓ Search→"${found2}": ${extract.length} chars`);
      return extract;
    }
  }

  // Tier 3: shorter search using just the first six words
  const short = eventText.split(' ').slice(0, 6).join(' ');
  if (short !== clause) {
    const found3 = await searchWikiTitle(short);
    if (found3 && !tried.has(found3)) {
      tried.add(found3);
      await pause(300);
      const extract = await extractByTitle(found3);
      if (extract.length >= 50) {
        console.log(`    ✓ ShortSearch→"${found3}": ${extract.length} chars`);
        return extract;
      }
    }
  }

  console.warn(`    ✗ No Wikipedia extract (tried: ${[...tried].slice(0, 2).join(', ') || 'none'})`);
  return '';
}

async function insertEvents(raw, date) {
  const rows = [];
  for (const ev of raw) {
    const yr       = String(ev.year || '').trim();
    const text     = String(ev.text || '').trim();
    const pages    = (ev.pages || []).map(p => p.title).filter(Boolean);
    const pTitle   = pages[0] || '';
    const title    = makeTitle(text, pTitle).slice(0, 200);
    const desc     = text.slice(0, 1500);
    const cat      = assignCategory(text + ' ' + pTitle);
    if (!yr || !title || !desc) continue;

    console.log(`  [${yr}] ${title} (${pages.length} pages)`);
    let details = await fetchWikiExtract(pages, text);
    if (details.length < 50) details = await generateWithGemini(title, yr, desc);
    if (details.length < 50) console.warn(`    ✗ No details obtained for: ${title}`);
    rows.push({ history_date: date, event_year: yr, title, description: desc, category: cat, details });

    await pause(500); // polite gap between events
  }

  if (rows.length === 0) throw new Error('No valid rows after processing');

  // Final dedup by title — catches any same-titled events that slipped through
  // the pool logic (e.g. same page linked from both selected and general pools).
  const seen = new Set();
  const uniqueRows = rows.filter(r => {
    const key = r.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (uniqueRows.length < rows.length) {
    console.log(`Deduped ${rows.length - uniqueRows.length} duplicate title(s) before insert`);
  }

  const { error } = await supabase.from(HISTORY_TABLE).insert(uniqueRows);
  if (error) throw new Error(`Insert failed: ${error.message}`);

  const withDetails = uniqueRows.filter(r => r.details && r.details.length > 50).length;
  console.log(`\nInserted ${uniqueRows.length} events — ${withDetails} with details — for ${date}`);
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
  console.log(`=== History pipeline: ${date} (${month}/${day}) ===`);
  console.log(`Gemini AI: ${process.env.GEMINI_API_KEY ? 'enabled' : '⚠ GEMINI_API_KEY not set — AI fallback disabled'}\n`);

  if (await shouldSkip(date)) {
    console.log(`History for ${date} is complete — skipping fetch`);
  } else {
    const raw = await fetchFromWikipedia(month, day);
    await insertEvents(raw, date);
  }

  await cleanupOld();
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
