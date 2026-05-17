import { memo } from 'react';
import { TOPIC_CATEGORIES } from '../utils/categories.js';
import NewsFeed from '../components/NewsFeed.jsx';

function AllNews({
  articles, visibleCount, onLoadMore, status, error,
  selectedUrl, onSelect, isBookmarked, onToggleBookmark,
  target, onRefresh, topics, onTopicToggle, onTopicClear,
}) {
  const allSelected = topics.length === 0;
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
        </div>
      </div>
      <div className="feed-hdr" style={{ marginTop: '1rem' }}>
        <h2 className="feed-title">{allSelected ? 'All stories' : topics.join(', ')}</h2>
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
    </div>
  );
}

export default memo(AllNews);
