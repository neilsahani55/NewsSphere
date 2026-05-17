import PageShell from './PageShell.jsx';

export default function Terms() {
  return (
    <PageShell title="Terms of Use">
      <p className="pg-updated">Last updated: May 2026</p>

      <h2>What NewsSphere is</h2>
      <p>NewsSphere is a news aggregation and AI journalism platform. We fetch headlines from publicly available news feeds, use AI to write original analytical summaries, and present them alongside a link to the original source. We do not reproduce original publisher content verbatim.</p>

      <h2>Using the site</h2>
      <ul>
        <li>NewsSphere is free to use for personal, non-commercial purposes.</li>
        <li>You may not scrape, republish, or resell content from NewsSphere.</li>
        <li>You may not use automated tools to access NewsSphere at a rate that impairs service for others.</li>
        <li>You must not use NewsSphere for any unlawful purpose or in a way that violates these terms.</li>
      </ul>

      <h2>Content and copyright</h2>
      <ul>
        <li><strong>AI summaries</strong> — the descriptions, article content, and key points displayed on NewsSphere are written by AI and are original works. They are not copies or paraphrases of publisher content.</li>
        <li><strong>Original articles</strong> — headlines, source names, and article URLs belong to their respective publishers. NewsSphere claims no ownership over them.</li>
        <li><strong>Images</strong> — article images are loaded from publisher websites. Copyright remains with the original publisher or photographer.</li>
        <li>If you believe any content infringes your rights, see the <a href="/grievance">Grievance page</a> for our takedown process.</li>
      </ul>

      <h2>Accuracy</h2>
      <p>NewsSphere AI summaries are generated automatically. While we instruct the AI to be factual and accurate, we cannot guarantee the completeness or correctness of every summary. Always verify important information with the original source. NewsSphere is not liable for decisions made based on content displayed here.</p>

      <h2>Availability</h2>
      <p>We aim for continuous uptime but make no guarantees. Content is updated automatically on a regular schedule but may occasionally be delayed.</p>

      <h2>Limitation of liability</h2>
      <p>NewsSphere is provided "as is" without warranties of any kind. To the maximum extent permitted by applicable law, NewsSphere shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in India.</p>

      <h2>Changes</h2>
      <p>We may update these terms at any time. Continued use of the site after changes constitutes acceptance of the updated terms. We will update the "Last updated" date at the top when changes are made.</p>
    </PageShell>
  );
}
