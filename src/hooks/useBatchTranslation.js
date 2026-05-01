import { useEffect, useRef, useState } from 'react';
import { isCached, translateField } from '../services/translateService.js';

const CARD_FIELDS = ['title', 'description'];
const CONCURRENCY = 4;

// Translates card-visible fields (title + description) for the given articles
// in the background, with a small concurrency pool. Writes into the shared
// cache, then bumps a version counter so consumers re-render to pick up the
// newly translated values via getCached().
export function useBatchTranslation(articles, target) {
  const [version, setVersion] = useState(0);
  const [pending, setPending] = useState(0);
  const abortRef = useRef(null);

  useEffect(() => {
    abortRef.current?.abort();
    if (!target || target === 'original' || articles.length === 0) {
      setPending(0);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Build the list of (article, field) tasks not already cached.
    const tasks = [];
    for (const article of articles) {
      for (const field of CARD_FIELDS) {
        if (!article[field]) continue;
        if (isCached(article, field, target)) continue;
        tasks.push({ article, field });
      }
    }

    if (tasks.length === 0) {
      setPending(0);
      return;
    }

    setPending(tasks.length);

    let cursor = 0;
    let completedSinceFlush = 0;

    const worker = async () => {
      while (cursor < tasks.length && !ctrl.signal.aborted) {
        const idx = cursor++;
        const { article, field } = tasks[idx];
        try {
          await translateField(article, field, target, ctrl.signal);
        } catch {
          // Individual failures are silent — the original text remains.
        }
        completedSinceFlush++;
        // Re-render in batches of ~6 to keep UI responsive without thrashing.
        if (completedSinceFlush >= 6) {
          completedSinceFlush = 0;
          setPending(p => Math.max(0, p - 6));
          setVersion(v => v + 1);
        }
      }
    };

    Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(() => {
      if (ctrl.signal.aborted) return;
      setPending(0);
      setVersion(v => v + 1);
    });

    return () => ctrl.abort();
  }, [articles, target]);

  return { version, pending };
}
