// 27 curated, high-quality sources — one or two per topic.
// Reduced from 70+ so every article gets proper AI attention.
export const SOURCES = [
  // ── INDIA (4) ────────────────────────────────────────────────────────
  { id: 'ndtv-top',    url: 'https://feeds.feedburner.com/ndtvnews-top-stories',                       type: 'rss',         lang: 'en', country: 'in', category: 'India' },
  { id: 'toi-top',     url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',              type: 'rss',         lang: 'en', country: 'in', category: 'India' },
  { id: 'india-today', url: 'https://www.indiatoday.in/rss/home',                                     type: 'rss',         lang: 'en', country: 'in', category: 'India' },
  { id: 'the-hindu',   url: 'https://www.thehindu.com/feeder/default.rss',                             type: 'rss',         lang: 'en', country: 'in', category: 'India' },

  // ── WORLD (4) ────────────────────────────────────────────────────────
  { id: 'bbc-world',   url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                            type: 'rss',         lang: 'en', country: 'gb', category: 'World' },
  { id: 'aljazeera',   url: 'https://www.aljazeera.com/xml/rss/all.xml',                              type: 'rss',         lang: 'en', country: 'qa', category: 'World' },
  { id: 'dw-world',    url: 'https://rss.dw.com/rdf/rss-en-all',                                      type: 'rss',         lang: 'en', country: 'de', category: 'World' },
  { id: 'france24',    url: 'https://www.france24.com/en/rss',                                        type: 'rss',         lang: 'en', country: 'fr', category: 'World' },

  // ── TECH (3) ─────────────────────────────────────────────────────────
  { id: 'techcrunch',  url: 'https://techcrunch.com/feed/',                                           type: 'rss',         lang: 'en', country: 'us', category: 'Tech' },
  { id: 'theverge',    url: 'https://www.theverge.com/rss/index.xml',                                 type: 'rss',         lang: 'en', country: 'us', category: 'Tech' },
  { id: 'hn-front',    url: 'https://hn.algolia.com/api/v1/search?tags=front_page',                   type: 'hn',          lang: 'en', country: 'us', category: 'Tech' },

  // ── BUSINESS (3) ─────────────────────────────────────────────────────
  { id: 'livemint',    url: 'https://www.livemint.com/rss/markets',                                   type: 'rss',         lang: 'en', country: 'in', category: 'Business' },
  { id: 'bloomberg',   url: 'https://feeds.bloomberg.com/markets/news.rss',                           type: 'rss',         lang: 'en', country: 'us', category: 'Business' },
  { id: 'et-markets',  url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',   type: 'rss',         lang: 'en', country: 'in', category: 'Business' },

  // ── SCIENCE (2) ──────────────────────────────────────────────────────
  { id: 'sciencedaily', url: 'https://www.sciencedaily.com/rss/all.xml',                              type: 'rss',         lang: 'en', country: 'us', category: 'Science' },
  { id: 'spaceflight',  url: 'https://api.spaceflightnewsapi.net/v4/articles/?limit=20',              type: 'spaceflight', lang: 'en', country: 'us', category: 'Science' },

  // ── HEALTH (2) ───────────────────────────────────────────────────────
  { id: 'bbc-health',  url: 'https://feeds.bbci.co.uk/news/health/rss.xml',                          type: 'rss',         lang: 'en', country: 'gb', category: 'Health' },
  { id: 'who-news',    url: 'https://www.who.int/rss-feeds/news-english.xml',                         type: 'rss',         lang: 'en', country: 'ch', category: 'Health' },

  // ── SPORTS (2) ───────────────────────────────────────────────────────
  { id: 'cricinfo',    url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',             type: 'rss',         lang: 'en', country: 'in', category: 'Sports' },
  { id: 'espn',        url: 'https://www.espn.com/espn/rss/news',                                    type: 'rss',         lang: 'en', country: 'us', category: 'Sports' },

  // ── ENTERTAINMENT (2) ────────────────────────────────────────────────
  { id: 'variety',     url: 'https://variety.com/feed/',                                              type: 'rss',         lang: 'en', country: 'us', category: 'Entertainment' },
  { id: 'bollywood',   url: 'https://www.bollywoodhungama.com/rss/news.xml',                          type: 'rss',         lang: 'en', country: 'in', category: 'Entertainment' },

  // ── CRYPTO (2) ───────────────────────────────────────────────────────
  { id: 'coindesk',      url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',                      type: 'rss',         lang: 'en', country: 'us', category: 'Crypto' },
  { id: 'cointelegraph', url: 'https://cointelegraph.com/rss',                                        type: 'rss',         lang: 'en', country: 'us', category: 'Crypto' },

  // ── POLITICS (2) ─────────────────────────────────────────────────────
  { id: 'theprint',    url: 'https://theprint.in/feed/',                                              type: 'rss',         lang: 'en', country: 'in', category: 'Politics' },
  { id: 'politico',    url: 'https://www.politico.com/rss/politicopicks.xml',                         type: 'rss',         lang: 'en', country: 'us', category: 'Politics' },

  // ── ENVIRONMENT (1) ──────────────────────────────────────────────────
  { id: 'guardian-env', url: 'https://www.theguardian.com/environment/rss',                           type: 'rss',         lang: 'en', country: 'gb', category: 'Environment' },

  // ── CRIME (1) ────────────────────────────────────────────────────────
  { id: 'krebs',       url: 'https://krebsonsecurity.com/feed/',                                      type: 'rss',         lang: 'en', country: 'us', category: 'Crime' },
];
