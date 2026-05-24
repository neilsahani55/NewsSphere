export default function PageShell({ title, children }) {
  return (
    <div className="pg-wrap">

      {/* ── Top bar — matches main app's navy header ─────────────────── */}
      <header className="pg-hdr">
        <div className="pg-hdr-inner">
          <a href="/" className="pg-brand" aria-label="NewsSphere home">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 32 32" aria-hidden>
              <circle cx="16" cy="16" r="15" fill="#1a3c6e"/>
              <ellipse cx="16" cy="16" rx="15" ry="5.5" fill="none" stroke="#5d7ba8" strokeWidth="0.9" opacity="0.9"/>
              <path d="M10.5 22 V10.5 L21.5 22 V10.5" stroke="#f5f4f0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <circle cx="25.5" cy="7" r="2.6" fill="#d4a847"/>
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

      {/* ── Footer — same structure as main app footer ───────────────── */}
      <footer className="pg-foot-wrap">
        <div className="foot">
          <div className="foot-grid">
            <div className="foot-col foot-col--brand">
              <span className="foot-name">NewsSphere</span>
              <p className="foot-desc">AI-powered news intelligence — aggregated, enriched, and delivered around the clock across 12 categories and 37+ sources.</p>
              <p className="foot-copy">© {new Date().getFullYear()} NewsSphere. All rights reserved.</p>
            </div>

            <div className="foot-col">
              <span className="foot-col-hd">Explore</span>
              <nav className="foot-col-links">
                <a href="/">Home</a>
                <a href="/allnews">All News</a>
                <a href="/special">Your Special</a>
                <a href="/feedback">Feedback</a>
              </nav>
            </div>

            <div className="foot-col">
              <span className="foot-col-hd">Company</span>
              <nav className="foot-col-links">
                <a href="/methodology">How it works</a>
                <a href="/privacy">Privacy policy</a>
                <a href="/terms">Terms of use</a>
                <a href="/grievance">Grievance officer</a>
              </nav>
            </div>

            <div className="foot-col">
              <span className="foot-col-hd">Contact</span>
              <div className="foot-col-links">
                <a href="mailto:newssphere55@gmail.com" className="foot-email">newssphere55@gmail.com</a>
                <p className="foot-response">We respond within 72 hours</p>
              </div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
