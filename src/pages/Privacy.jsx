import PageShell from './PageShell.jsx';

export default function Privacy() {
  return (
    <PageShell title="Privacy Policy">
      <p className="pg-updated">Last updated: May 2026</p>

      <h2>What we collect</h2>
      <p>NewsSphere collects <strong>no personal data</strong> by default. Specifically:</p>
      <ul>
        <li><strong>Bookmarks</strong> — saved in your browser's <code>localStorage</code>. Never sent to our servers.</li>
        <li><strong>Theme preference</strong> — stored in <code>localStorage</code>. Never sent to our servers.</li>
        <li><strong>No accounts</strong> — we have no login system. We do not collect your name, email, or any identifier.</li>
        <li><strong>No cookies</strong> — we set no tracking or analytics cookies.</li>
      </ul>

      <h2>Third-party services</h2>
      <ul>
        <li><strong>Supabase</strong> — stores AI-enriched article data. No user data is stored. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase Privacy Policy ↗</a></li>
        <li><strong>NVIDIA / Google Gemini / OpenAI</strong> — used server-side to generate original article summaries. Only article titles and brief descriptions are sent. No user data is ever shared.</li>
        <li><strong>Google Fonts</strong> — loads Playfair Display and DM Sans typefaces. Google may log your IP. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy ↗</a></li>
        <li><strong>Original publishers</strong> — article images are loaded directly from publisher CDNs. Publishers may log your IP when images load.</li>
        <li><strong>Wikipedia / OSINT tools</strong> — the OSINT panel makes requests to Wikipedia's public API on your behalf when you use it.</li>
      </ul>

      <h2>Analytics</h2>
      <p>We currently run no analytics. If analytics are added in future, we will update this policy and prefer a privacy-preserving tool (no cookies, no cross-site tracking).</p>

      <h2>Data retention</h2>
      <p>News articles in our database are automatically deleted after 30 days. We hold no user data to retain or delete.</p>

      <h2>Children</h2>
      <p>NewsSphere is a general news platform not directed at children under 13. We do not knowingly collect data from children.</p>

      <h2>Contact</h2>
      <p>For privacy questions, email <a href="mailto:grievance@newssphere.in">grievance@newssphere.in</a>.</p>
    </PageShell>
  );
}
