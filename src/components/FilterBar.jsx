import { memo } from 'react';
import { TOPIC_CATEGORIES } from '../utils/categories.js';

function FilterBar({ topic, onTopicChange }) {
  return (
    <div className="filters">
      <div className="filter-row" role="tablist" aria-label="Topic">
        <span className="filter-label">Topic</span>
        <div className="chips">
          {TOPIC_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              role="tab"
              aria-selected={topic === cat.id}
              className={`chip ${topic === cat.id ? 'on' : ''}`}
              onClick={() => onTopicChange(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(FilterBar);
