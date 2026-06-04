import { memo } from 'react';
import { useCricket } from '../hooks/useCricket.js';

function ScoreRow({ competitor, highlight }) {
  return (
    <div className={`ckt-team${highlight ? ' ckt-winner' : ''}`}>
      <span className="ckt-team-name">{competitor.name}</span>
      <span className="ckt-team-score">{competitor.score || '—'}</span>
    </div>
  );
}

function MatchCard({ match }) {
  const isLive = match.state === 'in';
  const isPre  = match.state === 'pre';

  return (
    <div className={`ckt-card${isLive ? ' ckt-live' : ''}${isPre ? ' ckt-pre' : ''}`}>
      <div className="ckt-card-head">
        <span className="ckt-match-name">{match.name}</span>
        {isLive && <span className="ckt-badge ckt-badge-live">🔴 LIVE</span>}
        {isPre  && <span className="ckt-badge ckt-badge-pre">Upcoming</span>}
        {match.state === 'post' && <span className="ckt-badge ckt-badge-post">Result</span>}
      </div>

      {match.competitors.length > 0 && (
        <div className="ckt-scores">
          {match.competitors.map((c, i) => (
            <ScoreRow key={i} competitor={c} highlight={c.winner && match.state === 'post'} />
          ))}
        </div>
      )}

      {(match.summary || match.detail) && (
        <p className="ckt-summary">{match.summary || match.detail}</p>
      )}
    </div>
  );
}

export default memo(function CricketWidget() {
  const { liveMatches, upcomingMatches, loading } = useCricket();

  // Show only when there's a live match or upcoming match — never show empty state
  const toShow = liveMatches.length > 0 ? liveMatches : upcomingMatches.slice(0, 1);
  if (!loading && toShow.length === 0) return null;

  return (
    <section className="ckt-wrap" aria-label="Cricket scores">
      <div className="ckt-head">
        <span className="ckt-title">🏏 Cricket</span>
        {liveMatches.length > 0 && (
          <span className="ckt-live-count">{liveMatches.length} live</span>
        )}
      </div>

      {loading && !toShow.length ? (
        <div className="ckt-skeleton" aria-hidden />
      ) : (
        <div className="ckt-list">
          {toShow.map(m => <MatchCard key={m.id} match={m} />)}
        </div>
      )}
    </section>
  );
});
