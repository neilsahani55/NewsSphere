export default function PageShell({ title, children }) {
  return (
    <div className="pg-wrap">
      <header className="pg-hdr">
        <a href="/" className="pg-back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </a>
        <div className="pg-hdr-divider" aria-hidden />
        <span className="pg-title">{title}</span>
      </header>
      <main className="pg-body">{children}</main>
      <footer className="pg-foot">
        <div className="pg-foot-brand">
          <span className="pg-foot-name">NewsSphere</span>
          <span className="pg-foot-copy">© {new Date().getFullYear()} · All rights reserved</span>
        </div>
        <nav className="pg-foot-links" aria-label="Footer navigation">
          <a href="/privacy">Privacy</a>
          <span aria-hidden>·</span>
          <a href="/terms">Terms</a>
          <span aria-hidden>·</span>
          <a href="/grievance">Grievance</a>
          <span aria-hidden>·</span>
          <a href="/methodology">How it works</a>
          <span aria-hidden>·</span>
          <a href="/status">Status</a>
          <span aria-hidden>·</span>
          <a href="/#feedback">Feedback</a>
        </nav>
      </footer>
    </div>
  );
}
