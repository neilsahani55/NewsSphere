import { useEffect, useMemo, useState } from 'react';
import {
  extractEntities,
  externalInvestigations,
  findRelatedArticles,
  lookupWikipedia,
} from '../services/osintService.js';
import { formatDate, parseKeyPoints, relativeTime, stripHtml, truncate } from '../utils/format.js';
import { toneFor, topicsOf } from '../utils/categories.js';
import { useTranslation } from '../hooks/useTranslation.js';
import { useBatchTranslation } from '../hooks/useBatchTranslation.js';
import { getCached } from '../services/translateService.js';

// Module-scoped cache so flipping between articles doesn't re-fetch the same
// Wikipedia summary. Keyed by the entity string we asked for.
const wikiCache = new Map();

export default function OsintPanel({ article, allArticles, target, onSelectArticle }) {
  const [enrichments, setEnrichments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedUrl, setExpandedUrl] = useState(null);

  const entities = useMemo(() => {
    if (!article) return [];
    const text = `${article.title || ''} ${article.description || ''}`;
    return extractEntities(text, 5);
  }, [article?.article_url]);

  const related = useMemo(
    () => findRelatedArticles(article, allArticles, 4),
    [article?.article_url, allArticles]
  );

  const investigations = useMemo(
    () => externalInvestigations(article),
    [article?.article_url, article?.image_url]
  );

  // Background-translate the related articles' titles + descriptions so the
  // row labels switch to the user's preferred language too.
  useBatchTranslation(related, target);

  // Reset the inline expansion whenever the user moves to a different article.
  useEffect(() => {
    setExpandedUrl(null);
  }, [article?.article_url]);

  // Fetch Wikipedia summaries for the entities, in parallel, with cancellation.
  useEffect(() => {
    if (!article || entities.length === 0) {
      setEnrichments([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);

    Promise.all(
      entities.map(async (e) => {
        if (wikiCache.has(e)) return wikiCache.get(e);
        const r = await lookupWikipedia(e, ctrl.signal);
        wikiCache.set(e, r);
        return r;
      })
    ).then((results) => {
      if (ctrl.signal.aborted) return;
      setEnrichments(results.filter(Boolean));
      setLoading(false);
    });

    return () => ctrl.abort();
  }, [article?.article_url, entities]);

  if (!article) return null;
  const hasContent = enrichments.length > 0 || related.length > 0 || investigations.length > 0;
  if (!hasContent && !loading) return null;

  return (
    <section className="osint">
      <header className="osint-hdr">
        <div className="osint-h">
          <span className="osint-badge" aria-hidden>OSINT</span>
          <h3>Open Source Intelligence</h3>
        </div>
        {loading && <span className="osint-status">Looking up references…</span>}
      </header>

      {enrichments.length > 0 && (
        <div className="osint-block">
          <h4 className="osint-sub">Mentioned · Wikipedia</h4>
          <div className="osint-cards">
            {enrichments.map((e) => (
              <a
                key={e.title}
                className="osint-card"
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {e.thumbnail && (
                  <img
                    className="osint-thumb"
                    src={e.thumbnail}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="osint-card-text">
                  <div className="osint-card-title">{e.title}</div>
                  {e.description && (
                    <div className="osint-card-desc">{e.description}</div>
                  )}
                  <p className="osint-card-extract">{truncate(e.extract, 160)}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {related.length > 0 && (
        <div className="osint-block">
          <h4 className="osint-sub">Cross-references in your feed · {related.length}</h4>
          <ul className="osint-related">
            {related.map((r) => {
              const isOpen = expandedUrl === r.article_url;
              return (
                <li key={r.article_url} className={isOpen ? 'open' : ''}>
                  <div className="osint-related-row">
                    <button
                      type="button"
                      className="osint-related-btn"
                      aria-expanded={isOpen}
                      onClick={() => setExpandedUrl(isOpen ? null : r.article_url)}
                    >
                      <span className="osint-related-title">{getCached(r, 'title', target)}</span>
                      <span className="osint-related-meta">
                        {r.source_name || 'Source'} · {relativeTime(r.published_at_ist || r.fetched_at_ist)}
                      </span>
                      <span className="osint-caret" aria-hidden>{isOpen ? '▾' : '▸'}</span>
                    </button>
                    {onSelectArticle && (
                      <button
                        type="button"
                        className="osint-open-btn"
                        title="Open in main reader"
                        aria-label="Open this story in the main reader"
                        onClick={() => onSelectArticle(r)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M14 4h6v6" />
                          <path d="M20 4 10 14" />
                          <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {isOpen && <InlineReader article={r} target={target} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {investigations.length > 0 && (
        <div className="osint-block">
          <h4 className="osint-sub">External investigations</h4>
          <div className="osint-actions">
            {investigations.map((a) => (
              <a
                key={a.id}
                className="osint-action"
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                title={a.title}
                data-icon={a.icon}
              >
                <ActionIcon name={a.icon} />
                <span>{a.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// Tiny inline SVG set so the action chips don't depend on emoji rendering.
function ActionIcon({ name }) {
  const common = {
    width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  switch (name) {
    case 'globe':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      );
    case 'x':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2H21l-6.52 7.448L22 22h-6.797l-4.79-6.252L4.96 22H2.2l6.972-7.964L2 2h6.94l4.32 5.71L18.244 2zm-2.39 18h1.51L7.27 4h-1.6l10.183 16z" />
        </svg>
      );
    case 'reddit':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M22 12.06a2.4 2.4 0 0 0-4.06-1.74A11.6 11.6 0 0 0 12 9c-.7 0-1.4.05-2.05.15l1.05-4.93 3.46.74a1.7 1.7 0 1 0 .2-1l-4.05-.86a.5.5 0 0 0-.6.38L8.8 9.18A11.7 11.7 0 0 0 6.06 10.32a2.4 2.4 0 1 0-2.92 3.62A4.6 4.6 0 0 0 3 15c0 3.31 4.03 6 9 6s9-2.69 9-6c0-.36-.05-.72-.14-1.07A2.4 2.4 0 0 0 22 12.06zM8 14a1.2 1.2 0 1 1 1.2-1.2A1.2 1.2 0 0 1 8 14zm8.5 3.2A6.2 6.2 0 0 1 12 18.5a6.2 6.2 0 0 1-4.5-1.3.5.5 0 0 1 .7-.7A5.4 5.4 0 0 0 12 17.5a5.4 5.4 0 0 0 3.8-1 .5.5 0 1 1 .7.7zM16 14a1.2 1.2 0 1 1 1.2-1.2A1.2 1.2 0 0 1 16 14z" />
        </svg>
      );
    case 'image':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...common}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    default:
      return null;
  }
}

// Compact reader rendered inline beneath an expanded cross-reference row.
// Re-uses the global translation cache so a Hindi-translated title is already
// in place; full content is fetched on demand when its row opens.
function InlineReader({ article, target }) {
  const [imgFailed, setImgFailed] = useState(false);
  const { translated } = useTranslation(article, target);

  useEffect(() => { setImgFailed(false); }, [article.article_url]);

  const view = {
    description: stripHtml(translated?.description || article.description || ''),
    content:     stripHtml(translated?.content     || article.content     || ''),
    keyPoints:   parseKeyPoints(translated?.key_points || article.key_points),
  };
  const showImage = article.image_url && !imgFailed;
  const topics = topicsOf(article.category);

  return (
    <div className="osint-inline">
      {showImage && (
        <img
          className="osint-inline-img"
          src={article.image_url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      )}
      <div className="osint-inline-meta">
        {topics.map((t) => (
          <span key={t} className={`dcat tone-${toneFor(t)}`}>{t}</span>
        ))}
        <span className="dsrc">{article.source_name || 'Unknown'}</span>
        <span className="osint-inline-date">
          {formatDate(article.published_at_ist || article.fetched_at_ist)}
        </span>
      </div>
      {view.description && <div className="dshort">{view.description}</div>}
      {view.content && view.content !== view.description && (
        <div className="dfull">{view.content}</div>
      )}
      {view.keyPoints.length > 0 && (
        <div className="kpbox">
          <div className="kplabel">Key Points</div>
          <ul>{view.keyPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}
      {article.article_url && (
        <a
          href={article.article_url}
          target="_blank"
          rel="noopener noreferrer"
          className="rlink"
        >
          Read original article
        </a>
      )}
    </div>
  );
}
