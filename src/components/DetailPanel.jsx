import { useEffect, useRef, useState } from 'react';
import { sentimentLabel, toneFor, topicsOf } from '../utils/categories.js';
import { formatDate, parseKeyPoints, stripHtml } from '../utils/format.js';
import { useTranslation } from '../hooks/useTranslation.js';
import { useSwipe } from '../hooks/useSwipe.js';
import OsintPanel from './OsintPanel.jsx';

export default function DetailPanel({
  article,
  bookmarked,
  onToggleBookmark,
  target,
  allArticles,
  onSelectArticle,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  position,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const { translated, loading, error } = useTranslation(article, target);
  const panelRef = useRef(null);

  // Touch-swipe: left = next, right = previous. Only fires on touch devices,
  // so it never interferes with mouse-based text selection.
  useSwipe(panelRef, {
    onLeft:  hasNext ? onNext : undefined,
    onRight: hasPrev ? onPrev : undefined,
  });

  useEffect(() => {
    setImgFailed(false);
  }, [article?.article_url]);

  if (!article) {
    return (
      <aside className="dcol" ref={panelRef}>
        <div className="dpanel">
          <div className="dphdr"><h3>Reader</h3></div>
          <div className="dph">
            <span className="big" aria-hidden>📰</span>
            Select any story from the feed to read the full analysis here.
          </div>
        </div>
      </aside>
    );
  }

  const topics = topicsOf(article.category);
  const sentiment = sentimentLabel(article.sentiment);

  // Reader prefers translated text but falls through to the original
  // until the cache fills (so selecting an article shows something instantly).
  const view = {
    title:       translated?.title       || article.title       || '',
    description: stripHtml(translated?.description || article.description || ''),
    content:     stripHtml(translated?.content     || article.content     || ''),
    keyPoints:   parseKeyPoints(translated?.key_points || article.key_points),
  };
  const showImage = article.image_url && !imgFailed;

  return (
    <aside className="dcol" ref={panelRef}>
      <div className="dpanel">
        <div className="dphdr">
          <h3>
            Reader
            {loading && <span className="reader-busy">· translating…</span>}
            {error && <span className="reader-err" title={error}>· translation failed</span>}
          </h3>
          <button
            type="button"
            className={`bm-btn lg ${bookmarked ? 'on' : ''}`}
            aria-label={bookmarked ? 'Remove bookmark' : 'Save article'}
            onClick={() => onToggleBookmark(article.article_url)}
          >
            {bookmarked ? '★ Saved' : '☆ Save'}
          </button>
          {article.id && (
            <button
              type="button"
              className="share-btn"
              title="Copy link"
              onClick={() => {
                const url = `${window.location.origin}${window.location.pathname}#/article/${article.id}`;
                navigator.clipboard.writeText(url).catch(() => {});
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share
            </button>
          )}
        </div>

        <div className="dpbody">
          {showImage && (
            <img
              className="dimg"
              src={article.image_url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
            />
          )}
          <div className="dtags">
            {topics.length > 0
              ? topics.map((t) => (
                  <span key={t} className={`dcat tone-${toneFor(t)}`}>{t}</span>
                ))
              : <span className="dcat tone-neutral">News</span>}
            {sentiment && (
              <span className={`sent sent-${sentiment.tone}`}>
                {sentiment.label} · {sentiment.score.toFixed(2)}
              </span>
            )}
            {article.language && (
              <span className="lang-pill">{String(article.language).toUpperCase()}</span>
            )}
          </div>
          <h2 className="dtitle">{view.title || 'No headline'}</h2>
          <div className="dmeta">
            <span className="dsrc">{article.source_name || 'Unknown'}</span>
            <span>{formatDate(article.published_at_ist || article.fetched_at_ist)}</span>
            {article.country && <span className="cc">{String(article.country).toUpperCase()}</span>}
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

          <OsintPanel
            article={article}
            allArticles={allArticles}
            target={target}
            onSelectArticle={onSelectArticle}
          />

          {article.article_url && (
            <a
              href={article.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rlink"
            >
              Read original article
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}

          {(hasPrev || hasNext) && (
            <nav className="dnav" aria-label="Article navigation">
              <button
                type="button"
                className="dnav-btn"
                onClick={onPrev}
                disabled={!hasPrev}
                aria-label="Previous story"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span className="dnav-label">Previous</span>
              </button>
              <button
                type="button"
                className="dnav-btn"
                onClick={onNext}
                disabled={!hasNext}
                aria-label="Next story"
              >
                <span className="dnav-label">Next</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </nav>
          )}
        </div>
      </div>
    </aside>
  );
}

