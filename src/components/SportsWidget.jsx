import { memo, useMemo, useState } from 'react';
import { useSports } from '../hooks/useSports.js';

const SPORT_CONFIG = [
  { key: 'cricket',    name: 'Cricket',    emoji: '🏏' },
  { key: 'football',   name: 'Football',   emoji: '⚽' },
  { key: 'f1',         name: 'Formula 1',  emoji: '🏎️' },
  { key: 'basketball', name: 'Basketball', emoji: '🏀' },
  { key: 'tennis',     name: 'Tennis',     emoji: '🎾' },
  { key: 'hockey',     name: 'Hockey',     emoji: '🏒' },
  { key: 'nfl',        name: 'NFL',        emoji: '🏈' },
  { key: 'baseball',   name: 'Baseball',   emoji: '⚾' },
  { key: 'golf',       name: 'Golf',       emoji: '⛳' },
  { key: 'mma',        name: 'UFC / MMA',  emoji: '🥊' },
  { key: 'rugby',      name: 'Rugby',      emoji: '🏉' },
];

const RACING = new Set(['f1', 'nascar', 'indycar']);

// ── Date/time helpers ─────────────────────────────────────────────────────
function toIST(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr);
}

function fmtMatchTime(dateStr) {
  const d = toIST(dateStr);
  if (!d) return '';
  const now = new Date();
  const opts = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' };
  const timeStr = d.toLocaleTimeString('en-IN', opts) + ' IST';
  if (d.toDateString() === now.toDateString()) return `Today · ${timeStr}`;
  if (d.toDateString() === new Date(Date.now() + 86400000).toDateString()) return `Tomorrow · ${timeStr}`;
  const dateStr2 = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  return `${dateStr2} · ${timeStr}`;
}

function fmtResultDate(dateStr) {
  const d = toIST(dateStr);
  if (!d) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

// ── Match card ─────────────────────────────────────────────────────────────
function MatchCard({ m, showSport }) {
  const isLive   = m.state === 'in';
  const isPre    = m.state === 'pre';
  const isPost   = m.state === 'post';
  const isRacing = RACING.has(m.sport);

  return (
    <div className={`sp-card sp-card-${isLive ? 'live' : isPre ? 'pre' : 'done'}`}>

      {/* Sport badge — shown only in "All" view */}
      {showSport && (
        <span className="sp-sport-tag">{m.emoji} {m.sportName}</span>
      )}

      {/* Match title */}
      <p className="sp-match">{m.match}</p>

      {/* Live: clock + period */}
      {isLive && (m.clock || m.period || m.detail) && (
        <p className="sp-live-clock">
          {[
            m.period  ? `Period ${m.period}` : null,
            m.clock   || null,
            m.detail  || null,
          ].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Competitors / scores */}
      {m.competitors.length > 0 && (
        <div className="sp-teams">
          {m.competitors.map((c, i) => (
            <div key={i} className={`sp-team${c.winner ? ' sp-winner' : ''}`}>
              {isRacing && <span className="sp-pos">P{i + 1}</span>}
              <span className="sp-team-name">{c.name}</span>
              {/* Score shown for live + results, not pre */}
              {!isPre && c.score !== '' && c.score !== undefined && (
                <span className="sp-score">{c.score}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer info */}
      <div className="sp-meta">
        {/* Upcoming: show start time */}
        {isPre && m.date && (
          <span className="sp-time">🕐 {fmtMatchTime(m.date)}</span>
        )}
        {/* Results: show date + summary */}
        {isPost && (
          <>
            {m.date && <span className="sp-meta-date">📅 {fmtResultDate(m.date)}</span>}
            {m.summary && <span className="sp-summary">{m.summary}</span>}
          </>
        )}
        {/* Live: show summary (e.g. "2nd Innings", "Q3") */}
        {isLive && m.summary && !m.clock && (
          <span className="sp-summary">{m.summary}</span>
        )}
        {/* Venue */}
        {m.venue && <span className="sp-venue">📍 {m.venue}</span>}
      </div>
    </div>
  );
}

// ── Section block (Live / Upcoming / Results) ─────────────────────────────
function Section({ title, icon, matches, showSport, max = 12 }) {
  if (matches.length === 0) return null;
  const shown = matches.slice(0, max);
  return (
    <div className="sp-section">
      <div className="sp-section-hdr">
        <span className="sp-section-title">{icon} {title}</span>
        <span className="sp-section-count">{matches.length} {matches.length === 1 ? 'match' : 'matches'}</span>
      </div>
      <div className={`sp-cards${shown.length >= 2 ? ' sp-cards-grid' : ''}`}>
        {shown.map(m => <MatchCard key={`${m.sport}-${m.id}`} m={m} showSport={showSport} />)}
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────
export default memo(function SportsWidget() {
  const { live, upcoming, completed, counts, loading } = useSports();
  const [sport, setSport] = useState('all');

  // Sports that actually have data
  const all = useMemo(() => [...live, ...upcoming, ...completed], [live, upcoming, completed]);
  const activeSports = useMemo(() => {
    const keys = new Set(all.map(m => m.sport));
    return SPORT_CONFIG.filter(s => keys.has(s.key));
  }, [all]);

  // Filter helper
  const filter = (arr) => sport === 'all' ? arr : arr.filter(m => m.sport === sport);

  const fLive     = filter(live);
  const fUpcoming = filter(upcoming);
  const fResults  = filter(completed);
  const total     = fLive.length + fUpcoming.length + fResults.length;

  if (!loading && all.length === 0) return null;

  return (
    <section className="sp-wrap" aria-label="Sports scores">

      {/* Header row */}
      <div className="sp-head">
        <span className="sp-title">🏆 Sports</span>
        <div className="sp-head-right">
          {counts.live > 0 && (
            <span className="sp-live-pill">
              <span className="sp-live-dot" />{counts.live} live
            </span>
          )}
          <span className="sp-refresh-note">· refreshes every 3 min</span>
        </div>
      </div>

      {/* Sport filter strip: All | Cricket | Football | … */}
      {activeSports.length > 0 && (
        <div className="sp-filter" role="tablist" aria-label="Filter by sport">
          <button
            role="tab"
            aria-selected={sport === 'all'}
            className={`sp-filter-btn${sport === 'all' ? ' sp-fbtn-on' : ''}`}
            onClick={() => setSport('all')}
          >
            All
          </button>
          {activeSports.map(s => (
            <button
              key={s.key}
              role="tab"
              aria-selected={sport === s.key}
              className={`sp-filter-btn${sport === s.key ? ' sp-fbtn-on' : ''}`}
              onClick={() => setSport(s.key)}
            >
              {s.emoji} {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && all.length === 0 && <div className="sp-skeleton" aria-hidden />}

      {/* No data for selected sport */}
      {!loading && total === 0 && all.length > 0 && (
        <p className="sp-empty">No {sport === 'all' ? '' : sport + ' '}matches in the last 48 hours.</p>
      )}

      {/* Three sections — all visible at once */}
      {total > 0 && (
        <div className="sp-body">
          <Section title="Live"           icon="🔴" matches={fLive}     showSport={sport === 'all'} />
          <Section title="Upcoming"       icon="📅" matches={fUpcoming} showSport={sport === 'all'} max={8} />
          <Section title="Recent Results" icon="✓"  matches={fResults}  showSport={sport === 'all'} max={6} />
        </div>
      )}
    </section>
  );
});
