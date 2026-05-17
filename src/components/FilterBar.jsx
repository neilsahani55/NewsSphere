import { memo } from 'react';
import { TOPIC_CATEGORIES } from '../utils/categories.js';

function FilterBar({ topics, onTopicToggle, onTopicClear }) {
  const allSelected = topics.length === 0;

  return (
    <div className="filters">
      <div className="filter-row" role="group" aria-label="Topic filter">
        <span className="filter-label">Topic</span>
        <div className="chips">
          <button
            className={`chip ${allSelected ? 'on' : ''}`}
            onClick={onTopicClear}
            aria-pressed={allSelected}
          >
            All
          </button>
          {TOPIC_CATEGORIES.filter(c => c.id !== 'All').map((cat) => {
            const active = topics.includes(cat.id);
            return (
              <button
                key={cat.id}
                aria-pressed={active}
                className={`chip ${active ? 'on' : ''}`}
                onClick={() => onTopicToggle(cat.id)}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(FilterBar);
