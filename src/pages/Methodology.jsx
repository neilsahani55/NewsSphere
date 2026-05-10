import PageShell from './PageShell.jsx';

export default function Methodology() {
  return (
    <PageShell title="How NewsSphere Works">

      <h2>1. Source Selection</h2>
      <p>NewsSphere aggregates from <strong>37 hand-picked, high-quality sources</strong> across three pipeline groups:</p>
      <ul>
        <li><strong>Group 1</strong> (India, World, Tech, Business) — 14 sources including Times of India, BBC, TechCrunch, Livemint.</li>
        <li><strong>Group 2</strong> (Science, Health, Sports, Entertainment, Crypto, Politics, Environment, Crime) — 13 sources including ESPNcricinfo, ScienceDaily, CoinDesk.</li>
        <li><strong>Group 3</strong> (India deep coverage) — 10 India-focused sources including Indian Express, India Today, NDTV, Scroll.in.</li>
      </ul>
      <p>Sources are chosen for editorial quality, reliability, and public RSS availability. No paywalled content is accessed.</p>

      <h2>2. Fetching (every 10–15 minutes)</h2>
      <p>Three automated GitHub Actions pipelines run on a staggered schedule — at :00/:30, :10/:40, and :15/:45 every hour. Each pipeline fetches the latest 8 headlines per source via their public RSS feeds or APIs.</p>

      <h2>3. Deduplication</h2>
      <p>Before enrichment, every article URL is checked against the database. Articles already enriched within the last 7 days are skipped. This prevents the same story from being processed twice.</p>

      <h2>4. AI Enrichment — Original Journalism</h2>
      <p>For each new article, our AI (primarily NVIDIA Llama-3.3-70b, with Google Gemini and OpenAI as fallbacks) receives only the <strong>title and a brief headline snippet</strong> — never the full article text. The AI is then instructed to:</p>
      <ul>
        <li>Write a completely original 2-sentence description (60–80 words).</li>
        <li>Write a 3-paragraph original article (300–450 words) drawing on its own knowledge of the topic.</li>
        <li>Extract 4 key bullet points a reader needs to know.</li>
        <li>Assign 1–4 topic categories.</li>
      </ul>
      <p><strong>The AI is explicitly instructed not to copy, paraphrase, or mirror the source text.</strong> The content stored in NewsSphere is original AI journalism — not a reproduction of the publisher's work.</p>

      <h2>5. Storage</h2>
      <p>Only fully enriched articles (with complete AI content) are stored in our Supabase database. Partial or failed enrichments are discarded. Articles are automatically deleted after 30 days.</p>

      <h2>6. Display</h2>
      <p>The frontend reads from Supabase and displays:</p>
      <ul>
        <li>The AI-written summary and analysis.</li>
        <li>The original source name and a direct link to the original article.</li>
        <li>Category tags, reading time estimate, and publication time.</li>
        <li>OSINT tools for fact-checking (Wikipedia, reverse image search, etc.).</li>
      </ul>
      <p>Translation into 18 languages is done client-side using Google Translate's public endpoint — no user data is sent to Google beyond the article text being translated.</p>

      <h2>Source List</h2>
      <p>Full list of sources by category:</p>
      <ul>
        <li><strong>India:</strong> Times of India, Hindustan Times, The Hindu, Firstpost, Indian Express, India Today, NDTV, Scroll.in, Deccan Herald, News18, The Quint, The News Minute, Business Standard, Outlook India</li>
        <li><strong>World:</strong> BBC World, Al Jazeera, CNN World, The Guardian</li>
        <li><strong>Tech:</strong> TechCrunch, The Verge, Hacker News</li>
        <li><strong>Business:</strong> Livemint, Economic Times Markets, Guardian Business</li>
        <li><strong>Science:</strong> ScienceDaily, Spaceflight News</li>
        <li><strong>Health:</strong> BBC Health, WHO</li>
        <li><strong>Sports:</strong> ESPNcricinfo, ESPN</li>
        <li><strong>Entertainment:</strong> Variety, Bollywood Hungama</li>
        <li><strong>Crypto:</strong> CoinDesk, CoinTelegraph</li>
        <li><strong>Politics:</strong> The Print, Politico</li>
        <li><strong>Environment:</strong> The Guardian Environment</li>
        <li><strong>Crime:</strong> Krebs on Security</li>
      </ul>
    </PageShell>
  );
}
