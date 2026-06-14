# NewsSphere

> News intelligence beyond the headline.

NewsSphere is a multilingual news intelligence dashboard built with React, Supabase, GitHub
Actions, and Vercel. It aggregates news across 12 categories, enriches articles with AI,
supports translation and personalization, and layers in utility widgets such as markets,
weather, AQI, fuel prices, holidays, and live sports.

The current app includes the previously separate sports score service directly inside the main
project, so the homepage now ships with a first-party multi-provider sports widget instead of
depending on a separate Express app.

## Features

### News feed
- Multi-source aggregation across 12 categories: India, World, Tech, Business, Science, Health,
  Sports, Entertainment, Crypto, Politics, Environment, and Crime
- AI-enriched articles with summaries, key points, cleaned previews, and sentiment metadata
- Articles are hidden until enrichment is complete, which avoids half-processed rows in the UI
- Home page editorial layout with top stories, category sections, and image-prioritized featured cards

### Home widgets
- Markets strip with compact mobile horizontal scrolling
- Weather and AQI badges in the daily briefing header
- Fuel prices widget using live city/state-aware price lookup
- Holidays & Festivals widget with upcoming Indian public holidays and derived observances
- Sports widget with `Live`, `Upcoming`, and `Results` tabs
- Today in History widget with date navigation and modal detail view
- Quote widget for homepage variety and pacing

### Sports integration
- Standalone sports score service fully merged into `api/sports.js`
- Multi-provider sports aggregation for cricket, tennis, football, kabaddi, badminton, Formula 1,
  and fallback coverage for additional sports
- Focused sports feed tuned for international events and India-relevant coverage
- Faster refresh cadence when live matches exist, slower cadence when there are none
- Sports failures are isolated to the sports section so they do not blank the whole page

### Translation and personalization
- On-demand translation to 18 languages through Google Translate's public `gtx` endpoint
- Google Sign-In via Supabase Auth
- Per-user bookmarks synced to Supabase
- Read-history tracking and `Your Special` personalized recommendations

### Reader and OSINT
- Entity extraction from article content
- Wikipedia enrichment with summaries and thumbnails
- Related-story discovery across the current feed
- External investigation links for Google News, Bing, X, Reddit, Google Lens, TinEye, and the Wayback Machine
- Text-to-speech with playback speed controls and sentence highlighting

### UX and delivery
- Light and dark themes with persistent preference
- `⌘K` / search-driven browsing and infinite feed loading
- SEO helpers through sitemap, OG tag injection, and IndexNow submission support
- Responsive layouts across desktop, tablet, and mobile, including mobile-specific horizontal strips

## Architecture

```text
RSS / API feeds ───────────────┐
Wikipedia / utility sources ───┼────────▶ GitHub Actions pipelines
Fuel collection jobs ──────────┘          (fetch -> enrich -> upsert)
                                              │
                                              ▼
                                     Supabase (Postgres + Auth)
                                 news / today_history / market_data
                                   profiles / saved_news / reads
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     │                                                 │
                     ▼                                                 ▼
            Vercel serverless routes                            React + Vite client
     /api/sports /api/fuel /api/og /api/sitemap /api/indexnow   Home / All News / Reader
     multi-provider sports, SEO helpers, utility reads          widgets, translation, OSINT
                     │                                                 │
                     └──────────── external APIs + caches ─────────────┘
```

### Data flow
- `pipeline/` fetches and enriches the main news feed, then upserts to Supabase.
- `history-pipeline/` handles recurring utility datasets such as Today in History and fuel data.
- The browser reads article data from Supabase and widget data from dedicated client hooks.
- Vercel API routes handle sports aggregation, SEO helpers, and selected utility lookups.
- `api/sports.js` now contains the merged sports logic that used to live in a separate Express project.

Supabase service-role access is intended for pipelines and trusted server-side execution only.
Browser reads use the anon key and rely on Row Level Security.

## Local development

Requires Node 18+ and a Supabase project with the schema in `supabase/schema.sql`.

```bash
npm install
cp .env.example .env
# Fill in the VITE_ variables
npm run dev
```

Required browser env vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional for local auth:

- `VITE_GOOGLE_CLIENT_ID`

Open [http://localhost:5173/](http://localhost:5173/).

The app can browse article data directly from Supabase. Utility widgets and sports data are fetched
through the same client/server paths used in production.

## Run the pipeline locally

```bash
cd pipeline
npm install
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, and at least NVIDIA_KEY
PIPELINE_GROUP=1 node index.js
```

The pipeline fetches Group 1 sources, enriches with NVIDIA (Gemini/OpenAI as fallbacks),
and upserts to Supabase. Runs Groups 2 and 3 by changing `PIPELINE_GROUP`.

## Deploy to Vercel

1. Import the repo at [Vercel](https://vercel.com/new)
2. Add browser env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GOOGLE_CLIENT_ID` if Google Sign-In is enabled
3. Add server-side env vars for utility routes where needed:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
4. Deploy. `vercel.json` handles the SPA rewrite plus `/api/*` routes for dynamic helpers such as sports, fuel, sitemap, and OG generation.

## GitHub Actions secrets

The pipeline workflows need these secrets in **Settings -> Secrets -> Actions**:

| Secret | Used by |
|--------|---------|
| `SUPABASE_URL` | All pipeline workflows |
| `SUPABASE_SERVICE_KEY` | All pipeline workflows |
| `NVIDIA_KEY` | News enrichment (primary LLM) |
| `GEMINI_KEY` | News enrichment (fallback) |
| `OPENAI_KEY` | News enrichment (fallback) |

The history/utility jobs may use only the Supabase credentials when they are not running enrichment.

## Project structure

```
.
├── api/
│   ├── fuel.js              # Fuel-price serverless route backed by Supabase
│   ├── indexnow.js          # Search-engine ping helper
│   ├── og.js                # Dynamic Open Graph tag injection for article pages
│   ├── sitemap.js           # XML sitemap generation from Supabase content
│   └── sports.js            # Merged sports backend and multi-provider normalizer
├── .github/workflows/
│   ├── pipeline.yml         # Group 1 — India/World/Tech/Business (every :00/:30)
│   ├── pipeline-2.yml       # Group 2 — Science/Health/Sports/… (every :15/:45)
│   ├── pipeline-3.yml       # Group 3 — India deep coverage (every :10/:40)
│   └── history.yml          # Today in History — Wikipedia (daily 00:00 IST)
├── history-pipeline/
│   ├── index.js             # Scheduled utility/history data jobs
│   └── package.json
├── pipeline/
│   ├── index.js             # Orchestrator: fetch → enrich → save (per-batch)
│   ├── fetchNews.js         # RSS + API fetching (parallel, per group)
│   ├── sources.js           # 50+ source definitions grouped by category
│   ├── enrichWithAI.js      # NVIDIA LLM enrichment with Gemini/OpenAI fallback
│   ├── db.js                # Supabase upsert + deduplication
│   ├── config.js            # Batch sizes, limits, timeouts
│   └── package.json
├── supabase/
│   ├── schema.sql           # Table definitions and RLS policies
│   └── migrate.sql          # Schema migrations
├── public/
│   ├── favicon.svg          # Brand mark
│   └── robots.txt
├── src/
│   ├── App.jsx              # Top-level state, routing, filter pipeline
│   ├── main.jsx             # ReactDOM root
│   ├── components/
│   │   ├── Header.jsx           # Navbar: theme, search, language selector, refresh
│   │   ├── TopNav.jsx           # Tab navigation
│   │   ├── DetailPanel.jsx      # Reader with TTS, bookmarks, metadata
│   │   ├── OsintPanel.jsx       # Entity extraction + Wikipedia + related links
│   │   ├── TodayHistory.jsx     # "On this day" widget with date nav + modal
│   │   ├── MarketsWidget.jsx    # Market and crypto strip
│   │   ├── FuelWidget.jsx       # Fuel prices
│   │   ├── HolidayWidget.jsx    # Holidays & festivals
│   │   ├── SportsWidget.jsx     # Sports cards with Live / Upcoming / Results
│   │   ├── QuoteWidget.jsx      # Quote card
│   │   ├── AQIBadge.jsx         # Air quality badge
│   │   ├── NewsFeed.jsx         # Scrollable article feed
│   │   ├── NewsCard.jsx         # Individual article card
│   │   └── TranslateSelector.jsx
│   ├── hooks/
│   │   ├── useNews.js               # Supabase article feed
│   │   ├── useAuth.js               # Google OAuth + Supabase auth
│   │   ├── useHistory.js            # Today in History cache and loader
│   │   ├── useSports.js             # Sports widget cache + adaptive refresh
│   │   ├── useFuel.js               # Fuel lookup by city/state
│   │   ├── useHolidays.js           # Dynamic Indian holidays and observances
│   │   ├── useWeather.js            # Weather badge data
│   │   ├── useTranslation.js        # Single-article translation
│   │   ├── useBatchTranslation.js   # Background translation queue
│   │   ├── useBookmarks.js          # Bookmark sync
│   │   ├── useReadArticles.js       # Read-article tracking
│   │   ├── useTheme.js              # Theme persistence
│   │   └── useRoute.js              # Hash-based routing
│   ├── pages/
│   │   ├── HomePage.jsx         # Briefing + widgets + sections
│   │   ├── AllNews.jsx          # Full feed with topic filters
│   │   ├── YourSpecial.jsx      # Personalized feed
│   │   ├── Feedback.jsx         # Feedback/contact page
│   │   ├── Status.jsx           # App status page
│   │   ├── Privacy.jsx
│   │   ├── Terms.jsx
│   │   ├── Grievance.jsx
│   │   ├── Methodology.jsx
│   │   └── PageShell.jsx        # Shared static-page shell and footer
│   ├── services/
│   │   ├── supabaseService.js   # Supabase reads + article helpers
│   │   ├── translateService.js  # Google Translate gtx endpoint + cache
│   │   └── osintService.js      # Wikipedia + related-story helpers
│   ├── utils/
│   │   ├── format.js        # Date parsing, HTML stripping, reading time, truncation
│   │   ├── categories.js    # Category matching, sentiment labels
│   │   └── slug.js          # URL-safe slugification
│   └── styles/index.css     # Single global stylesheet, light + dark CSS variables
├── .env.example             # Browser environment variable template
├── vite.config.js           # Vite build config with vendor chunk splitting
├── vercel.json              # Vercel deployment config (SPA rewrite rules)
└── package.json
```

## Supabase schema (key tables)

| Table | Purpose |
|-------|---------|
| `news` | All enriched articles — title, description, content, key_points, category, sentiment, image_url, source_name, published_at_ist |
| `today_history` | Wikipedia "On This Day" events — event_year, title, description, category, details, history_date |
| `market_data` | Widget-ready utility values such as fuel and market-related data |
| `profiles` | User display names and preferences |
| `saved_news` | Per-user bookmark arrays (article_urls[]) |

## Tech stack

Vite 5 · React 18 · Supabase (Postgres + Auth) · GitHub Actions · Vercel serverless functions ·
Google Translate (`gtx`) · Wikipedia REST API · NVIDIA NIM LLM with fallbacks ·
Plain CSS with custom-property theming
