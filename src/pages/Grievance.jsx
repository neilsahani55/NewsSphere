import PageShell from './PageShell.jsx';

export default function Grievance() {
  return (
    <PageShell title="Grievance Officer">
      <p className="pg-updated">
        As required under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 (India IT Rules 2021), NewsSphere designates the following Grievance Officer.
      </p>

      <h2>Grievance Officer Details</h2>
      <table className="pg-table">
        <tbody>
          <tr><td>Name</td><td>Neil Sahani</td></tr>
          <tr><td>Designation</td><td>Founder, NewsSphere</td></tr>
          <tr><td>Email</td><td><a href="mailto:newssphere55@gmail.com">newssphere55@gmail.com</a></td></tr>
          <tr><td>Response time</td><td>Within 72 hours of receipt</td></tr>
          <tr><td>Resolution time</td><td>Within 15 days of receipt</td></tr>
        </tbody>
      </table>

      <h2>Content Takedown / Copyright Complaint</h2>
      <p>If you are a publisher or rights holder and believe that content on NewsSphere infringes your rights, please email us with:</p>
      <ol>
        <li>Your name and contact details.</li>
        <li>The URL of the content on NewsSphere you wish to have removed.</li>
        <li>The original URL / publication that establishes your rights.</li>
        <li>A brief statement confirming you are the rights holder or authorised to act on their behalf.</li>
      </ol>
      <p>Valid takedown requests will be actioned within <strong>24 hours</strong>.</p>

      <h2>Other Complaints</h2>
      <p>For complaints about inaccurate AI summaries, misleading content, or any other concern, email the same address with "Complaint:" in the subject line. We will review and respond within 72 hours.</p>

      <h2>Escalation</h2>
      <p>If your complaint is not resolved within 15 days, you may approach the designated appellate authority under the IT Rules 2021 or any other competent authority.</p>
    </PageShell>
  );
}
