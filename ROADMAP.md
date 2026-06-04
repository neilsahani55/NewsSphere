# NewsSphere — Product Roadmap

Ideas, planned features, and future directions. This file tracks what we want to build — not a sprint plan, just a living wishlist ordered by priority and theme.

---

## Phase 1 — Quick Wins (low effort, high value)

These can each be shipped in a day or two and immediately make the home page more useful.

### Markets & Money
- **Gold & Silver Rates** — Daily 22K/24K gold (per 10g) and silver prices in INR. Source: IBJA or a public rates API. Compact card on home page.
- **Sensex & Nifty** — India's two benchmark indices at a glance — current value, day change %, colour-coded green/red.
- **USD/INR Rate** — Live dollar-to-rupee exchange rate with up/down arrow and change since yesterday.
- **Crypto Prices** — Bitcoin and Ethereum in INR, linked to the existing Crypto news section for context.

### Content Extras
- **Quote of the Day** — A rotating daily line (curated or AI-picked from the news). Adds ritual feel alongside "On This Day."
- **Sunrise & Sunset** — Day length and timings for the user's city, paired with local weather. Simple and useful for planning.
- **Updated Badge** — A small "Updated" chip on cards where the story has new developments since it was first published.
- **Verified Tags** — Flag stories corroborated by three or more credible sources. Builds trust.
- **One-Tap WhatsApp Share** — Prominent share button on every card. WhatsApp is how India shares news.

---

## Phase 2 — India-First Features (medium effort, strong differentiation)

These make NewsSphere feel built for India, not ported from a Western news template.

### India Utility
- **Live Cricket Score** — Compact live-match card with current score, overs, and run rate. Source: Cricbuzz or ESPN Cricinfo public API. Only shown when a match is live.
- **Festival & Holiday Calendar** — Next public holiday and upcoming festivals (Diwali, Eid, Christmas, regional). Optionally with Panchang tithi for the current day.
- **Air Quality (AQI)** — Live pollution level for the user's auto-detected city. Critical daily check in Delhi, Mumbai, Bengaluru, and most Indian metros.
- **Local City News** — Auto-detected hyperlocal section based on user's city (Mumbai, Delhi, Hyderabad, etc.). Filter existing articles by city tags or add a city-specific feed.
- **Fuel Prices** — Today's petrol and diesel rates for the user's city. Updated daily by state oil companies.

### Weather
- **Local Weather** — Auto-detected temperature, condition icon, feels-like temperature, and humidity. Uses browser geolocation + a free API (Open-Meteo, no key needed).

### Engagement
- **Trending Now** — Most-read / most-clicked stories driven by our own click data. Requires logging article opens server-side (can be a lightweight Supabase increment).
- **Why This Matters** — A short AI-generated context line (1–2 sentences) under top story cards explaining the significance. Uses Gemini, similar to existing key_points.

---

## Phase 3 — Intelligence & Personalisation (higher effort, clear differentiator)

These are what set NewsSphere apart from a basic RSS aggregator.

### AI Features
- **60-Second Briefing** — AI-generated "your morning in 5 bullets" card pinned to the top of the home page. Gemini reads today's top stories and produces a crisp daily brief. Refreshes once in the morning.
- **Catch Me Up** — Summarises what changed since the user's last visit. "You were away for 6 hours — here's what happened." Needs last-visit timestamp stored locally.
- **Story Timelines** — Auto-assembled "how this story developed" view for big running events (e.g., election, IPL season, geopolitical crisis). Groups related articles by story arc and sorts chronologically.
- **Source Spread** — For major stories, shows how many outlets are covering it and whether framing differs (positive / neutral / negative). Surfaces media bias at a glance.

### Personalisation
- **Follow Topics** — Let users follow keywords, sources, or sports teams. Followed items pin to the top of the feed. Stored in Supabase user_prefs.
- **Save / Read Later** — Full bookmark system with a "continue where you left off" history. The bookmark hook already exists; this extends it with a dedicated page and history view.

### Digests & Notifications
- **WhatsApp / Email Digest** — Opt-in daily brief sent at 7 AM IST. WhatsApp Business API or a transactional email (Resend / Mailgun). High open rates in India.
- **Listen to Briefing** — Text-to-speech playback of the 60-Second Briefing for commuters and accessibility. Web Speech API (no cost) or ElevenLabs for quality.

---

## Phase 4 — Civic & Local (longer-term, community value)

### Local & Civic
- **Transit Status** — Local train / metro delay status and traffic card for Mumbai, Delhi, Bengaluru. Depends on real-time transit APIs (currently limited in India).
- **Today's Commute** — Weather + AQI + traffic summary in one card: "Leave early — heavy rain and AQI 180."
- **Public Alerts** — IMD weather warnings, NDMA advisories, and civic notices surfaced as a banner.
- **Big Number of the Day** — One striking news statistic, visualised (e.g., "₹2.1 lakh crore — India's defence budget"). One card, one number, one sentence of context.

---

## Phase 5 — Content Formats (creative, lower priority)

- **Photo of the Day** — A strong visual break in the text-heavy feed. Sourced from news wire or Wikimedia Commons.
- **Explainer of the Week** — A single deeper piece going beyond headlines. Could be AI-assembled from multiple sources on one topic.
- **Currency Converter** — Tiny INR ↔ USD / EUR / GBP converter reusing the forex data already fetched for the rate card.
- **Daily Poll** — One tappable question tied to a current story. Requires server-side vote counting and a results view.
- **Reading Streak** — "12 days in a row" stat for gentle gamification. Stored in localStorage, shown in the profile or header.
- **Trending Searches** — What users are searching on NewsSphere itself. Requires logging search queries (anonymised) server-side.
- **Video / Reels Rail** — Short clips embedded from YouTube / YouTube Shorts. High infrastructure and moderation cost; lowest priority.

---

## Notes & Principles

- **India-first always**: prioritise features that solve Indian daily needs (AQI, cricket, gold, festivals) over generic global features.
- **No new heavy dependencies**: prefer Web APIs (geolocation, speech), free-tier public APIs (Open-Meteo, Wikimedia), and Gemini (already integrated) over paid SDKs.
- **Progressive enhancement**: every widget should degrade gracefully if the API call fails — show a skeleton, not an error.
- **Performance budget**: the home page first load should stay under 3s on a mid-range Android on 4G. Each new widget must justify its network cost.
- **Privacy**: geolocation is opt-in, no PII sent to third parties beyond what the user explicitly allows.
