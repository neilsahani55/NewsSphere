import { memo } from 'react';

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'India', label: 'India' },
  { id: 'World', label: 'World' },
  { id: 'Tech', label: 'Tech' },
  { id: 'Business', label: 'Business' },
  { id: 'Science', label: 'Science' },
  { id: 'Health', label: 'Health' },
  { id: 'Sports', label: 'Sports' },
  { id: 'Entertainment', label: 'Entertainment' },
  { id: 'Crypto', label: 'Crypto' },
  { id: 'Politics', label: 'Politics' },
  { id: 'Environment', label: 'Environment' },
  { id: 'Crime', label: 'Crime' },
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
