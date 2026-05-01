import { useEffect, useRef, useState } from 'react';
import { getCached, isCached, translateField } from '../services/translateService.js';

const FULL_FIELDS = ['title', 'description', 'content', 'key_points'];

// Ensures all four reader fields of a single article are translated to the
// global target language. Reuses cache populated by useBatchTranslation, so
// the title is usually instant; only `content` and `key_points` actually fetch.
export function useTranslation(article, target) {
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    abortRef.current?.abort();
    setError(null);

    if (!article || !target || target === 'original' || article.language === target) {
      setLoading(false);
      return;
    }

    const missing = FULL_FIELDS.filter(f => article[f] && !isCached(article, f, target));
    if (missing.length === 0) {
      setLoading(false);
      setVersion(v => v + 1);
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    (async () => {
      for (const field of missing) {
        if (ctrl.signal.aborted) return;
        try {
          await translateField(article, field, target, ctrl.signal);
          if (ctrl.signal.aborted) return;
          setVersion(v => v + 1);
        } catch (e) {
          if (e.name === 'AbortError') return;
          setError(e.message || 'Translation failed');
          setLoading(false);
          return;
        }
      }
      setLoading(false);
    })();

    return () => ctrl.abort();
  }, [article, target]);

  // Build the result object — falls through to original where not yet translated.
  const translated = article ? Object.fromEntries(
    FULL_FIELDS.map(f => [f, getCached(article, f, target)])
  ) : null;

  // version is intentionally read so React re-renders when cache fills in.
  void version;

  return { translated, loading, error };
}
