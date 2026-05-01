# NewsSphere

> News intelligence beyond the headline.

A multilingual news dashboard with built-in OSINT enrichment. NewsSphere
aggregates 4,000+ articles from 50+ sources (5 keyed APIs + dozens of RSS
feeds) into a single Google Sheet, then surfaces them through a fast React UI
that lets you read in any of 18 languages, cross-reference stories across
sources, and dig into context with Wikipedia + reverse-image search +
social-media discovery — all from CORS-friendly free APIs (no keys needed
in the browser).

## Aggregate · Translate · Investigate

### Aggregate
- 12 logical topics derived from comma-separated category labels
  (`India, Politics, Business` correctly surfaces under three filters)
- Articles gated on enrichment — only fully-populated rows reach the feed,
  half-finished rows quietly appear once the Apps Script fills them in
- Newest-first sort, deterministic across browsers
- Horizontal scrolling cards row + full-width reader pane below

### Translate
- On-demand translation to **18 languages** via Google Translate's public
  gtx endpoint — no API key, no quota for normal use
- Default English; switch globally and *all* visible cards + the open
  article translate together
- Background concurrency-limited batch translator for cards
- Shared module-scoped cache that auto-invalidates when source text changes
  (so updated content doesn't get a stale translation)

### Investigate (OSINT)
- **Entity extraction** — proper nouns + acronyms pulled from each article
- **Wikipedia enrichment** — one-paragraph summary + thumbnail per entity
- **Cross-references** — other articles in the feed mentioning the same
  entities, expandable inline (each row also has a "open in main reader" jump)
- **External investigations** — direct links to Google News, Bing, X, Reddit,
  Google Lens, TinEye for verification and discovery

### Polish
- Light + dark theme with system-preference fallback
- Bookmarks (localStorage), `⌘K` search, infinite scroll
- 5-tier responsive design (380 / 540 / 720 / 900 / 1080 px breakpoints)
- Sentiment tagging from the World News API column

## Architecture

```
┌──────────────────┐    every 30 min    ┌──────────────────┐
│ 50+ News sources │ ─────────────────▶ │ Google Sheet     │
│ (5 APIs + RSS)   │   (Apps Script)    │ (13-column data) │
└──────────────────┘                    └────────┬─────────┘
                                                 │
                                  server-side gviz fetch
                                                 │
                                       ┌─────────▼──────────┐
                                       │ /api/news (Vercel) │
                                       │ Sheet ID hidden    │
                                       └─────────┬──────────┘
                                                 │
                                          JSON over HTTPS
                                                 │
                                       ┌─────────▼──────────┐
                                       │ React UI (browser) │
                                       │ + Google Translate │
                                       │ + Wikipedia REST   │
                                       └────────────────────┘
```

The Sheet ID lives only on the server. Browsers see `/api/news?q=...`
requests — the actual gviz endpoint and the Sheet ID never reach the client
bundle or DevTools.

## Local development

Requires Node 18+ and a Google Sheet populated with the 13-column schema below.

```bash
npm install
cp .env.example .env
# edit .env: set SHEET_ID and SHEET_TAB
npm run dev
```

Open http://localhost:5173/. The Vite dev server includes a `/api/news`
middleware that proxies gviz locally, so the dev experience is identical
to production.

## Deploy to Vercel

1. Import the repo at https://vercel.com/new
2. Add two environment variables (server-only — no `VITE_` prefix):
   - `SHEET_ID` — your Google Sheet ID
   - `SHEET_TAB` — sheet tab name (default: `News`)
3. Click **Deploy**

Vercel detects Vite from `vercel.json`, builds the static assets, and turns
`api/news.js` into a serverless function on the same origin. Auto-deploys on
every push to `main`.

## Project structure

```
.
├── api/
│   └── news.js              # Vercel serverless proxy — Sheet ID server-only
├── public/
│   └── favicon.svg          # Brand mark — navy sphere + gold dot + serif N
├── src/
│   ├── App.jsx              # Top-level state + filter pipeline
│   ├── main.jsx             # ReactDOM root
│   ├── components/          # Header, FilterBar, NewsCard, DetailPanel, OsintPanel, …
│   ├── hooks/               # useNews, useTranslation, useBatchTranslation, useTheme, …
│   ├── services/            # sheetService, translateService, osintService
│   ├── utils/               # format helpers, category bucketing
│   └── styles/index.css     # Single global stylesheet, light + dark themes
├── vite.config.js           # Includes dev middleware that mirrors api/news.js
├── vercel.json              # Vite framework hint
└── package.json
```

## Sheet schema

| Col | Field | Notes |
|---|---|---|
| A | `fetched_at_ist` | Apps Script timestamp |
| B | `category` | Comma-separated topics, e.g. `India, Politics, Business` |
| C | `article_url` | Primary key for dedupe |
| D | `title` | |
| E | `description` | Short summary |
| F | `content` | Full body — gates feed visibility when blank |
| G | `key_points` | Bullet summary — also gates feed visibility |
| H | `image_url` | Hero image |
| I | `published_at_ist` | Article publish time (sort key) |
| J | `source_name` | NDTV, BBC, Reuters, … |
| K | `language` | ISO 639-1 |
| L | `country` | ISO 3166-1 alpha-2 |
| M | `sentiment` | -1.0 .. +1.0 from World News API |

## Tech stack

Vite 5 · React 18 · Vercel serverless · Google Translate (gtx) · Wikipedia
REST · Plain CSS with custom-property theming · Google Sheet as data store
populated by Apps Script.
