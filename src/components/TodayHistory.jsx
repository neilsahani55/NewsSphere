import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { todayIST, useHistory } from '../hooks/useHistory.js';
import { getCached, translateField } from '../services/translateService.js';
import { useUIStrings } from '../hooks/useUIStrings.js';

const TH_STRINGS = {
  onThisDay:   'On this day',
  readMore:    'Read more ›',
  backToToday: 'Back to today',
  noData:      'No history recorded for this date yet.',
};

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
  const [, setTick] = useState(0); // force re-render after async translation arrives
  const touchX  = useRef(null);
  const dotsRef = useRef(null);

  const currentDate = selectedDate || todayStr;
  const isToday     = currentDate === todayStr;
  const atLimit     = currentDate <= minDate;
  const locale      = target && target !== 'en' ? target : 'en-IN';

  const t = useUIStrings(TH_STRINGS, target);

  const { events, status } = useHistory(currentDate);
  const count = events.length;

  useEffect(() => { setIndex(0); setExpanded(false); }, [currentDate]);

  // Scroll the dots strip to keep the active dot centred — uses scrollTo on
  // the container directly so the page itself never shifts horizontally.
  useEffect(() => {
    const container = dotsRef.current;
    if (!container) return;
    const dot = container.children[index];
    if (!dot) return;
    const cRect = container.getBoundingClientRect();
    const dRect = dot.getBoundingClientRect();
    const delta = (dRect.left + dRect.width / 2) - (cRect.left + cRect.width / 2);
    if (Math.abs(delta) > 1) {
      container.scrollTo({ left: container.scrollLeft + delta, behavior: 'smooth' });
    }
  }, [index]);

  const ev     = count > 0 ? events[index] : null;
  const evObj  = ev ? { ...ev, article_url: `history_${ev.id}`, language: 'en' } : null;
  const needsT = target && target !== 'original' && target !== 'en';

  // Translate title/description/category when the displayed event or language changes
  useEffect(() => {
    if (!evObj || !needsT) return;
    const ctrl = new AbortController();
    let live = true;
    Promise.all([
      translateField(evObj, 'title',       target, ctrl.signal),
      translateField(evObj, 'description', target, ctrl.signal),
      translateField(evObj, 'category',    target, ctrl.signal),
    ]).then(() => { if (live) setTick(n => n + 1); }).catch(() => {});
    return () => { live = false; ctrl.abort(); };
  }, [ev?.id, target]); // eslint-disable-line react-hooks/exhaustive-deps

  // Translate details when modal opens
  useEffect(() => {
    if (!expanded || !evObj || !needsT) return;
    const ctrl = new AbortController();
    let live = true;
    translateField(evObj, 'details', target, ctrl.signal)
      .then(() => { if (live) setTick(n => n + 1); }).catch(() => {});
    return () => { live = false; ctrl.abort(); };
  }, [expanded, ev?.id, target]); // eslint-disable-line react-hooks/exhaustive-deps

  const evTitle   = evObj ? (getCached(evObj, 'title',       target) || ev.title)       : '';
  const evDesc    = evObj ? (getCached(evObj, 'description', target) || ev.description) : '';
  const evCat     = evObj ? (getCached(evObj, 'category',    target) || ev.category)    : '';
  const evDetails = evObj ? (getCached(evObj, 'details',     target) || ev.details || '') : '';

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

  const icon = ev ? (CAT_ICON[ev.category] || '📅') : '📅';
  const detailParas = evDetails.split('\n\n').filter(p => p.trim().length > 0);

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
              <span className="th-label">{t.onThisDay}</span>
              {!isToday && (
                <button className="th-back-today" onClick={goToday} aria-label="Back to today">
                  {t.backToToday}
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
          <p className="th-no-data">{t.noData}</p>
        ) : (
          <div className="th-content">
            <div className="th-top-row">
              <span className="th-year">{ev.event_year}</span>
              <span className="th-cat">{icon} {evCat}</span>
            </div>
            <h3 className="th-title">{evTitle}</h3>
            <p className="th-desc">{evDesc}</p>
            <button
              className="th-readmore"
              onClick={() => setExpanded(true)}
              aria-haspopup="dialog"
            >
              {t.readMore}
            </button>
          </div>
        )}

        {/* ── Carousel nav (event switching, bottom) ── */}
        {count > 1 && (
          <div className="th-nav">
            <button className="th-arrow" onClick={prev} aria-label="Previous event">&#8249;</button>
            <div className="th-dots" role="tablist" aria-label="Events" ref={dotsRef}>
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
          aria-label={evTitle}
          onClick={() => setExpanded(false)}
        >
          <div className="th-modal" onClick={e => e.stopPropagation()}>
            <button className="th-modal-close" onClick={() => setExpanded(false)} aria-label="Close">✕</button>
            <div className="th-modal-top-row">
              <span className="th-year">{ev.event_year}</span>
              <span className="th-cat">{icon} {evCat}</span>
            </div>
            <h2 className="th-modal-title">{evTitle}</h2>
            <div className="th-modal-body">
              {detailParas.length > 0
                ? detailParas.map((para, i) => <p key={i}>{para}</p>)
                : <p>{evDesc}</p>
              }
            </div>
          </div>
        </div>
      )}
    </>
  );
});
