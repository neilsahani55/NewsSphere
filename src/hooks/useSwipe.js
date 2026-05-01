import { useEffect, useRef } from 'react';

const MIN_SWIPE_DISTANCE = 60;     // px — minimum horizontal travel to count
const MAX_VERTICAL_DRIFT = 80;     // px — anything more is treated as a scroll
const MAX_DURATION_MS    = 600;    // ignore very slow drags (probably scrolls)

// Touch-only swipe detector. Mouse events are not bound — desktop drags don't
// fire `touchstart`, so the swipe never accidentally hijacks text selection.
export function useSwipe(elementRef, { onLeft, onRight } = {}) {
  const startRef = useRef(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    function handleStart(e) {
      if (e.touches.length !== 1) {
        startRef.current = null;
        return;
      }
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    }

    function handleEnd(e) {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;

      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = Date.now() - start.time;

      if (dt > MAX_DURATION_MS) return;
      if (Math.abs(dy) > MAX_VERTICAL_DRIFT) return;
      if (Math.abs(dx) < MIN_SWIPE_DISTANCE) return;

      if (dx < 0) onLeft?.();
      else onRight?.();
    }

    el.addEventListener('touchstart', handleStart, { passive: true });
    el.addEventListener('touchend', handleEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleStart);
      el.removeEventListener('touchend', handleEnd);
    };
  }, [elementRef, onLeft, onRight]);
}
