import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { todayIST, useHistory } from '../hooks/useHistory.js';

const CAT_ICON = {
  Science:     '🔬',
  Politics:    '🏛️',
  Art:         '🎨',
  Sports:      '🏆',
  Technology:  '💻',
  World:       '🌍',
  India:       '🇮🇳',
  Achievement: '⭐',
  Disaster:    '⚠️',
  History:     '📜',
};

const MAX_DAYS_BACK = 30;

function shiftDate(isoDate, delta) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDisplay(isoDate, locale) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale || 'en-IN', {
    day: 'numeric', month: 'long',
  });
}

export default memo(function TodayHistory({ target }) {
  const todayStr = todayIST();
  const minDate  = shiftDate(todayStr, -MAX_DAYS_BACK);

  const [selectedDate, setSelectedDate] = useState(null); // null = today
  const [index, setIndex]       = useState(0);
  const [expanded, setExpanded] = useState(false);
  const touchX = useRef(null);

  const currentDate = selectedDate || todayStr;
  const isToday     = currentDate === todayStr;
  const atLimit     = currentDate <= minDate;
  const locale      = target && target !== 'en' ? target : 'en-IN';

  const { events, status } = useHistory(currentDate);
  const count = events.length;

  useEffect(() => { setIndex(0); setExpanded(false); }, [currentDate]);

  const goPrevDay = useCallback(() => {
    if (!atLimit) setSelectedDate(shiftDate(currentDate, -1));
  }, [currentDate, atLimit]);

  const goNextDay = useCallback(() => {
    if (!isToday) setSelectedDate(shiftDate(currentDate, 1));
  }, [currentDate, isToday]);

  const goToday = useCallback(() => setSelectedDate(null), []);

  const prev = useCallback(() => setIndex(i => (i - 1 + count) % count), [count]);
  const next = useCallback(() => setIndex(i => (i + 1) % count), [count]);

  const onTouchStart = useCallback(e => { touchX.current = e.touches[0].clientX; }, []);
  const onTouchEnd   = useCallback(e => {
    if (touchX.current === null) return;
    const dx = touchX.current - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 50) dx > 0 ? next() : prev();
    touchX.current = null;
  }, [next, prev]);

  useEffect(() => {
    if (!expanded) return;
    const h = e => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [expanded]);

  useEffect(() => {
    document.body.style.overflow = expanded ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [expanded]);

  if (status === 'loading' && !selectedDate) return <div className="th-skeleton" aria-hidden />;

  const ev   = count > 0 ? events[index] : null;
  const icon = ev ? (CAT_ICON[ev.category] || '📅') : '📅';
  const detailParas = (ev?.details || '').split('\n\n').filter(p => p.trim().length > 0);

  return (
    <>
      <section
        className="th-wrap"
        aria-label="Today in History"
        onTouchStart={count > 0 ? onTouchStart : undefined}
        onTouchEnd={count > 0 ? onTouchEnd : undefined}
      >
        <span className="th-ring th-ring-1" aria-hidden />
        <span className="th-ring th-ring-2" aria-hidden />

        {/* ── Header: label + date-with-arrows | count ── */}
        <div className="th-head">
          <div className="th-head-left">
            <div className="th-label-row">
              <span className="th-label">On this day</span>
              {!isToday && (
                <button className="th-back-today" onClick={goToday} aria-label="Back to today">
                  Back to today
                </button>
              )}
            </div>
            {/* Date navigator — arrows hug the date text, clearly for date changes */}
            <div className="th-date-row">
              <button
                className="th-date-arrow"
                onClick={goPrevDay}
                disabled={atLimit}
                aria-label="Previous day"
                title="Previous day"
              >&#8249;</button>
              <span className="th-today">{formatDisplay(currentDate, locale)}</span>
              <button
                className="th-date-arrow"
                onClick={goNextDay}
                disabled={isToday}
                aria-label="Next day"
                title="Next day"
              >&#8250;</button>
            </div>
          </div>

          {/* Event counter — top-right, no arrows near it */}
          {count > 1 && status === 'success' && (
            <span className="th-count" aria-live="polite">
              {index + 1} <span aria-hidden>/</span> {count}
            </span>
          )}
        </div>

        {/* ── Content ── */}
        {status === 'loading' ? (
          <div className="th-day-loading" aria-hidden />
        ) : count === 0 ? (
          <p className="th-no-data">No history recorded for this date yet.</p>
        ) : (
          <div className="th-content">
            <div className="th-top-row">
              <span className="th-year">{ev.event_year}</span>
              <span className="th-cat">{icon} {ev.category}</span>
            </div>
            <h3 className="th-title">{ev.title}</h3>
            <p className="th-desc">{ev.description}</p>
            <button
              className="th-readmore"
              onClick={() => setExpanded(true)}
              aria-haspopup="dialog"
            >
              Read more ›
            </button>
          </div>
        )}

        {/* ── Carousel nav (event switching, bottom) ── */}
        {count > 1 && (
          <div className="th-nav">
            <button className="th-arrow" onClick={prev} aria-label="Previous event">&#8249;</button>
            <div className="th-dots" role="tablist" aria-label="Events">
              {events.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Event ${i + 1}`}
                  className={`th-dot${i === index ? ' on' : ''}`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            <button className="th-arrow" onClick={next} aria-label="Next event">&#8250;</button>
          </div>
        )}
      </section>

      {/* ── Detail modal ── */}
      {expanded && ev && (
        <div
          className="th-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={ev.title}
          onClick={() => setExpanded(false)}
        >
          <div className="th-modal" onClick={e => e.stopPropagation()}>
            <button className="th-modal-close" onClick={() => setExpanded(false)} aria-label="Close">✕</button>
            <div className="th-modal-top-row">
              <span className="th-year">{ev.event_year}</span>
              <span className="th-cat">{icon} {ev.category}</span>
            </div>
            <h2 className="th-modal-title">{ev.title}</h2>
            <div className="th-modal-body">
              {detailParas.length > 0
                ? detailParas.map((para, i) => <p key={i}>{para}</p>)
                : <p>{ev.description}</p>
              }
            </div>
          </div>
        </div>
      )}
    </>
  );
});
