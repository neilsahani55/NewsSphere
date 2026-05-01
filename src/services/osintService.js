// OSINT (Open Source Intelligence) helpers for the Reader.
//
// Pulls together publicly-available context about an article:
//   1. Entity extraction — pulls likely proper nouns from the title/description.
//   2. Wikipedia enrichment — fetches a one-paragraph summary for each entity
//      via the CORS-friendly REST API (no key required).
//   3. Related stories — finds articles in the same sheet that mention the
//      same entities, surfacing cross-source coverage.
//   4. Archive link — Wayback Machine URL for stable, citable references.

const WIKI_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

// Common capitalised words that are NOT entities (sentence starters, common nouns).
const STOP_WORDS = new Set([
  // Articles / pronouns / determiners
  'The', 'A', 'An', 'This', 'That', 'These', 'Those', 'It', 'Its',
  'He', 'She', 'They', 'We', 'You', 'I', 'My', 'Our', 'Their', 'Her', 'His',
  // Conjunctions & prepositions (that often start sentences)
  'But', 'And', 'Or', 'Not', 'Yet', 'So', 'For', 'Nor',
  'On', 'In', 'Of', 'At', 'By', 'To', 'With', 'From', 'Into', 'Onto', 'Upon',
  'About', 'After', 'Before', 'Under', 'Over', 'During', 'Through', 'Across',
  // Question / discourse words
  'However', 'Although', 'Because', 'Since', 'While', 'When', 'Where', 'Why', 'How',
  'What', 'Which', 'Who', 'Whom', 'Whose',
  // Time
  'Now', 'New', 'Old', 'Today', 'Yesterday', 'Tomorrow',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
  // Modal verbs / auxiliaries
  'Will', 'Would', 'Could', 'Should', 'Must', 'Might', 'Can',
  'Says', 'Said', 'Did', 'Has', 'Have', 'Had',
  // Generic news vocab
  'News', 'Report', 'Reports', 'Update', 'Breaking', 'Latest',
]);

// Pulls proper-noun candidates: 1-3 capitalised words in a row, plus all-caps
// acronyms (3-6 letters). Imperfect — but it's a heuristic, not a parser, and
// failures are silent (Wikipedia returns 404 → entity is dropped from the panel).
export function extractEntities(text, limit = 6) {
  if (!text) return [];
  const candidates = [];

  const phraseRe = /\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2}\b/g;
  for (const m of text.matchAll(phraseRe)) candidates.push(m[0]);

  const acronymRe = /\b[A-Z]{3,6}\b/g;
  for (const m of text.matchAll(acronymRe)) candidates.push(m[0]);

  const seen = new Set();
  const out = [];
  for (const raw of candidates) {
    const e = raw.trim();
    if (e.length < 3) continue;
    if (STOP_WORDS.has(e)) continue;
    const k = e.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

// Look up one entity on Wikipedia. Follows redirects (so "Modi" → "Narendra Modi"),
// rejects disambiguation pages, returns null on any failure so the UI can filter.
export async function lookupWikipedia(entity, signal) {
  if (!entity) return null;
  const url = `${WIKI_SUMMARY}${encodeURIComponent(entity)}?redirect=true`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.extract) return null;
    if (data.type === 'disambiguation') return null;
    return {
      query: entity,
      title: data.title,
      description: data.description || '',
      extract: data.extract,
      url: data.content_urls?.desktop?.page
        || `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title.replace(/\s+/g, '_'))}`,
      thumbnail: data.thumbnail?.source || null,
    };
  } catch {
    return null;
  }
}

// Finds other articles in the feed that mention any of the same entities.
// Score = number of entity matches; ties broken by recency.
export function findRelatedArticles(currentArticle, allArticles, limit = 5) {
  if (!currentArticle || !allArticles?.length) return [];
  const text = `${currentArticle.title || ''} ${currentArticle.description || ''}`;
  const entities = extractEntities(text, 8);
  if (entities.length === 0) return [];
  const needles = entities.map((e) => e.toLowerCase());

  const scored = [];
  for (const a of allArticles) {
    if (!a.article_url || a.article_url === currentArticle.article_url) continue;
    const haystack = `${a.title || ''} ${a.description || ''}`.toLowerCase();
    let score = 0;
    for (const n of needles) {
      if (haystack.includes(n)) score++;
    }
    if (score > 0) scored.push({ article: a, score });
  }

  scored.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    const xt = new Date(x.article.published_at_ist || x.article.fetched_at_ist || 0).getTime();
    const yt = new Date(y.article.published_at_ist || y.article.fetched_at_ist || 0).getTime();
    return yt - xt;
  });

  return scored.slice(0, limit).map((s) => s.article);
}

// Builds a set of "external investigation" URLs for the article. All point to
// public search/lookup pages on third-party sites (no API keys, no CORS, just
// links the user clicks). They're chosen to give multiple angles on a story:
// other coverage, image authenticity, public discussion.
export function externalInvestigations(article) {
  if (!article) return [];

  // Headline-based query — strips trailing source name suffixes like
  // " - The Hindu" that hurt search precision.
  const rawTitle = String(article.title || '').replace(/\s+[-–|]\s+[^-–|]+$/, '').trim();
  const q = rawTitle || article.description || '';
  const eq = encodeURIComponent(q);
  const out = [];

  if (q) {
    out.push({
      id: 'gnews',
      label: 'Other coverage',
      title: 'Search Google News for this story',
      url: `https://news.google.com/search?q=${eq}&hl=en`,
      icon: 'globe',
    });
    out.push({
      id: 'bing',
      label: 'Web search',
      title: 'Search Bing for the headline',
      url: `https://www.bing.com/search?q=${eq}`,
      icon: 'search',
    });
    out.push({
      id: 'twitter',
      label: 'Discussion on X',
      title: 'See what people on X are saying',
      url: `https://x.com/search?q=${eq}&f=live`,
      icon: 'x',
    });
    out.push({
      id: 'reddit',
      label: 'Reddit threads',
      title: 'Find Reddit discussions of this story',
      url: `https://www.reddit.com/search/?q=${eq}&type=link&sort=new`,
      icon: 'reddit',
    });
  }

  if (article.image_url) {
    const img = encodeURIComponent(article.image_url);
    out.push({
      id: 'lens',
      label: 'Reverse image · Lens',
      title: 'Verify the article image with Google Lens',
      url: `https://lens.google.com/uploadbyurl?url=${img}`,
      icon: 'image',
    });
    out.push({
      id: 'tineye',
      label: 'Reverse image · TinEye',
      title: 'Find earlier copies of the image with TinEye',
      url: `https://tineye.com/search/?url=${img}`,
      icon: 'eye',
    });
  }

  return out;
}
