import Parser from 'rss-parser';
import { ITEMS_PER_FEED } from './config.js';
import { SOURCES } from './sources.js';

const rssParser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'NewsSphereBot/2.0 (+https://github.com/neilsahani55/NewsSphere)',
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

function extractImage(item) {
  if (item.enclosure?.url && /\.(jpg|jpeg|png|webp|gif)/i.test(item.enclosure.url)) {
    return item.enclosure.url;
  }
  if (item.mediaContent?.['$']?.url) return item.mediaContent['$'].url;
  if (item.mediaThumbnail?.['$']?.url) return item.mediaThumbnail['$'].url;
  const html = item.contentEncoded || item.content || item['content:encoded'] || item.summary || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)/i);
  return m ? m[1] : '';
}

function cleanText(s) {
  if (!s) return '';
  return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(url) {
  if (!url) return '';
  return String(url)
    .replace(/[?&]utm_[a-z_]+=[^&]*/gi, '')
    .replace(/[?&](fbclid|gclid|ref|source|mc_eid|mc_cid)=[^&]*/gi, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '')
    .replace(/\/+$/, '')
    .trim();
}

function toISO(raw) {
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  if (isNaN(d)) return new Date().toISOString();
  // Reject future dates (>24h) or ancient dates (>5 years)
  const now = Date.now();
  if (d.getTime() > now + 86400000) return new Date().toISOString();
  if (d.getTime() < now - 5 * 365 * 86400000) return new Date().toISOString();
  return d.toISOString();
}

async function fetchRSS(source) {
  try {
    const feed = await rssParser.parseURL(source.url);
    return (feed.items || []).slice(0, ITEMS_PER_FEED).map(item => ({
      article_url: normalizeUrl(item.link || item.guid || ''),
      title: cleanText(item.title || ''),
      description: cleanText(item.contentSnippet || item.summary || '').slice(0, 500),
      image_url: extractImage(item),
      published_at: toISO(item.pubDate || item.isoDate),
      source_name: cleanText(feed.title || source.id),
      category: source.category,
      country: source.country,
      language: source.lang,
    })).filter(a => a.article_url && a.title && a.article_url.startsWith('http'));
  } catch (e) {
    console.warn(`  [${source.id}] RSS failed: ${e.message}`);
    return [];
  }
}

async function fetchHackerNews(source) {
  try {
    const res = await fetch(source.url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json.hits || []).slice(0, ITEMS_PER_FEED).map(a => ({
      article_url: normalizeUrl(a.url || `https://news.ycombinator.com/item?id=${a.objectID}`),
      title: cleanText(a.title || a.story_title || ''),
      description: cleanText(a.story_text || '').slice(0, 500),
      image_url: '',
      published_at: toISO(a.created_at),
      source_name: 'Hacker News',
      category: source.category,
      country: source.country,
      language: source.lang,
    })).filter(a => a.article_url && a.title);
  } catch (e) {
    console.warn(`  [${source.id}] HN failed: ${e.message}`);
    return [];
  }
}

async function fetchSpaceflight(source) {
  try {
    const res = await fetch(source.url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json.results || []).slice(0, ITEMS_PER_FEED).map(a => ({
      article_url: normalizeUrl(a.url || ''),
      title: cleanText(a.title || ''),
      description: cleanText(a.summary || '').slice(0, 500),
      image_url: a.image_url || '',
      published_at: toISO(a.published_at),
      source_name: cleanText(a.news_site || 'Spaceflight News'),
      category: source.category,
      country: source.country,
      language: source.lang,
    })).filter(a => a.article_url && a.title);
  } catch (e) {
    console.warn(`  [${source.id}] Spaceflight failed: ${e.message}`);
    return [];
  }
}

export async function fetchAllSources(group = null) {
  const activeSources = group ? SOURCES.filter(s => s.group === group) : SOURCES;
  console.log(`  Sources active: ${activeSources.length}${group ? ` (group ${group})` : ''}`);

  const results = await Promise.allSettled(
    activeSources.map(src => {
      if (src.type === 'hn')          return fetchHackerNews(src);
      if (src.type === 'spaceflight') return fetchSpaceflight(src);
      return fetchRSS(src);
    })
  );

  const articles = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`  [${activeSources[i].id}] ${r.value.length} articles`);
      articles.push(...r.value);
    } else {
      console.warn(`  [${activeSources[i].id}] rejected: ${r.reason?.message}`);
    }
  });

  // Deduplicate by URL within this batch
  const seen = new Set();
  return articles.filter(a => {
    if (!a.article_url || seen.has(a.article_url)) return false;
    seen.add(a.article_url);
    return true;
  });
}
