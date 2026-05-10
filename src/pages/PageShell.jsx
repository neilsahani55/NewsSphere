export default function PageShell({ title, children }) {
  return (
    <div className="pg-wrap">
      <header className="pg-hdr">
        <a href="#/" className="pg-back">← NewsSphere</a>
        <span className="pg-title">{title}</span>
      </header>
      <main className="pg-body">{children}</main>
      <footer className="pg-foot">
        <a href="#/privacy">Privacy</a>
        <span aria-hidden>·</span>
        <a href="#/terms">Terms</a>
        <span aria-hidden>·</span>
        <a href="#/grievance">Grievance</a>
        <span aria-hidden>·</span>
        <a href="#/methodology">Methodology</a>
        <span aria-hidden>·</span>
        <a href="#/status">Status</a>
      </footer>
    </div>
  );
}
