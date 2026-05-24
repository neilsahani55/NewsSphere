import { memo } from 'react';
import { TOPIC_CATEGORIES } from '../utils/categories.js';
import NewsFeed from '../components/NewsFeed.jsx';

function AllNews({
  articles, visibleCount, onLoadMore, status, error,
  selectedUrl, onSelect, isBookmarked, onToggleBookmark,
  target, onRefresh, topics, onTopicToggle, onTopicClear, readCount, backgroundLoading,
}) {
  const allSelected = topics.length === 0;
  const readActive = topics.includes('Read');
  return (
    <div className="allnews-wrap">
      <div className="allnews-filter">
        <span className="filter-label">Topic</span>
        <div className="chips">
          <button className={`chip${allSelected ? ' on' : ''}`} onClick={onTopicClear} aria-pressed={allSelected}>All</button>
          {TOPIC_CATEGORIES.filter(c => c.id !== 'All').map(c => {
            const active = topics.includes(c.id);
            return (
              <button key={c.id} className={`chip${active ? ' on' : ''}`} aria-pressed={active} onClick={() => onTopicToggle(c.id)}>
                {c.label}
              </button>
            );
          })}
          <button className={`chip chip--read${readActive ? ' on' : ''}`} aria-pressed={readActive} onClick={() => onTopicToggle('Read')}>
            Read{readCount > 0 && <span className="chip-badge">{readCount}</span>}
          </button>
        </div>
      </div>
      <div className="feed-hdr" style={{ marginTop: '1rem' }}>
        <h2 className="feed-title">{allSelected ? 'Unread stories' : readActive ? 'Read articles' : topics.join(', ')}</h2>
        {!allSelected && (
          <button type="button" className="reset-link" onClick={onTopicClear}>Clear</button>
        )}
      </div>
      <NewsFeed
        articles={articles}
        visibleCount={visibleCount}
        onLoadMore={onLoadMore}
        status={status}
        error={error}
        selectedUrl={selectedUrl}
        onSelect={onSelect}
        isBookmarked={isBookmarked}
        onToggleBookmark={onToggleBookmark}
        target={target}
        onRefresh={onRefresh}
      />
      {backgroundLoading && (
        <div className="bg-loading-strip">
          <span className="bg-loading-dot" />
          <span className="bg-loading-dot" />
          <span className="bg-loading-dot" />
          <span className="bg-loading-text">Fetching more articles…</span>
        </div>
      )}
    </div>
  );
}

export default memo(AllNews);
