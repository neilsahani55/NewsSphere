import { memo, useMemo, useState } from 'react';
import { useSports } from '../hooks/useSports.js';

// Sport display config (order matters — determines display order)
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

// Format event time relative to now in IST
function fmtTime(dateStr) {
  if (!dateStr) return '';
  const d   = new Date(dateStr);
  const now = new Date();
  const opts = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' };
  const t   = d.toLocaleTimeString('en-IN', opts);
  const day = d.toDateString();
  if (day === now.toDateString())
    return `Today · ${t} IST`;
  if (day === new Date(Date.now() + 86400000).toDateString())
    return `Tomorrow · ${t} IST`;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) + ` · ${t} IST`;
}

// ── Single competitor row ─────────────────────────────────────────────────
function CompRow({ c, idx, isRacing, showScore }) {
  return (
    <div className={`sp-team${c.winner ? ' sp-winner' : ''}`}>
      {isRacing && <span className="sp-pos">P{idx + 1}</span>}
      <span className="sp-team-name">{c.name}</span>
      {showScore && c.score !== '' && (
        <span className="sp-score">{c.score}</span>
      )}
    </div>
  );
}

// ── Single match card ─────────────────────────────────────────────────────
function MatchCard({ m }) {
  const isRacing = RACING.has(m.sport);
  const isLive   = m.state === 'in';
  const isPre    = m.state === 'pre';

  return (
    <div className={`sp-card${isLive ? ' sp-card-live' : isPre ? ' sp-card-pre' : ' sp-card-done'}`}>
      {/* Match name */}
      <p className="sp-match">{m.match}</p>

      {/* Competitors */}
      {m.competitors.length > 0 && (
        <div className="sp-teams">
          {m.competitors.map((c, i) => (
            <CompRow key={i} c={c} idx={i} isRacing={isRacing} showScore={!isPre} />
          ))}
        </div>
      )}

      {/* Status / time */}
      <div className="sp-meta">
        {isPre && m.date && <span className="sp-time">🕐 {fmtTime(m.date)}</span>}
        {isLive && (m.detail || m.clock) && (
          <span className="sp-detail">
            {[m.clock, m.detail].filter(Boolean).join(' · ')}
          </span>
        )}
        {!isLive && !isPre && m.summary && (
          <span className="sp-detail">{m.summary}</span>
        )}
        {m.venue && <span className="sp-venue">📍 {m.venue}</span>}
      </div>
    </div>
  );
}

// ── One sport's section with its own Live/Upcoming/Results mini-tabs ───────
function SportSection({ cfg, matches }) {
  const live     = useMemo(() => matches.filter(m => m.state === 'in'),   [matches]);
  const upcoming = useMemo(() => matches.filter(m => m.state === 'pre'),  [matches]);
  const results  = useMemo(() => matches.filter(m => m.state === 'post'), [matches]);

  // Start on the most relevant tab
  const [tab, setTab] = useState(() =>
    live.length > 0 ? 'live' : upcoming.length > 0 ? 'upcoming' : 'results'
  );

  // If selected tab has no data, fall back
  const activeTab = (() => {
    if (tab === 'live'     && live.length)     return 'live';
    if (tab === 'upcoming' && upcoming.length) return 'upcoming';
    if (tab === 'results'  && results.length)  return 'results';
    return live.length ? 'live' : upcoming.length ? 'upcoming' : 'results';
  })();

  const shown = activeTab === 'live' ? live : activeTab === 'upcoming' ? upcoming : results;

  return (
    <div className="sp-section">
      {/* Sport header */}
      <div className="sp-section-head">
        <span className="sp-section-name">{cfg.emoji} {cfg.name}</span>
        <div className="sp-section-badges">
          {live.length > 0 && (
            <span className="sp-live-badge">
              <span className="sp-live-dot" />LIVE {live.length}
            </span>
          )}
        </div>
      </div>

      {/* Mini tabs — only show tabs that have data */}
      {(live.length + upcoming.length + results.length) > 0 && (
        <div className="sp-mini-tabs">
          {live.length > 0 && (
            <button
              className={`sp-mini-tab${activeTab === 'live' ? ' sp-mtab-on sp-mtab-live' : ''}`}
              onClick={() => setTab('live')}
            >
              🔴 Live <span className="sp-mtab-cnt">{live.length}</span>
            </button>
          )}
          {upcoming.length > 0 && (
            <button
              className={`sp-mini-tab${activeTab === 'upcoming' ? ' sp-mtab-on sp-mtab-pre' : ''}`}
              onClick={() => setTab('upcoming')}
            >
              📅 Upcoming <span className="sp-mtab-cnt">{upcoming.length}</span>
            </button>
          )}
          {results.length > 0 && (
            <button
              className={`sp-mini-tab${activeTab === 'results' ? ' sp-mtab-on sp-mtab-done' : ''}`}
              onClick={() => setTab('results')}
            >
              ✓ Results <span className="sp-mtab-cnt">{results.length}</span>
            </button>
          )}
        </div>
      )}

      {/* Match cards — 2-col grid if 2+ matches, single col otherwise */}
      <div className={`sp-cards${shown.length >= 2 ? ' sp-cards-grid' : ''}`}>
        {shown.slice(0, 10).map(m => (
          <MatchCard key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────
export default memo(function SportsWidget() {
  const { matches, counts, loading } = useSports();

  // Group matches by sport key
  const bySport = useMemo(() => {
    const map = {};
    for (const m of matches) {
      (map[m.sport] ??= []).push(m);
    }
    return map;
  }, [matches]);

  // Sports that have at least one match, in display order
  const activeSports = SPORT_CONFIG.filter(s => bySport[s.key]?.length > 0);

  if (!loading && activeSports.length === 0) return null;

  return (
    <section className="sp-wrap" aria-label="Sports scores">
      {/* Header */}
      <div className="sp-head">
        <span className="sp-title">🏆 Sports</span>
        {counts.live > 0 && (
          <span className="sp-live-count">
            <span className="sp-live-dot" />{counts.live} live
          </span>
        )}
      </div>

      {loading && activeSports.length === 0 ? (
        <div className="sp-skeleton" aria-hidden />
      ) : (
        <div className="sp-sections">
          {activeSports.map(cfg => (
            <SportSection
              key={cfg.key}
              cfg={cfg}
              matches={bySport[cfg.key]}
            />
          ))}
        </div>
      )}
    </section>
  );
});
