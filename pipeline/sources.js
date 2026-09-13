// Sources split into three groups for staggered pipelines.
// Group 1 (pipeline.yml,   :00/:30): India, World, Tech, Business       — 14 sources
// Group 2 (pipeline-2.yml, :15/:45): Science, Health, Sports, Entertainment, Crypto, Politics, Environment, Crime — 13 sources
// Group 3 (pipeline-3.yml, :10/:40): India-focused deep coverage         — 10 sources
export const SOURCES = [
  // ── INDIA (4) — Group 1 ─────────────────────────────────────────────
  // firstpost's RSS endpoint now serves an HTML app shell — replaced with India TV
  { id: 'indiatv',     group: 1, url: 'https://www.indiatvnews.com/rssnews/topstory-india.xml',                 type: 'rss', lang: 'en', country: 'in', category: 'India' },
  { id: 'toi-top',     group: 1, url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',              type: 'rss', lang: 'en', country: 'in', category: 'India' },
  { id: 'ht-india',    group: 1, url: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml',         type: 'rss', lang: 'en', country: 'in', category: 'India' },
  { id: 'the-hindu',   group: 1, url: 'https://www.thehindu.com/feeder/default.rss',                             type: 'rss', lang: 'en', country: 'in', category: 'India' },

  // ── WORLD (4) — Group 1 ─────────────────────────────────────────────
  { id: 'bbc-world',   group: 1, url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                            type: 'rss', lang: 'en', country: 'gb', category: 'World' },
  { id: 'aljazeera',   group: 1, url: 'https://www.aljazeera.com/xml/rss/all.xml',                              type: 'rss', lang: 'en', country: 'qa', category: 'World' },
  // rss.cnn.com is dead (TLS handshake fails) — replaced with NYT World
  { id: 'nyt-world',   group: 1, url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',                 type: 'rss', lang: 'en', country: 'us', category: 'World' },
  { id: 'guardian-world', group: 1, url: 'https://www.theguardian.com/world/rss',                               type: 'rss', lang: 'en', country: 'gb', category: 'World' },

  // ── TECH (3) — Group 1 ──────────────────────────────────────────────
  { id: 'techcrunch',  group: 1, url: 'https://techcrunch.com/feed/',                                           type: 'rss', lang: 'en', country: 'us', category: 'Tech' },
  { id: 'theverge',    group: 1, url: 'https://www.theverge.com/rss/index.xml',                                 type: 'rss', lang: 'en', country: 'us', category: 'Tech' },
  { id: 'hn-front',    group: 1, url: 'https://hn.algolia.com/api/v1/search?tags=front_page',                   type: 'hn',  lang: 'en', country: 'us', category: 'Tech' },

  // ── BUSINESS (3) — Group 1 ──────────────────────────────────────────
  { id: 'guardian-biz', group: 1, url: 'https://www.theguardian.com/business/rss',                              type: 'rss', lang: 'en', country: 'gb', category: 'Business' },
  { id: 'livemint',    group: 1, url: 'https://www.livemint.com/rss/markets',                                   type: 'rss', lang: 'en', country: 'in', category: 'Business' },
  { id: 'et-markets',  group: 1, url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',   type: 'rss', lang: 'en', country: 'in', category: 'Business' },

  // ── SCIENCE (2) — Group 2 ───────────────────────────────────────────
  { id: 'sciencedaily', group: 2, url: 'https://www.sciencedaily.com/rss/all.xml',                              type: 'rss',         lang: 'en', country: 'us', category: 'Science' },
  { id: 'spaceflight',  group: 2, url: 'https://api.spaceflightnewsapi.net/v4/articles/?limit=20',              type: 'spaceflight', lang: 'en', country: 'us', category: 'Science' },

  // ── HEALTH (2) — Group 2 ────────────────────────────────────────────
  { id: 'bbc-health',  group: 2, url: 'https://feeds.bbci.co.uk/news/health/rss.xml',                          type: 'rss', lang: 'en', country: 'gb', category: 'Health' },
  { id: 'who-news',    group: 2, url: 'https://www.who.int/rss-feeds/news-english.xml',                         type: 'rss', lang: 'en', country: 'ch', category: 'Health' },

  // ── SPORTS (2) — Group 2 ────────────────────────────────────────────
  { id: 'cricinfo',    group: 2, url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',             type: 'rss', lang: 'en', country: 'in', category: 'Sports' },
  // espn.com/espn/rss/news returns an empty HTTP 202 — replaced with BBC Sport
  { id: 'bbc-sport',   group: 2, url: 'https://feeds.bbci.co.uk/sport/rss.xml',                                type: 'rss', lang: 'en', country: 'gb', category: 'Sports' },

  // ── ENTERTAINMENT (2) — Group 2 ─────────────────────────────────────
  { id: 'variety',     group: 2, url: 'https://variety.com/feed/',                                              type: 'rss', lang: 'en', country: 'us', category: 'Entertainment' },
  { id: 'bollywood',   group: 2, url: 'https://www.bollywoodhungama.com/rss/news.xml',                          type: 'rss', lang: 'en', country: 'in', category: 'Entertainment' },

  // ── CRYPTO (2) — Group 2 ────────────────────────────────────────────
  { id: 'coindesk',      group: 2, url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',                      type: 'rss', lang: 'en', country: 'us', category: 'Crypto' },
  { id: 'cointelegraph', group: 2, url: 'https://cointelegraph.com/rss',                                        type: 'rss', lang: 'en', country: 'us', category: 'Crypto' },

  // ── POLITICS (2) — Group 2 ──────────────────────────────────────────
  // theprint.in/feed/ serves HTML now; the category feed still works
  { id: 'theprint',    group: 2, url: 'https://theprint.in/category/india/feed/',                               type: 'rss', lang: 'en', country: 'in', category: 'Politics' },
  // politicopicks.xml is 403 even for browsers; the rss.politico.com feed works
  { id: 'politico',    group: 2, url: 'https://rss.politico.com/politics-news.xml',                             type: 'rss', lang: 'en', country: 'us', category: 'Politics' },

  // ── ENVIRONMENT (1) — Group 2 ───────────────────────────────────────
  { id: 'guardian-env', group: 2, url: 'https://www.theguardian.com/environment/rss',                           type: 'rss', lang: 'en', country: 'gb', category: 'Environment' },

  // ── CRIME (1) — Group 2 ─────────────────────────────────────────────
  { id: 'krebs',       group: 2, url: 'https://krebsonsecurity.com/feed/',                                      type: 'rss', lang: 'en', country: 'us', category: 'Crime' },

  // ── INDIA DEEP COVERAGE (10) — Group 3 (:10/:40) ────────────────────
  // Dedicated India pipeline for maximum local news coverage
  { id: 'indian-express', group: 3, url: 'https://indianexpress.com/feed/',                                     type: 'rss', lang: 'en', country: 'in', category: 'India' },
  { id: 'india-today',    group: 3, url: 'https://www.indiatoday.in/rss/home',                                  type: 'rss', lang: 'en', country: 'in', category: 'India' },
  // ndtv.com/rss/latest is 403 even for browsers; the feedburner feed works
  { id: 'ndtv-latest',    group: 3, url: 'https://feeds.feedburner.com/ndtvnews-latest',                        type: 'rss', lang: 'en', country: 'in', category: 'India' },
  // scroll.in/feed serves HTML now; the feedburner feed works
  { id: 'scroll-in',      group: 3, url: 'https://feeds.feedburner.com/ScrollinArticles.rss',                   type: 'rss', lang: 'en', country: 'in', category: 'India' },
  // Deccan Herald removed all RSS endpoints (404/500) — replaced with TOI India
  { id: 'toi-india',      group: 3, url: 'https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms',        type: 'rss', lang: 'en', country: 'in', category: 'India' },
  { id: 'news18-india',   group: 3, url: 'https://www.news18.com/rss/india.xml',                                type: 'rss', lang: 'en', country: 'in', category: 'India' },
  // thequint.com/feeds/stories.rss is 404; stories.rss at the root works
  { id: 'the-quint',      group: 3, url: 'https://www.thequint.com/stories.rss',                                type: 'rss', lang: 'en', country: 'in', category: 'India' },
  { id: 'thenewsminute',  group: 3, url: 'https://www.thenewsminute.com/feed',                                  type: 'rss', lang: 'en', country: 'in', category: 'India' },
  { id: 'biz-standard',   group: 3, url: 'https://www.business-standard.com/rss/home_page_top_stories.rss',     type: 'rss', lang: 'en', country: 'in', category: 'India' },
  // outlookindia.com removed its RSS endpoints (404) — replaced with NDTV India
  { id: 'ndtv-india',     group: 3, url: 'https://feeds.feedburner.com/ndtvnews-india-news',                    type: 'rss', lang: 'en', country: 'in', category: 'India' },
];
