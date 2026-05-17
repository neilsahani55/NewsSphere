import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import FilterBar from './components/FilterBar.jsx';
import NewsFeed from './components/NewsFeed.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import { useNews } from './hooks/useNews.js';
import { useTheme } from './hooks/useTheme.js';
import { useBookmarks } from './hooks/useBookmarks.js';
import { useDebounce } from './hooks/useDebounce.js';
import { useBatchTranslation } from './hooks/useBatchTranslation.js';
import { useRoute } from './hooks/useRoute.js';
import { hasFullArticle, parseDate } from './utils/format.js';
import { matchesTopic } from './utils/categories.js';
import Privacy from './pages/Privacy.jsx';
import Terms from './pages/Terms.jsx';
import Grievance from './pages/Grievance.jsx';
import Methodology from './pages/Methodology.jsx';
import Status from './pages/Status.jsx';

const PAGE_SIZE = 60;

export default function App() {
  const route = useRoute();
  const { articles, status, error, refresh } = useNews();
  const { theme, toggle: toggleTheme } = useTheme();
  const { isBookmarked, toggle: toggleBookmark, count: bookmarkCount } = useBookmarks();

  const [topics, setTopics] = useState([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('all'); // 'all' | 'bookmarks'
  const [target, setTarget] = useState('en'); // global preferred language
  const [selectedUrl, setSelectedUrl] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const debouncedSearch = useDebounce(search, 200);

  // Articles with both `content` and `key_points` populated. Half-finished
  // rows are hidden from the feed and only become visible once the Apps Script
  // refresh fills them in.
  const completeArticles = useMemo(
    () => articles.filter(hasFullArticle),
    [articles]
  );

  const filtered = useMemo(() => {
    const base = view === 'bookmarks'
      ? completeArticles.filter((a) => isBookmarked(a.article_url))
      : completeArticles;

    const q = debouncedSearch.trim().toLowerCase();

    return base
      .filter((a) => topics.length === 0 || topics.some((t) => matchesTopic(a.category, t)))
      .filter((a) => {
        if (!q) return true;
        return (
          a.title?.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q) ||
          a.source_name?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Primary: newest publish time first.
        const ap = parseDate(a.published_at_ist)?.getTime() ?? 0;
        const bp = parseDate(b.published_at_ist)?.getTime() ?? 0;
        if (bp !== ap) return bp - ap;
        // Tie-break: newest fetched time. Keeps order deterministic when two
        // sources publish at the same minute (e.g. wire republishes).
        const af = parseDate(a.fetched_at_ist)?.getTime() ?? 0;
        const bf = parseDate(b.fetched_at_ist)?.getTime() ?? 0;
        return bf - af;
      });
  }, [completeArticles, topics, debouncedSearch, view, isBookmarked]);

  // Reset pagination whenever the filtered set changes shape.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [topics, debouncedSearch, view]);

  // Translate the slice that's actually rendered. As the user scrolls and
  // visibleCount grows, more articles are queued for background translation.
  const translatableSlice = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );
  const { pending: translatePending } = useBatchTranslation(translatableSlice, target);

  // Keep the selected article coherent: if the chosen article scrolls out of
  // the filtered set (e.g. user changed topic), fall back to the first visible.
  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedUrl(null);
      return;
    }
    const stillVisible = filtered.some((a) => a.article_url === selectedUrl);
    if (!stillVisible) setSelectedUrl(filtered[0].article_url);
  }, [filtered, selectedUrl]);

  const selectedIndex = selectedUrl
    ? filtered.findIndex((a) => a.article_url === selectedUrl)
    : (filtered.length ? 0 : -1);

  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
  }, [filtered.length]);

  const handleSelect = useCallback((article) => {
    setSelectedUrl(article.article_url);
  }, []);

  // Prev/Next navigation across the filtered list — used by the bottom buttons
  // and the mobile swipe gesture. Auto-extends the visible window when the user
  // walks past the loaded slice.
  const handlePrev = useCallback(() => {
    if (selectedIndex <= 0) return;
    setSelectedUrl(filtered[selectedIndex - 1].article_url);
  }, [selectedIndex, filtered]);

  const handleNext = useCallback(() => {
    if (selectedIndex < 0 || selectedIndex >= filtered.length - 1) return;
    const nextIdx = selectedIndex + 1;
    if (nextIdx >= visibleCount - 5) {
      setVisibleCount((c) => Math.min(Math.max(c + PAGE_SIZE, nextIdx + 1), filtered.length));
    }
    setSelectedUrl(filtered[nextIdx].article_url);
  }, [selectedIndex, filtered, visibleCount]);

  if (route === '#/privacy')     return <Privacy />;
  if (route === '#/terms')       return <Terms />;
  if (route === '#/grievance')   return <Grievance />;
  if (route === '#/methodology') return <Methodology />;
  if (route === '#/status')      return <Status />;

  return (
    <div className="app">
      <Header
        status={status}
        onRefresh={refresh}
        theme={theme}
        onToggleTheme={toggleTheme}
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        bookmarkCount={bookmarkCount}
        target={target}
        onTargetChange={setTarget}
        translatePending={translatePending}
      />

      <FilterBar
        topics={topics}
        onTopicToggle={(t) => setTopics((prev) =>
          prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
        )}
        onTopicClear={() => setTopics([])}
      />

      <main className="layout">
        <section>
          <div className="feed-hdr">
            <h2 className="feed-title">
              {view === 'bookmarks' ? 'Saved stories' : 'Latest stories'}
            </h2>
            {(topics.length > 0 || search) && (
              <button
                type="button"
                className="reset-link"
                onClick={() => { setTopics([]); setSearch(''); }}
              >
                Clear filters
              </button>
            )}
          </div>

          <NewsFeed
            articles={filtered}
            visibleCount={visibleCount}
            onLoadMore={handleLoadMore}
            status={status}
            error={error}
            selectedUrl={selected?.article_url}
            onSelect={handleSelect}
            isBookmarked={isBookmarked}
            onToggleBookmark={toggleBookmark}
            target={target}
            emptyTitle={view === 'bookmarks' ? 'No saved stories yet' : undefined}
            emptySubtitle={view === 'bookmarks' ? 'Tap the star on any article to save it here.' : undefined}
            onRefresh={refresh}
          />
        </section>

        <DetailPanel
          article={selected}
          bookmarked={selected ? isBookmarked(selected.article_url) : false}
          onToggleBookmark={toggleBookmark}
          target={target}
          allArticles={completeArticles}
          onSelectArticle={handleSelect}
          onPrev={handlePrev}
          onNext={handleNext}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex >= 0 && selectedIndex < filtered.length - 1}
          position={selectedIndex >= 0 ? { current: selectedIndex + 1, total: filtered.length } : null}
        />
      </main>

      <footer className="foot">
        <div className="foot-brand">
          <span className="foot-name">NewsSphere</span>
          <span className="foot-dot" aria-hidden />
          <span className="foot-tag">News intelligence beyond the headline</span>
        </div>
        <div className="foot-pillars">
          <span>Aggregate</span>
          <span aria-hidden>·</span>
          <span>Translate</span>
          <span aria-hidden>·</span>
          <span>Investigate</span>
        </div>
        <nav className="foot-legal" aria-label="Legal">
          <a href="#/privacy">Privacy</a>
          <span aria-hidden>·</span>
          <a href="#/terms">Terms</a>
          <span aria-hidden>·</span>
          <a href="#/grievance">Grievance</a>
          <span aria-hidden>·</span>
          <a href="#/methodology">How it works</a>
          <span aria-hidden>·</span>
          <a href="#/status">Status</a>
        </nav>
      </footer>
    </div>
  );
}
