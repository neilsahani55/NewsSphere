import { Component, memo, useMemo, useState } from 'react';
import { useSports } from '../hooks/useSports.js';

const SPORT_CONFIG = [
  // Indian sports first
  { key: 'cricket',     name: 'Cricket',      emoji: '🏏' },
  { key: 'kabaddi',     name: 'Kabaddi',      emoji: '🤸' },
  { key: 'fieldhockey', name: 'Field Hockey', emoji: '🏑' },
  { key: 'badminton',   name: 'Badminton',    emoji: '🏸' },
  // International
  { key: 'football',    name: 'Football',     emoji: '⚽' },
  { key: 'tennis',      name: 'Tennis',       emoji: '🎾' },
  { key: 'f1',          name: 'Formula 1',    emoji: '🏎️' },
  { key: 'basketball',  name: 'Basketball',   emoji: '🏀' },
  { key: 'rugby',       name: 'Rugby',        emoji: '🏉' },
  { key: 'golf',        name: 'Golf',         emoji: '⛳' },
  { key: 'tabletennis', name: 'Table Tennis', emoji: '🏓' },
  { key: 'volleyball',  name: 'Volleyball',   emoji: '🏐' },
  { key: 'athletics',   name: 'Athletics',    emoji: '🏃' },
  { key: 'boxing',      name: 'Boxing',       emoji: '🥊' },
  { key: 'mma',         name: 'MMA',          emoji: '🥊' },
  { key: 'wrestling',   name: 'Wrestling',    emoji: '🤼' },
  { key: 'squash',      name: 'Squash',       emoji: '🎱' },
  { key: 'swimming',    name: 'Swimming',     emoji: '🏊' },
];

const RACING = new Set(['f1', 'nascar', 'indycar']);

// ── IST date/time helpers ─────────────────────────────────────────────────
// Always use Asia/Kolkata for comparisons — toDateString() uses local/server TZ
// which is UTC on Vercel, causing off-by-one errors around midnight IST.

const IST_OPTS = { timeZone: 'Asia/Kolkata' };

function istDateStr(date) {
  // Returns "YYYY-MM-DD" in IST — used for day comparisons
  return date.toLocaleDateString('sv-SE', IST_OPTS); // sv-SE gives ISO format
}

function fmtTime(dateStr) {
  if (!dateStr) return '';
  const d   = new Date(dateStr);
  const now = new Date();
  const t   = d.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, ...IST_OPTS,
  });

  const dDay   = istDateStr(d);
  const today  = istDateStr(now);
  const tmrw   = istDateStr(new Date(Date.now() + 86400000));
  const yest   = istDateStr(new Date(Date.now() - 86400000));

  if (dDay === today) return `Today · ${t} IST`;
  if (dDay === tmrw)  return `Tomorrow · ${t} IST`;
  if (dDay === yest)  return `Yesterday · ${t} IST`;
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', ...IST_OPTS,
  }) + ` · ${t} IST`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d   = new Date(dateStr);
  const now = new Date();
  if (istDateStr(d) === istDateStr(now))                           return 'Today';
  if (istDateStr(d) === istDateStr(new Date(Date.now() - 86400000))) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...IST_OPTS });
}

function normalizeLiveText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function dedupeLiveParts(parts) {
  const out = [];
  for (const part of parts) {
    const clean = normalizeLiveText(part);
    if (!clean) continue;
    const lower = clean.toLowerCase();
    const exists = out.some((item) => {
      const current = item.toLowerCase();
      return current === lower || current.includes(lower) || lower.includes(current);
    });
    if (!exists) out.push(clean);
  }
  return out;
}

function buildLiveStatus(m) {
  const blockers = [m.match, m.matchType, m.league]
    .map((value) => normalizeLiveText(value).toLowerCase())
    .filter(Boolean);

  const rawParts = [m.clock, m.detail]
    .flatMap((value) => normalizeLiveText(value).split(/\s+[·|-]\s+/))
    .map((value) => value.replace(/^live\s*[:-]?\s*/i, '').trim())
    .filter(Boolean)
    .filter((value) => {
      const lower = value.toLowerCase();
      if (lower === 'live') return false;
      return !blockers.some((blocker) => lower === blocker || blocker.includes(lower) || lower.includes(blocker));
    });

  const compact = dedupeLiveParts(rawParts);
  if (compact.length === 0) return '';
  return compact.join(' · ');
}

// ── Match card ────────────────────────────────────────────────────────────
function MatchCard({ m, showSport }) {
  const isLive   = m.state === 'in';
  const isPre    = m.state === 'pre';
  const isPost   = m.state === 'post';
  const isRacing = RACING.has(m.sport);
  const footerTime = (isPre || isPost) && m.date ? fmtTime(m.date) : '';
  const footerLeague = isPost ? m.league : '';
  const showFooter = Boolean(footerTime || footerLeague);

  return (
    <div className={`sp-card sp-card-${isLive ? 'live' : isPre ? 'pre' : 'done'}`}>

      {/* Sport + league label row */}
      <div className={`sp-card-label${showSport ? '' : ' sp-card-label-compact'}`}>
        {showSport && <span className="sp-sport-tag">{m.emoji} {m.sportName}</span>}
        {m.league  && <span className="sp-league-tag">{m.league}</span>}
      </div>

      {/* Match title */}
      <p className="sp-match">{m.match}</p>

      {m.venue && (
        <div className="sp-meta-line">
          {m.venue && <span className="sp-venue">📍 {m.venue}</span>}
        </div>
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
      {showFooter && (
        <div className="sp-meta">
          {footerTime && <span className="sp-time">🕐 {footerTime}</span>}
          {footerLeague && <span className="sp-result">🏆 {footerLeague}</span>}
        </div>
      )}
    </div>
  );
}

class SportsWidgetErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Sports widget crashed', error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <section className="sp-wrap" aria-label="Sports">
        <div className="sp-head">
          <span className="sp-title">🏆 Sports</span>
        </div>
        <div className="sp-card-scroll">
          <div className="sp-empty-state">
            <div className="sp-empty-icon" aria-hidden>🏆</div>
            <h3>Sports is temporarily unavailable</h3>
            <p>This issue is isolated to the sports section. The rest of the page will keep working.</p>
            <button className="sp-filter-btn sp-fbtn-on" type="button" onClick={this.props.onRetry}>
              Retry sports
            </button>
          </div>
        </div>
      </section>
    );
  }
}

// ── Main widget ───────────────────────────────────────────────────────────
function SportsWidgetContent() {
  const { live, upcoming, completed, counts, loading, refreshing, refresh } = useSports();
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
        <div className="sp-head-right">
          <button
            type="button"
            className={`sp-refresh-btn${refreshing ? ' sp-refresh-btn-busy' : ''}`}
            onClick={refresh}
            disabled={refreshing}
            aria-label="Refresh sports"
          >
            ↻ Refresh
          </button>
          {counts.live > 0 && (
            <span className="sp-live-pill">
              <span className="sp-live-dot" />{counts.live} live
            </span>
          )}
        </div>
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

      <div className="sp-card-scroll">
        {/* Match cards — always 3-column grid */}
        {loading && all.length === 0 ? (
          <div className="sp-skeleton" aria-hidden />
        ) : shown.length === 0 ? (
          <p className="sp-empty">
            {sport !== 'all'
              ? `No ${tab} matches for this sport right now — try another tab or sport.`
              : tab === 'live'     ? 'No live matches right now.'
              : tab === 'upcoming' ? 'No upcoming matches in the next day.'
              :                      'No results from the last day.'
            }
          </p>
        ) : (
          <div className="sp-grid4">
            {shown.map(m => (
              <MatchCard key={`${m.sport}-${m.id}`} m={m} showSport={sport === 'all'} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default memo(function SportsWidget() {
  const [resetKey, setResetKey] = useState(0);

  return (
    <SportsWidgetErrorBoundary
      resetKey={resetKey}
      onRetry={() => setResetKey((value) => value + 1)}
    >
      <SportsWidgetContent key={resetKey} />
    </SportsWidgetErrorBoundary>
  );
});
