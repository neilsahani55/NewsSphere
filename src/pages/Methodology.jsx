import PageShell from './PageShell.jsx';

export default function Methodology() {
  return (
    <PageShell title="How NewsSphere Works">

      <h2>1. Source Selection</h2>
      <p>NewsSphere aggregates from <strong>hand-picked, high-quality sources</strong> across every major news category — India, World, Technology, Business, Science, Health, Sports, Entertainment, Crypto, Politics, Environment, and Crime.</p>
      <p>Sources are chosen for editorial quality, reliability, and public availability. We cover leading Indian and international publishers. No paywalled content is accessed.</p>

      <h2>2. Automatic Fetching</h2>
      <p>Our system continuously monitors news sources throughout the day, fetching the latest headlines at regular intervals. This ensures NewsSphere stays up to date with breaking stories around the clock.</p>

      <h2>3. Deduplication</h2>
      <p>Before any AI processing, every article is checked against what we've already covered. Articles recently processed are skipped automatically. This prevents duplicate stories and keeps the feed fresh.</p>

      <h2>4. AI Enrichment — Original Journalism</h2>
      <p>For each new article, our AI receives only the <strong>headline and a brief snippet</strong> — never the full article text. The AI is then instructed to:</p>
      <ul>
        <li>Write a completely original 2-sentence description in clear, accessible language.</li>
        <li>Write a full original article (300–450 words) drawing on its knowledge of the topic.</li>
        <li>Extract the key points a reader needs to know.</li>
        <li>Assign relevant topic categories.</li>
      </ul>
      <p><strong>The AI is explicitly instructed not to copy, paraphrase, or mirror the source text.</strong> The content on NewsSphere is original AI journalism — not a reproduction of any publisher's work.</p>

      <h2>5. Quality Filtering</h2>
      <p>Only articles that pass our quality checks — with complete, substantive AI content — are published. Incomplete or low-quality enrichments are discarded automatically. Articles are removed after 30 days to keep the platform current.</p>

      <h2>6. What You See</h2>
      <p>The NewsSphere reader displays:</p>
      <ul>
        <li>The AI-written summary and in-depth analysis.</li>
        <li>The original source name and a direct link to the original article.</li>
        <li>Topic tags, estimated reading time, and publication time.</li>
        <li>Text-to-speech in multiple languages.</li>
        <li>Translation into 18+ languages (processed client-side).</li>
        <li>Research tools for fact-checking (Wikipedia integration, reverse image search, and more).</li>
      </ul>

      <h2>Source List</h2>
      <p>Our sources by category:</p>
      <ul>
        <li><strong>India:</strong> Times of India, Hindustan Times, The Hindu, Firstpost, Indian Express, India Today, NDTV, Scroll.in, Deccan Herald, News18, The Quint, The News Minute, Business Standard, Outlook India</li>
        <li><strong>World:</strong> BBC World, Al Jazeera, CNN, The Guardian</li>
        <li><strong>Technology:</strong> TechCrunch, The Verge, Hacker News</li>
        <li><strong>Business:</strong> Livemint, Economic Times, The Guardian Business</li>
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
