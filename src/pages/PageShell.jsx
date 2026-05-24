export default function PageShell({ title, children }) {
  return (
    <div className="pg-wrap">

      {/* ── Top bar — matches main app's navy header ─────────────────── */}
      <header className="pg-hdr">
        <div className="pg-hdr-inner">
          <a href="/" className="pg-brand" aria-label="NewsSphere home">
            <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
              <circle cx="16" cy="16" r="16" fill="#0d1f3c"/>
              <ellipse cx="16" cy="16" rx="7" ry="14" fill="none" stroke="#f0c040" strokeWidth="1.2" opacity=".7"/>
              <ellipse cx="16" cy="16" rx="14" ry="6" fill="none" stroke="#f0c040" strokeWidth="1.2" opacity=".5"/>
              <circle cx="16" cy="16" r="2.8" fill="#f0c040"/>
            </svg>
            <span className="pg-brand-name">NewsSphere</span>
          </a>

          <a href="/" className="pg-back">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to news
          </a>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────────── */}
      <main className="pg-main">
        <div className="pg-content">
          <h1 className="pg-page-title">{title}</h1>
          <div className="pg-title-rule" aria-hidden />
          <div className="pg-body">{children}</div>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="pg-foot">
        <div className="pg-foot-inner">
          <div className="pg-foot-brand">
            <span className="pg-foot-name">NewsSphere</span>
            <span className="pg-foot-copy">© {new Date().getFullYear()} · All rights reserved</span>
          </div>
          <nav className="pg-foot-links" aria-label="Footer navigation">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/grievance">Grievance</a>
            <a href="/methodology">How it works</a>
            <a href="/#feedback">Feedback</a>
          </nav>
        </div>
      </footer>

    </div>
  );
}
