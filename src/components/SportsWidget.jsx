import { memo, useState } from 'react';
import { useSports } from '../hooks/useSports.js';

// Format event date/time relative to now
function formatEventTime(dateStr) {
  if (!dateStr) return '';
  const d   = new Date(dateStr);
  const now  = new Date();
  const diff = d - now;

  const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

  const today    = now.toDateString();
  const tomorrow = new Date(now.getTime() + 86400000).toDateString();

  if (d.toDateString() === today)    return `Today ${timeStr} IST`;
  if (d.toDateString() === tomorrow) return `Tomorrow ${timeStr} IST`;

  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })
       + ` · ${timeStr} IST`;
}

function CompetitorRow({ c, isRacing, idx, state }) {
  const showScore = state !== 'pre' && c.score !== '' && c.score !== '0';
  return (
    <div className={`sp-team${c.winner ? ' sp-winner' : ''}`}>
      {isRacing && <span className="sp-pos">P{idx + 1}</span>}
      <span className="sp-team-name">{c.name}</span>
      {showScore && <span className="sp-score">{c.score}</span>}
    </div>
  );
}

function MatchCard({ m }) {
  const isRacing = ['f1', 'nascar', 'indycar'].includes(m.sport);
  const isLive   = m.state === 'in';
  const isPre    = m.state === 'pre';
  const isPost   = m.state === 'post';

  return (
    <div className={`sp-card${isLive ? ' sp-card-live' : isPre ? ' sp-card-pre' : ' sp-card-done'}`}>
      {/* Sport + status row */}
      <div className="sp-card-top">
        <span className="sp-sport-tag">{m.emoji} {m.sportName}</span>
        {isLive && (
          <span className="sp-live-badge">
            <span className="sp-live-dot" />LIVE
            {m.clock ? ` · ${m.clock}` : ''}
            {m.period ? ` · ${m.detail || 'P' + m.period}` : ''}
          </span>
        )}
        {isPre  && <span className="sp-pre-badge">Upcoming</span>}
        {isPost && <span className="sp-done-badge">✓ Final</span>}
      </div>

      {/* Match title */}
      <p className="sp-match">{m.match}</p>

      {/* Competitors / results */}
      {m.competitors.length > 0 ? (
        <div className="sp-teams">
          {m.competitors.map((c, i) => (
            <CompetitorRow key={i} c={c} isRacing={isRacing} idx={i} state={m.state} />
          ))}
        </div>
      ) : null}

      {/* Time for upcoming, status for live/finished */}
      <div className="sp-meta">
        {isPre  && <span className="sp-time">🕐 {formatEventTime(m.date)}</span>}
        {isLive && m.summary && <span className="sp-detail">{m.summary}</span>}
        {isPost && m.summary && <span className="sp-detail">{m.summary}</span>}
        {m.venue && <span className="sp-venue">📍 {m.venue}</span>}
      </div>
    </div>
  );
}

const TABS = [
  { key: 'live',     label: 'Live',      icon: '🔴' },
  { key: 'upcoming', label: 'Upcoming',  icon: '📅' },
  { key: 'results',  label: 'Results',   icon: '✓'  },
];

const SPORT_FILTERS = [
  { key: 'all',        label: 'All'         },
  { key: 'cricket',    label: '🏏 Cricket'  },
  { key: 'football',   label: '⚽ Football' },
  { key: 'f1',         label: '🏎️ F1'      },
  { key: 'basketball', label: '🏀 NBA'      },
  { key: 'tennis',     label: '🎾 Tennis'   },
  { key: 'hockey',     label: '🏒 Hockey'   },
  { key: 'nfl',        label: '🏈 NFL'      },
  { key: 'baseball',   label: '⚾ MLB'      },
  { key: 'golf',       label: '⛳ Golf'     },
  { key: 'mma',        label: '🥊 MMA'      },
  { key: 'rugby',      label: '🏉 Rugby'    },
];

export default memo(function SportsWidget() {
  const { live, upcoming, completed, counts, loading } = useSports();
  const [tab,    setTab]    = useState('live');
  const [sport,  setSport]  = useState('all');

  // Decide default tab: show live if any, else upcoming, else results
  const defaultTab = counts.live > 0 ? 'live' : counts.upcoming > 0 ? 'upcoming' : 'results';
  const activeTab  = tab === 'live' && counts.live === 0 ? defaultTab : tab;

  // Matches for the active section
  const sectionMap = { live, upcoming, results: completed };
  const sectionMatches = sectionMap[activeTab] ?? [];

  // Sport filter — only show sport buttons that have data in this section
  const sports = new Set(sectionMatches.map(m => m.sport));
  const visibleSports = SPORT_FILTERS.filter(s => s.key === 'all' || sports.has(s.key));
  const filtered = sport === 'all'
    ? sectionMatches
    : sectionMatches.filter(m => m.sport === sport);

  // Don't render if truly nothing to show
  const totalMatches = live.length + upcoming.length + completed.length;
  if (!loading && totalMatches === 0) return null;

  const emptyMsg = {
    live:     'No live matches right now.',
    upcoming: 'No upcoming matches in the next 48 hours.',
    results:  'No recent results in the last 24 hours.',
  };

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

      {/* Section tabs: Live | Upcoming | Results */}
      <div className="sp-section-tabs" role="tablist">
        {TABS.map(t => {
          const count = t.key === 'results'
            ? counts.completed
            : t.key === 'live' ? counts.live : counts.upcoming;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={activeTab === t.key}
              className={`sp-section-tab${activeTab === t.key ? ' sp-stab-on' : ''}${count === 0 ? ' sp-stab-empty' : ''}`}
              onClick={() => { setTab(t.key); setSport('all'); }}
            >
              {t.icon} {t.label}
              {count > 0 && <span className="sp-stab-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Sport filter strip — only when multiple sports have data */}
      {visibleSports.length > 2 && (
        <div className="sp-sport-strip" role="tablist" aria-label="Filter by sport">
          {visibleSports.map(s => (
            <button
              key={s.key}
              role="tab"
              aria-selected={sport === s.key}
              className={`sp-sport-btn${sport === s.key ? ' sp-sbtn-on' : ''}`}
              onClick={() => setSport(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Match cards */}
      {loading && totalMatches === 0 ? (
        <div className="sp-skeleton" aria-hidden />
      ) : filtered.length === 0 ? (
        <p className="sp-empty">{emptyMsg[activeTab]}</p>
      ) : (
        <div className="sp-grid">
          {filtered.slice(0, 20).map(m => (
            <MatchCard key={`${m.sport}-${m.id}`} m={m} />
          ))}
        </div>
      )}
    </section>
  );
});
