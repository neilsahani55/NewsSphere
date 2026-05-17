import { useEffect, useRef, useState } from 'react';
import { sentimentLabel, toneFor, topicsOf } from '../utils/categories.js';
import { isBoilerplate, relativeTime, stripHtml, truncate } from '../utils/format.js';
import { getCached } from '../services/translateService.js';

export default function NewsCard({ article, selected, bookmarked, onSelect, onToggleBookmark, target }) {
  const [imgFailed, setImgFailed] = useState(false);
  const cardRef = useRef(null);
  const topics = topicsOf(article.category);
  const sentiment = sentimentLabel(article.sentiment);
  const primaryTopic = topics[0] || 'News';
  const primaryTone = toneFor(primaryTopic);

  // When the article becomes the selected one (via swipe / Prev / Next or a
  // direct click on a remote card), bring its card into view in the
  // horizontal scroller so the user sees what they're reading.
  useEffect(() => {
    if (!selected || !cardRef.current) return;
    cardRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [selected]);

  // Translated fields fall through to the originals until the cache is filled.
  const title = getCached(article, 'title', target);
  const rawDesc = getCached(article, 'description', target);
  // If the description is an RSS feed boilerplate (e.g. "Source: Latest News...
  // Breaking news, Top Headlines...") skip it and use the AI article content.
  const description = isBoilerplate(rawDesc) ? null : rawDesc;
  const preview = truncate(stripHtml(description || article.content), 160);
  const showImage = article.image_url && !imgFailed;

  return (
    <article
      ref={cardRef}
      className={`card ${selected ? 'on' : ''}`}
      onClick={() => onSelect(article)}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(article);
        }
      }}
    >
      <div className="card-body">
        <div className="card-top">
          <div className="ctags">
            {topics.length > 0
              ? topics.map((t) => (
                  <span key={t} className={`ctag tone-${toneFor(t)}`}>{t}</span>
                ))
              : <span className="ctag tone-neutral">News</span>}
          </div>
          {sentiment && (
            <span
              className={`sent sent-${sentiment.tone}`}
              title={`Sentiment ${sentiment.score.toFixed(2)}`}
            >
              {sentiment.label}
            </span>
          )}
          <button
            type="button"
            className={`bm-btn ${bookmarked ? 'on' : ''}`}
            aria-label={bookmarked ? 'Remove bookmark' : 'Save article'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(article.article_url);
            }}
          >
            {bookmarked ? '★' : '☆'}
          </button>
        </div>
        <h3 className="chl">{title || 'Untitled'}</h3>
        {preview && <p className="cprev">{preview}</p>}
        <div className="cmeta">
          <span>{relativeTime(article.published_at_ist || article.fetched_at_ist)}</span>
          {article.country && (
            <>
              <span className="dot-sep" aria-hidden>·</span>
              <span className="cc">{String(article.country).toUpperCase()}</span>
            </>
          )}
        </div>
      </div>
      {showImage ? (
        <img
          className="card-thumb"
          src={article.image_url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          className={`card-thumb fallback tone-${primaryTone}`}
          aria-hidden
        >
          {primaryTopic}
        </div>
      )}
    </article>
  );
}
