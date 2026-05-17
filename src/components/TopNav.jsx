import { memo } from 'react';

const TABS = [
  { id: 'home',     label: 'Home' },
  { id: 'special',  label: 'Your Special' },
  { id: 'allnews',  label: 'All News' },
  { id: 'feedback', label: 'Feedback' },
];

function TopNav({ tab, onTabChange }) {
  return (
    <nav className="top-nav" aria-label="News sections">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tnav-tab${tab === t.id ? ' on' : ''}`}
          aria-current={tab === t.id ? 'page' : undefined}
          onClick={() => onTabChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export default memo(TopNav);
