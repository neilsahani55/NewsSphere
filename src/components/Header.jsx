import { memo } from 'react';
import SearchBar from './SearchBar.jsx';
import TranslateSelector from './TranslateSelector.jsx';

function Header({
  status,
  onRefresh,
  theme,
  onToggleTheme,
  search,
  onSearchChange,
  view,
  onViewChange,
  bookmarkCount,
  target,
  onTargetChange,
  translatePending,
}) {
  return (
    <header className="hdr">
      <div className="hdr-in">
        <div className="brand">
          <span className="brand-name">NewsSphere</span>
          <span className="brand-dot" />
          <span className="brand-sub">News Intelligence</span>
        </div>

        <SearchBar value={search} onChange={onSearchChange} />

        <div className="ctrls">
          <div className="seg" role="tablist" aria-label="View">
            <button
              role="tab"
              aria-selected={view === 'all'}
              className={`seg-btn ${view === 'all' ? 'on' : ''}`}
              onClick={() => onViewChange('all')}
            >
              All
            </button>
            <button
              role="tab"
              aria-selected={view === 'bookmarks'}
              className={`seg-btn ${view === 'bookmarks' ? 'on' : ''}`}
              onClick={() => onViewChange('bookmarks')}
            >
              Saved
              {bookmarkCount > 0 && <span className="seg-count">{bookmarkCount}</span>}
            </button>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>

          <TranslateSelector
            value={target}
            onChange={onTargetChange}
            busy={translatePending}
          />

          <button
            type="button"
            className="btn btn-p"
            onClick={onRefresh}
            disabled={status === 'loading'}
            title={status === 'loading' ? 'Loading…' : 'Refresh feed'}
            aria-label="Refresh feed"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-.28-4.5" />
            </svg>
            <span className="btn-label">
              {status === 'loading' ? 'Loading…' : 'Refresh'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default memo(Header);
