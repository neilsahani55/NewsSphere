import { memo, useState } from 'react';
import { useSports } from '../hooks/useSports.js';

const STATE_BADGE = {
  in:   { label: '🔴 LIVE',    cls: 'sw-live'    },
  pre:  { label: 'Upcoming',   cls: 'sw-upcoming' },
  post: { label: 'Finished',   cls: 'sw-finished' },
};

function ScoreRow({ competitor, highlight }) {
  return (
    <div className={`sw-team${highlight ? ' sw-winner' : ''}`}>
      <span className="sw-team-name">{competitor.name}</span>
      {competitor.score !== '' && (
        <span className="sw-team-score">{competitor.score}</span>
      )}
    </div>
  );
}

function MatchCard({ match }) {
  const badge = STATE_BADGE[match.state] ?? STATE_BADGE.post;

  return (
    <div className={`sw-card ${badge.cls}`}>
      {/* Sport label + status */}
      <div className="sw-card-head">
        <span className="sw-sport">{match.emoji} {match.name}</span>
        <span className={`sw-badge ${badge.cls}-badge`}>{badge.label}</span>
      </div>

      {/* Match name (event title) */}
      <p className="sw-match-name">{match.match}</p>

      {/* Competitors + scores */}
      {match.competitors.length > 0 && (
        <div className="sw-scores">
          {match.competitors.map((c, i) => (
            <ScoreRow key={i} competitor={c} highlight={c.winner && match.state === 'post'} />
          ))}
        </div>
      )}

      {/* Status detail (e.g. "Q3 · 4:32", "Day 2 · Stumps", "Lap 42/57") */}
      {(match.detail || match.summary) && (
        <p className="sw-status">{match.detail || match.summary}</p>
      )}
    </div>
  );
}

const ALL_SPORTS = [
  { key: 'all',        label: 'All'        },
  { key: 'cricket',    label: '🏏 Cricket'  },
  { key: 'football',   label: '⚽ Football' },
  { key: 'f1',         label: '🏎️ F1'       },
  { key: 'basketball', label: '🏀 NBA'      },
  { key: 'tennis',     label: '🎾 Tennis'   },
  { key: 'hockey',     label: '🏒 Hockey'   },
  { key: 'nfl',        label: '🏈 NFL'      },
  { key: 'baseball',   label: '⚾ Baseball' },
  { key: 'golf',       label: '⛳ Golf'     },
  { key: 'mma',        label: '🥊 MMA'      },
  { key: 'rugby',      label: '🏉 Rugby'    },
];

export default memo(function SportsWidget() {
  const { matches, liveMatches, upcomingMatches, counts, loading } = useSports();
  const [filter, setFilter] = useState('all');

  // Which sports actually have data?
  const activeSports = new Set(matches.map(m => m.sport));
  const visibleTabs  = ALL_SPORTS.filter(s => s.key === 'all' || activeSports.has(s.key));

  // Apply filter
  const shown = (filter === 'all' ? matches : matches.filter(m => m.sport === filter))
    .slice(0, 20);

  // Don't render if nothing to show and not loading
  if (!loading && matches.length === 0) return null;

  return (
    <section className="sw-wrap" aria-label="Live sports scores">
      {/* Header */}
      <div className="sw-head">
        <span className="sw-title">🏆 Sports</span>
        {counts.live > 0 && (
          <span className="sw-live-count">🔴 {counts.live} live</span>
        )}
      </div>

      {/* Sport filter tabs — only show tabs for sports with data */}
      {visibleTabs.length > 1 && (
        <div className="sw-tabs" role="tablist">
          {visibleTabs.map(s => (
            <button
              key={s.key}
              role="tab"
              aria-selected={filter === s.key}
              className={`sw-tab${filter === s.key ? ' sw-tab-on' : ''}`}
              onClick={() => setFilter(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Match cards */}
      {loading && matches.length === 0 ? (
        <div className="sw-skeleton" aria-hidden />
      ) : shown.length === 0 ? (
        <p className="sw-empty">No {filter === 'all' ? '' : filter + ' '}matches right now.</p>
      ) : (
        <div className="sw-grid">
          {shown.map(m => <MatchCard key={`${m.sport}-${m.id}`} match={m} />)}
        </div>
      )}
    </section>
  );
});
