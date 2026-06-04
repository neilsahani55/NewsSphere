import { memo } from 'react';
import { daysUntil, useHolidays } from '../hooks/useHolidays.js';

function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  });
}

function DaysChip({ days }) {
  if (days === 0) return <span className="hol-chip hol-today">Today</span>;
  if (days === 1) return <span className="hol-chip hol-soon">Tomorrow</span>;
  if (days <= 7)  return <span className="hol-chip hol-soon">{days} days</span>;
  return <span className="hol-chip">{days} days</span>;
}

// Type → compact badge label
const TYPE_BADGE = {
  national:   '🇮🇳',
  festival:   '🎊',
  vrat:       '🙏',
  moon:       '🌙',
  regional:   '📍',
  observance: '📅',
};

export default memo(function HolidayWidget() {
  const { holidays, loading } = useHolidays();

  // Show next 5 upcoming holidays (mix of all types)
  const shown = holidays.slice(0, 5);

  if (loading && shown.length === 0) {
    return (
      <section className="hol-wrap" aria-label="Upcoming holidays">
        <div className="hol-head"><span className="hol-title">Holidays & Festivals</span></div>
        <div className="hol-skel" aria-hidden />
      </section>
    );
  }

  if (!loading && shown.length === 0) return null;

  const [next, ...rest] = shown;
  const nextDays = next ? daysUntil(next.date) : 0;

  return (
    <section className="hol-wrap" aria-label="Upcoming Indian holidays and festivals">
      <div className="hol-head">
        <span className="hol-title">Holidays & Festivals</span>
      </div>

      {/* Featured next event */}
      {next && (
        <div className="hol-featured">
          <span className="hol-emoji" aria-hidden>{next.emoji}</span>
          <div className="hol-feat-body">
            <span className="hol-feat-name">{next.name}</span>
            <span className="hol-feat-date">
              {formatDate(next.date)}
              {next.type && <span className="hol-type-dot">{TYPE_BADGE[next.type]}</span>}
            </span>
          </div>
          <DaysChip days={nextDays} />
        </div>
      )}

      {/* Next 4 events */}
      {rest.length > 0 && (
        <ul className="hol-list">
          {rest.map((h, i) => (
            <li key={`${h.date}-${i}`} className="hol-item">
              <span className="hol-item-emoji" aria-hidden>{h.emoji}</span>
              <span className="hol-item-name">{h.name}</span>
              <span className="hol-item-date">{formatDate(h.date)}</span>
              <span className="hol-item-days">{daysUntil(h.date)}d</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});
