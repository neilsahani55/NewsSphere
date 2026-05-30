import { memo } from 'react';
import { TOPIC_CATEGORIES } from '../utils/categories.js';
import NewsFeed from '../components/NewsFeed.jsx';
import { useUIStrings } from '../hooks/useUIStrings.js';

const STRINGS = {
  topic: 'Topic',
  all: 'All',
  read: 'Read',
  clear: 'Clear',
  unread: 'Unread stories',
  readArticles: 'Read articles',
};

function AllNews({
  articles, visibleCount, onLoadMore, status, error,
  selectedUrl, onSelect, isBookmarked, onToggleBookmark,
  target, translateVersion, onRefresh, topics, onTopicToggle, onTopicClear, readCount, backgroundLoading,
}) {
  const t = useUIStrings(STRINGS, target);
  const allSelected = topics.length === 0;
  const readActive = topics.includes('Read');
  const feedTitle = allSelected ? t.unread : readActive ? t.readArticles : topics.join(', ');
  return (
    <div className="allnews-wrap">
      <div className="allnews-filter">
        <span className="filter-label">{t.topic}</span>
        <div className="chips">
          <button className={`chip${allSelected ? ' on' : ''}`} onClick={onTopicClear} aria-pressed={allSelected}>{t.all}</button>
          {TOPIC_CATEGORIES.filter(c => c.id !== 'All').map(c => {
            const active = topics.includes(c.id);
            return (
              <button key={c.id} className={`chip${active ? ' on' : ''}`} aria-pressed={active} onClick={() => onTopicToggle(c.id)}>
                {c.label}
              </button>
            );
          })}
          <button className={`chip chip--read${readActive ? ' on' : ''}`} aria-pressed={readActive} onClick={() => onTopicToggle('Read')}>
            {t.read}{readCount > 0 && <span className="chip-badge">{readCount}</span>}
          </button>
        </div>
      </div>
      <div className="feed-hdr" style={{ marginTop: '1rem' }}>
        <h2 className="feed-title">{feedTitle}</h2>
        {!allSelected && (
          <button type="button" className="reset-link" onClick={onTopicClear}>{t.clear}</button>
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
        translateVersion={translateVersion}
        onRefresh={onRefresh}
      />
    </div>
  );
}

export default memo(AllNews);
