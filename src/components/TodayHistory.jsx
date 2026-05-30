import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from '../hooks/useHistory.js';

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

export default memo(function TodayHistory() {
  const { events, status } = useHistory();
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const touchX = useRef(null);
  const count = events.length;

  const prev = useCallback(() => setIndex(i => (i - 1 + count) % count), [count]);
  const next = useCallback(() => setIndex(i => (i + 1) % count), [count]);

  const onTouchStart = useCallback(e => {
    touchX.current = e.touches[0].clientX;
  }, []);
  const onTouchEnd = useCallback(e => {
    if (touchX.current === null) return;
    const dx = touchX.current - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 50) dx > 0 ? next() : prev();
    touchX.current = null;
  }, [next, prev]);

  // Close modal on Escape
  useEffect(() => {
    if (!expanded) return;
    const handler = e => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [expanded]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = expanded ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [expanded]);

  if (status === 'loading') return <div className="th-skeleton" aria-hidden />;
  if (count === 0) return null;

  const ev = events[index];
  const icon = CAT_ICON[ev.category] || '📅';
  const today = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long',
  }).format(new Date());

  const detailParas = (ev.details || '').split('\n\n').filter(Boolean);

  return (
    <>
      <section
        className="th-wrap"
        aria-label="Today in History"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <span className="th-ring th-ring-1" aria-hidden />
        <span className="th-ring th-ring-2" aria-hidden />

        <div className="th-head">
          <div className="th-head-left">
            <span className="th-label">On this day</span>
            <span className="th-today">{today}</span>
          </div>
          {count > 1 && (
            <span className="th-count" aria-live="polite">
              {index + 1} <span aria-hidden>/</span> {count}
            </span>
          )}
        </div>

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

      {expanded && (
        <div
          className="th-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={ev.title}
          onClick={() => setExpanded(false)}
        >
          <div className="th-modal" onClick={e => e.stopPropagation()}>
            <button
              className="th-modal-close"
              onClick={() => setExpanded(false)}
              aria-label="Close"
            >
              ✕
            </button>

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
