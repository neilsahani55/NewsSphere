import { memo, useEffect, useRef } from 'react';
import NewsCard from './NewsCard.jsx';
import SkeletonCard from './SkeletonCard.jsx';

function NewsFeed({
  articles,
  visibleCount,
  onLoadMore,
  status,
  error,
  selectedUrl,
  onSelect,
  isBookmarked,
  onToggleBookmark,
  target,
  emptyTitle,
  emptySubtitle,
  onRefresh,
}) {
  const cardsRef = useRef(null);
  const sentinelRef = useRef(null);

  // Observer is rooted to the horizontal scroll container so it only fires when
  // the user has actually scrolled near the right edge — not when the sentinel
  // is sitting in the viewport but off-screen horizontally.
  useEffect(() => {
    if (!sentinelRef.current || !cardsRef.current) return;
    if (visibleCount >= articles.length) return;
    const node = sentinelRef.current;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onLoadMore(); },
      { root: cardsRef.current, rootMargin: '0px 400px 0px 0px' }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [visibleCount, articles.length, onLoadMore]);

  if (status === 'loading' && articles.length === 0) {
    return (
      <div className="cards">
        {[0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (status === 'error' && articles.length === 0) {
    return (
      <div className="statebox err">
        <strong>Couldn't load the feed.</strong>
        <p>{error || 'Check your connection and try again.'}</p>
        <button className="btn btn-p" onClick={onRefresh}>Retry</button>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="statebox">
        <strong>{emptyTitle || 'No stories match your filters.'}</strong>
        <p>{emptySubtitle || 'Try widening the topic or clearing search.'}</p>
      </div>
    );
  }

  const visible = articles.slice(0, visibleCount);
  const hasMore = visibleCount < articles.length;

  return (
    <>
      <div className="cards" ref={cardsRef}>
        {visible.map((article) => (
          <NewsCard
            key={article.article_url}
            article={article}
            selected={article.article_url === selectedUrl}
            bookmarked={isBookmarked(article.article_url)}
            onSelect={onSelect}
            onToggleBookmark={onToggleBookmark}
            target={target}
          />
        ))}
        {hasMore && (
          <div ref={sentinelRef} className="card-sentinel" aria-live="polite">
            <span className="sentinel-spin" aria-hidden />
            <span>Loading more…</span>
            <span className="sentinel-meta">{visible.length} of {articles.length}</span>
          </div>
        )}
      </div>
    </>
  );
}

export default memo(NewsFeed);
