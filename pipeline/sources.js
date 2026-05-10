// 27 curated sources — split into two groups for staggered pipelines.
// Group 1 (pipeline.yml,  :00/:30): India, World, Tech, Business  — 14 sources
// Group 2 (pipeline-2.yml,:15/:45): Science, Health, Sports, Entertainment, Crypto, Politics, Environment, Crime — 13 sources
export const SOURCES = [
  // ── INDIA (4) — Group 1 ─────────────────────────────────────────────
  // NDTV direct RSS (feedburner retired)
  { id: 'ndtv-top',    group: 1, url: 'https://www.ndtv.com/rss/top-stories',                                   type: 'rss', lang: 'en', country: 'in', category: 'India' },
  { id: 'toi-top',     group: 1, url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',              type: 'rss', lang: 'en', country: 'in', category: 'India' },
  // India Today replaced with Hindustan Times (more bot-friendly)
  { id: 'ht-india',    group: 1, url: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml',         type: 'rss', lang: 'en', country: 'in', category: 'India' },
  { id: 'the-hindu',   group: 1, url: 'https://www.thehindu.com/feeder/default.rss',                             type: 'rss', lang: 'en', country: 'in', category: 'India' },

  // ── WORLD (4) — Group 1 ─────────────────────────────────────────────
  { id: 'bbc-world',   group: 1, url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                            type: 'rss', lang: 'en', country: 'gb', category: 'World' },
  { id: 'aljazeera',   group: 1, url: 'https://www.aljazeera.com/xml/rss/all.xml',                              type: 'rss', lang: 'en', country: 'qa', category: 'World' },
  { id: 'reuters-world', group: 1, url: 'https://feeds.reuters.com/reuters/worldNews',                          type: 'rss', lang: 'en', country: 'us', category: 'World' },
  { id: 'guardian-world', group: 1, url: 'https://www.theguardian.com/world/rss',                               type: 'rss', lang: 'en', country: 'gb', category: 'World' },

  // ── TECH (3) — Group 1 ──────────────────────────────────────────────
  { id: 'techcrunch',  group: 1, url: 'https://techcrunch.com/feed/',                                           type: 'rss', lang: 'en', country: 'us', category: 'Tech' },
  { id: 'theverge',    group: 1, url: 'https://www.theverge.com/rss/index.xml',                                 type: 'rss', lang: 'en', country: 'us', category: 'Tech' },
  { id: 'hn-front',    group: 1, url: 'https://hn.algolia.com/api/v1/search?tags=front_page',                   type: 'hn',  lang: 'en', country: 'us', category: 'Tech' },

  // ── BUSINESS (3) — Group 1 ──────────────────────────────────────────
  // Bloomberg replaced with Reuters Business (Bloomberg blocks bots)
  { id: 'reuters-biz', group: 1, url: 'https://feeds.reuters.com/reuters/businessNews',                         type: 'rss', lang: 'en', country: 'us', category: 'Business' },
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
  { id: 'espn',        group: 2, url: 'https://www.espn.com/espn/rss/news',                                    type: 'rss', lang: 'en', country: 'us', category: 'Sports' },

  // ── ENTERTAINMENT (2) — Group 2 ─────────────────────────────────────
  { id: 'variety',     group: 2, url: 'https://variety.com/feed/',                                              type: 'rss', lang: 'en', country: 'us', category: 'Entertainment' },
  { id: 'bollywood',   group: 2, url: 'https://www.bollywoodhungama.com/rss/news.xml',                          type: 'rss', lang: 'en', country: 'in', category: 'Entertainment' },

  // ── CRYPTO (2) — Group 2 ────────────────────────────────────────────
  { id: 'coindesk',      group: 2, url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',                      type: 'rss', lang: 'en', country: 'us', category: 'Crypto' },
  { id: 'cointelegraph', group: 2, url: 'https://cointelegraph.com/rss',                                        type: 'rss', lang: 'en', country: 'us', category: 'Crypto' },

  // ── POLITICS (2) — Group 2 ──────────────────────────────────────────
  { id: 'theprint',    group: 2, url: 'https://theprint.in/feed/',                                              type: 'rss', lang: 'en', country: 'in', category: 'Politics' },
  { id: 'politico',    group: 2, url: 'https://www.politico.com/rss/politicopicks.xml',                         type: 'rss', lang: 'en', country: 'us', category: 'Politics' },

  // ── ENVIRONMENT (1) — Group 2 ───────────────────────────────────────
  { id: 'guardian-env', group: 2, url: 'https://www.theguardian.com/environment/rss',                           type: 'rss', lang: 'en', country: 'gb', category: 'Environment' },

  // ── CRIME (1) — Group 2 ─────────────────────────────────────────────
  { id: 'krebs',       group: 2, url: 'https://krebsonsecurity.com/feed/',                                      type: 'rss', lang: 'en', country: 'us', category: 'Crime' },
];
