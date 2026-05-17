import PageShell from './PageShell.jsx';

export default function Privacy() {
  return (
    <PageShell title="Privacy Policy">
      <p className="pg-updated">Last updated: May 2026</p>

      <h2>What we collect</h2>
      <p>NewsSphere collects <strong>no personal data</strong> by default. Specifically:</p>
      <ul>
        <li><strong>Bookmarks &amp; preferences</strong> — saved locally in your browser. Never sent to our servers.</li>
        <li><strong>Theme preference</strong> — stored locally in your browser. Never sent to our servers.</li>
        <li><strong>Sign-in (optional)</strong> — if you choose to sign in with Google, we store only your Google account ID and display name to save your personalised preferences. We do not store your password.</li>
        <li><strong>No tracking cookies</strong> — we set no analytics or advertising cookies.</li>
      </ul>

      <h2>Third-party services</h2>
      <ul>
        <li><strong>Cloud database</strong> — article content is stored in a secure cloud database. No personal user data is stored in our article database.</li>
        <li><strong>AI content services</strong> — we use third-party AI services on our servers to generate original article summaries. Only article titles and brief headline snippets are processed. No user data is ever shared with these services.</li>
        <li><strong>Google Sign-In</strong> — if you sign in, Google authenticates your identity. Refer to <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google's Privacy Policy ↗</a> for details.</li>
        <li><strong>Google Fonts</strong> — typefaces are loaded from Google Fonts. Google may log your IP address. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy ↗</a></li>
        <li><strong>Original publishers</strong> — article images load directly from publisher websites. Publishers may log your IP when images load.</li>
        <li><strong>Feedback form</strong> — if you submit feedback, your message and email (if provided) are sent to our feedback service provider. We use this solely to respond to you.</li>
      </ul>

      <h2>Analytics</h2>
      <p>We currently run no analytics. If analytics are added in future, we will update this policy and prefer a privacy-preserving approach with no cookies and no cross-site tracking.</p>

      <h2>Data retention</h2>
      <p>News articles are automatically deleted after 30 days. If you signed in, you can delete your account and all associated preferences at any time by contacting us. We hold no other user data.</p>

      <h2>Children</h2>
      <p>NewsSphere is a general news platform not directed at children under 13. We do not knowingly collect data from children.</p>

      <h2>Contact</h2>
      <p>For privacy questions, email <a href="mailto:grievance@newssphere.in">grievance@newssphere.in</a>. We respond within 72 hours.</p>
    </PageShell>
  );
}
