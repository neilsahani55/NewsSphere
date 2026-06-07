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

// ── Time helpers ──────────────────────────────────────────────────────────
function fmtTime(dateStr) {
  if (!dateStr) return '';
  const d   = new Date(dateStr);
  const now  = new Date();
  const t    = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  const day  = d.toDateString();
  if (day === now.toDateString())  return `Today · ${t} IST`;
  if (day === new Date(Date.now() + 86400000).toDateString()) return `Tomorrow · ${t} IST`;
  if (day === new Date(Date.now() - 86400000).toDateString()) return `Yesterday · ${t} IST`;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) + ` · ${t} IST`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === new Date(Date.now() - 86400000).toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

// ── Match card ────────────────────────────────────────────────────────────
function MatchCard({ m, showSport }) {
  const isLive   = m.state === 'in';
  const isPre    = m.state === 'pre';
  const isPost   = m.state === 'post';
  const isRacing = RACING.has(m.sport);

  return (
    <div className={`sp-card sp-card-${isLive ? 'live' : isPre ? 'pre' : 'done'}`}>

      {/* Sport + league label row */}
      <div className="sp-card-label">
        {showSport && <span className="sp-sport-tag">{m.emoji} {m.sportName}</span>}
        {m.league  && <span className="sp-league-tag">{m.league}</span>}
      </div>

      {/* Match title */}
      <p className="sp-match">{m.match}</p>

      {/* Live: clock pill */}
      {isLive && (m.clock || m.detail) && (
        <span className="sp-live-clock">
          🔴 {[m.clock, m.detail].filter(Boolean).join(' · ')}
        </span>
      )}

      {/* Competitors */}
      {m.competitors.length > 0 && (
        <div className="sp-teams">
          {m.competitors.map((c, i) => (
            <div key={i} className={`sp-team${c.winner ? ' sp-winner' : ''}`}>
              {isRacing && <span className="sp-pos">P{i + 1}</span>}
              <span className="sp-team-name">{c.name}</span>
              {!isPre && c.score !== '' && c.score !== undefined && (
                <span className="sp-score">{c.score}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="sp-meta">
        {isPre  && m.date && <span className="sp-time">🕐 {fmtTime(m.date)}</span>}
        {isPost && m.date && <span className="sp-meta-date">📅 {fmtDate(m.date)}</span>}
        {(isPost || (isLive && !m.clock)) && m.summary && (
          <span className="sp-summary">{m.summary}</span>
        )}
        {m.venue && <span className="sp-venue">📍 {m.venue}</span>}
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────
export default memo(function SportsWidget() {
  const { live, upcoming, completed, counts, loading } = useSports();
  const [sport, setSport] = useState('all');
  const [tab,   setTab]   = useState('live');  // live | upcoming | results

  const all = useMemo(() => [...live, ...upcoming, ...completed], [live, upcoming, completed]);

  // Sports that have data
  const activeSports = useMemo(() => {
    const keys = new Set(all.map(m => m.sport));
    return SPORT_CONFIG.filter(s => keys.has(s.key));
  }, [all]);

  // Filter by selected sport
  const f  = (arr) => sport === 'all' ? arr : arr.filter(m => m.sport === sport);
  const fLive     = f(live);
  const fUpcoming = f(upcoming);
  const fResults  = f(completed);

  // Active tab's matches
  const shown = tab === 'live' ? fLive : tab === 'upcoming' ? fUpcoming : fResults;

  // Count per sport per tab (used to badge filter buttons)
  const tabData = tab === 'live' ? live : tab === 'upcoming' ? upcoming : completed;
  const sportCount = useMemo(() => {
    const m = {};
    for (const ev of tabData) m[ev.sport] = (m[ev.sport] ?? 0) + 1;
    return m;
  }, [tabData]);

  if (!loading && all.length === 0) return null;

  return (
    <section className="sp-wrap" aria-label="Sports">

      {/* Header */}
      <div className="sp-head">
        <span className="sp-title">🏆 Sports</span>
        {counts.live > 0 && (
          <span className="sp-live-pill">
            <span className="sp-live-dot" />{counts.live} live
          </span>
        )}
      </div>

      {/* Row 1: Sport filter with per-tab count badges */}
      {activeSports.length > 0 && (
        <div className="sp-filter" role="tablist" aria-label="Sport">
          <button
            role="tab" aria-selected={sport === 'all'}
            className={`sp-filter-btn${sport === 'all' ? ' sp-fbtn-on' : ''}`}
            onClick={() => setSport('all')}
          >
            All
            {tabData.length > 0 && <span className="sp-fbtn-cnt">{tabData.length}</span>}
          </button>
          {activeSports.map(s => {
            const cnt = sportCount[s.key] ?? 0;
            return (
              <button
                key={s.key} role="tab" aria-selected={sport === s.key}
                className={`sp-filter-btn${sport === s.key ? ' sp-fbtn-on' : ''}${cnt === 0 ? ' sp-fbtn-dim' : ''}`}
                onClick={() => setSport(s.key)}
              >
                {s.emoji} {s.name}
                {cnt > 0 && <span className="sp-fbtn-cnt">{cnt}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Row 2: Section tabs — Live | Upcoming | Results */}
      <div className="sp-tabs" role="tablist" aria-label="Section">
        {[
          { key: 'live',     label: 'Live',     icon: '🔴', count: fLive.length     },
          { key: 'upcoming', label: 'Upcoming', icon: '📅', count: fUpcoming.length },
          { key: 'results',  label: 'Results',  icon: '✓',  count: fResults.length  },
        ].map(t => (
          <button
            key={t.key} role="tab" aria-selected={tab === t.key}
            className={`sp-tab sp-tab-${t.key}${tab === t.key ? ' sp-tab-on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
            {t.count > 0 && <span className="sp-tab-cnt">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Match cards — always 3-column grid */}
      {loading && all.length === 0 ? (
        <div className="sp-skeleton" aria-hidden />
      ) : shown.length === 0 ? (
        <p className="sp-empty">
          {sport !== 'all'
            ? `No ${tab} matches for this sport right now — try another tab or sport.`
            : tab === 'live'     ? 'No live matches right now.'
            : tab === 'upcoming' ? 'No upcoming matches in the next 2 days.'
            :                      'No results from the last 2 days.'
          }
        </p>
      ) : (
        <div className="sp-grid4">
          {shown.slice(0, 16).map(m => (
            <MatchCard key={`${m.sport}-${m.id}`} m={m} showSport={sport === 'all'} />
          ))}
        </div>
      )}
    </section>
  );
});
