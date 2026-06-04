import { memo } from 'react';
import { daysUntil, getUpcomingHolidays } from '../data/indianHolidays.js';

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

export default memo(function HolidayWidget() {
  const holidays = getUpcomingHolidays(4);
  if (!holidays.length) return null;

  const [next, ...rest] = holidays;
  const nextDays = daysUntil(next.date);

  return (
    <section className="hol-wrap" aria-label="Upcoming Indian holidays">
      <div className="hol-head">
        <span className="hol-title">Holidays & Festivals</span>
      </div>

      {/* Featured next holiday */}
      <div className="hol-featured">
        <span className="hol-emoji" aria-hidden>{next.emoji}</span>
        <div className="hol-feat-body">
          <span className="hol-feat-name">{next.name}</span>
          <span className="hol-feat-date">{formatDate(next.date)}</span>
        </div>
        <DaysChip days={nextDays} />
      </div>

      {/* Upcoming list */}
      {rest.length > 0 && (
        <ul className="hol-list">
          {rest.map(h => (
            <li key={h.date} className="hol-item">
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
