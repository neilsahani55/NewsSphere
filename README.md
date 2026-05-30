# NewsSphere

> News intelligence beyond the headline.

A multilingual news dashboard with AI enrichment, personalization, and built-in OSINT tools.
NewsSphere aggregates articles from 50+ RSS feeds and APIs, enriches each one with an NVIDIA
LLM (summary, key points, sentiment), stores everything in Supabase, and surfaces it through
a fast React UI that lets you read in 18 languages, bookmark stories, cross-reference sources,
and dig into context with Wikipedia + web search — all from the browser, no keys required.

## Features

### Aggregate
- 50+ curated sources across 12 topic categories (India, World, Tech, Business, Science,
  Health, Sports, Entertainment, Crypto, Politics, Environment, Crime)
- Three GitHub Actions pipeline groups run every 30 minutes, staggered to avoid rate limits
- Articles gated on full enrichment — half-finished rows are hidden until AI fills them in
- **Today in History** — a daily Wikipedia-powered "On this day" widget with India-focused
  events, date navigation (30 days back), and a full-detail modal

### Translate
- On-demand translation to 18 languages via Google Translate's public gtx endpoint
- No API key required; switch language globally and all visible cards + the open article translate
- Background concurrency-limited batch translator for cards in view
- Shared module-scoped cache that auto-invalidates when source text changes

### Personalize
- Google Sign-In (popup-based, no redirect) via Supabase Auth
- Bookmarks synced to Supabase per user — survive logout/login and multiple devices
- Read-article tracking (local + per-account) with per-account isolation on device
- "Your Special" tab: articles matched to your reading history

### Investigate (OSINT)
- Entity extraction — proper nouns and acronyms pulled from each article
- Wikipedia enrichment — one-paragraph summary + thumbnail per entity
- Cross-references — other articles in the feed mentioning the same entities
- External links — Google News, Bing, X, Reddit, Google Lens, TinEye

### Polish
- Light + dark theme with system-preference fallback
- Bookmarks, `⌘K` search, infinite scroll
- Text-to-speech with speed controls and sentence highlighting
- 5-tier responsive layout (mobile → desktop)
- Sentiment tagging from LLM enrichment

## Architecture

```
┌─────────────────────┐    GitHub Actions (every 30 min)    ┌──────────────────────┐
│ 50+ RSS / API feeds │ ──────────────────────────────────▶ │ pipeline/ (Node.js)  │
│                     │                                      │ fetchNews → NVIDIA   │
└─────────────────────┘                                      │ enrichWithAI → db.js │
                                                             └──────────┬───────────┘
                                                                        │ upsert
                                                             ┌──────────▼───────────┐
                                                             │ Supabase (Postgres)  │
                                                             │ news + today_history │
                                                             │ profiles + saved_news│
                                                             └──────────┬───────────┘
                                                                        │ anon key / RLS
                                                             ┌──────────▼───────────┐
                                                             │ React UI (browser)   │
                                                             │ + Google Translate   │
                                                             │ + Wikipedia REST     │
                                                             └──────────────────────┘

┌────────────────────────────────────────────────────────┐
│ history-pipeline/  (daily, 00:00 IST via GitHub Actions)│
│ Wikipedia "On This Day" API → Supabase today_history   │
└────────────────────────────────────────────────────────┘
```

Supabase service-role key is used only inside GitHub Actions (never in the browser).
Browser reads use the anon key, protected by Supabase Row Level Security policies.

## Local development

Requires Node 18+ and a Supabase project with the schema in `supabase/schema.sql`.

```bash
npm install
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

Open http://localhost:5173/. The app reads directly from Supabase — no local pipeline needed
to browse articles (the live database already has data from the GitHub Actions runs).

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

1. Import the repo at https://vercel.com/new
2. Add environment variables (Vite prefix required for browser access):
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon (public) key
3. Click **Deploy** — Vercel detects Vite from `vercel.json`, auto-deploys on every push to `main`

## GitHub Actions secrets

The pipeline workflows need these secrets set in **Settings → Secrets → Actions**:

| Secret | Used by |
|--------|---------|
| `SUPABASE_URL` | All pipeline workflows |
| `SUPABASE_SERVICE_KEY` | All pipeline workflows |
| `NVIDIA_KEY` | News enrichment (primary LLM) |
| `GEMINI_KEY` | News enrichment (fallback) |
| `OPENAI_KEY` | News enrichment (fallback) |

The history pipeline (`history.yml`) needs only `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`.

## Project structure

```
.
├── .github/workflows/
│   ├── pipeline.yml         # Group 1 — India/World/Tech/Business (every :00/:30)
│   ├── pipeline-2.yml       # Group 2 — Science/Health/Sports/… (every :15/:45)
│   ├── pipeline-3.yml       # Group 3 — India deep coverage (every :10/:40)
│   └── history.yml          # Today in History — Wikipedia (daily 00:00 IST)
├── history-pipeline/
│   ├── index.js             # Wikipedia On-This-Day → Supabase today_history
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
│   │   ├── Header.jsx       # Navbar: theme, search, language selector, refresh
│   │   ├── TopNav.jsx       # Tab navigation (Home / All News / Your Special / Feedback)
│   │   ├── TodayHistory.jsx # "On this day" history widget with date nav + modal
│   │   ├── DetailPanel.jsx  # Article reader with TTS, OSINT, bookmarks
│   │   ├── OsintPanel.jsx   # Entity extraction + Wikipedia + external search links
│   │   ├── NewsFeed.jsx     # Horizontal scrolling card feed with infinite scroll
│   │   ├── NewsCard.jsx     # Individual article card
│   │   ├── SkeletonCard.jsx # Loading placeholder
│   │   ├── SearchBar.jsx    # Search input
│   │   └── TranslateSelector.jsx  # 18-language dropdown
│   ├── hooks/
│   │   ├── useNews.js           # Fetch articles from Supabase (batched, cached)
│   │   ├── useAuth.js           # Google OAuth + Supabase auth
│   │   ├── useHistory.js        # Today in History events (per-date session cache)
│   │   ├── useTranslation.js    # Single-article translation
│   │   ├── useBatchTranslation.js  # Background translation queue
│   │   ├── useUIStrings.js      # Static UI string translation
│   │   ├── useBookmarks.js      # Bookmark state (localStorage + Supabase sync)
│   │   ├── useReadArticles.js   # Read-article tracking
│   │   ├── useTheme.js          # Dark/light theme with localStorage persistence
│   │   ├── useRoute.js          # Hash-based routing
│   │   ├── useDebounce.js       # Search debounce
│   │   └── useSwipe.js          # Touch swipe gestures
│   ├── pages/
│   │   ├── HomePage.jsx     # Home: Today in History + Top Stories + category sections
│   │   ├── AllNews.jsx      # Full feed with topic filters
│   │   ├── YourSpecial.jsx  # Personalized feed for logged-in users
│   │   ├── Feedback.jsx     # Contact/feedback form
│   │   ├── Status.jsx       # Live service stats (article counts, sources, categories)
│   │   ├── Privacy.jsx      # Privacy policy
│   │   ├── Terms.jsx        # Terms of service
│   │   ├── Grievance.jsx    # Grievance officer (India IT Rules compliance)
│   │   ├── Methodology.jsx  # How aggregation and enrichment works
│   │   └── PageShell.jsx    # Layout wrapper for static pages
│   ├── services/
│   │   ├── supabaseService.js   # Supabase article fetch + lazy content loading
│   │   ├── translateService.js  # Google Translate gtx endpoint + cache
│   │   └── osintService.js      # Wikipedia entity enrichment + search links
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
| `profiles` | User display names and preferences |
| `saved_news` | Per-user bookmark arrays (article_urls[]) |

## Tech stack

Vite 5 · React 18 · Supabase (Postgres + Auth) · NVIDIA NIM LLM ·
Google Translate (gtx, no key) · Wikipedia REST API · GitHub Actions ·
Vercel serverless · Plain CSS with custom-property theming
