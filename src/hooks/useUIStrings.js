import { useEffect, useState } from 'react';
import { translate } from '../services/translateService.js';

// Module-level cache so translations survive re-renders and are shared across components.
// Key: `${target}::${text}` → translated string
const cache = new Map();

// Translates a static map of { key: 'English string' } into the target language.
// Strings object must be stable (define it outside the component or via useMemo).
// Returns the original map immediately, replacing values as translations arrive.
export function useUIStrings(strings, target) {
  const [out, setOut] = useState(strings);

  useEffect(() => {
    if (!target || target === 'en' || target === 'original') {
      setOut(strings);
      return;
    }

    let cancelled = false;
    const result = { ...strings };
    const ctrl = new AbortController();

    (async () => {
      await Promise.all(
        Object.entries(strings).map(async ([k, v]) => {
          if (!v) return;
          const cKey = `${target}::${v}`;
          if (cache.has(cKey)) { result[k] = cache.get(cKey); return; }
          try {
            const t = await translate(v, target, ctrl.signal);
            if (!cancelled) { cache.set(cKey, t); result[k] = t; }
          } catch { /* keep original on error */ }
        })
      );
      if (!cancelled) setOut({ ...result });
    })();

    return () => { cancelled = true; ctrl.abort(); };
  }, [target]); // strings is a module-level constant per component — intentionally stable

  return out;
}
