import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import TopNav from './components/TopNav.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import { useNews } from './hooks/useNews.js';
import { useTheme } from './hooks/useTheme.js';
import { useBookmarks } from './hooks/useBookmarks.js';
import { useDebounce } from './hooks/useDebounce.js';
import { useBatchTranslation } from './hooks/useBatchTranslation.js';
import { useRoute, TAB_HASHES } from './hooks/useRoute.js';
import { hasFullArticle, parseDate } from './utils/format.js';
import { matchesTopic } from './utils/categories.js';
import { slugify } from './utils/slug.js';
import Privacy from './pages/Privacy.jsx';
import Terms from './pages/Terms.jsx';
import Grievance from './pages/Grievance.jsx';
import Methodology from './pages/Methodology.jsx';
import Status from './pages/Status.jsx';
import HomePage from './pages/HomePage.jsx';
import AllNews from './pages/AllNews.jsx';
import YourSpecial from './pages/YourSpecial.jsx';
import Feedback from './pages/Feedback.jsx';

const PAGE_SIZE = 60;

export default function App() {
  const { route, tab: routeTab, articleId } = useRoute();
  const { articles, status, error, refresh } = useNews();
  const { theme, toggle: toggleTheme } = useTheme();
  const { isBookmarked, toggle: toggleBookmark, count: bookmarkCount } = useBookmarks();

  const [navTab, setNavTabState] = useState(routeTab || 'home');

  // Keep navTab in sync when the user presses Back/Forward
  useEffect(() => {
    if (routeTab && routeTab !== navTab) setNavTabState(routeTab);
  }, [routeTab]);

  // Tab change: update hash — hashchange fires automatically and updates useRoute
  const setNavTab = useCallback((tab) => {
    window.location.hash = TAB_HASHES[tab] || '/';
  }, []);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('all'); // 'all' | 'bookmarks'
  const [target, setTarget] = useState('en'); // global preferred language
  const [selectedUrl, setSelectedUrl] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [allNewsTopics, setAllNewsTopics] = useState([]);

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
      .filter((a) => {
        if (navTab !== 'allnews') return true; // home/special/feedback: no category filter on reader panel
        return allNewsTopics.length === 0 || allNewsTopics.some(t => matchesTopic(a.category, t));
      })
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
  }, [completeArticles, navTab, debouncedSearch, view, isBookmarked, allNewsTopics]);

  // Reset pagination whenever the filtered set changes shape.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [navTab, debouncedSearch, view, allNewsTopics]);

  // Translate the slice that's actually rendered. As the user scrolls and
  // visibleCount grows, more articles are queued for background translation.
  const translatableSlice = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );
  const { pending: translatePending } = useBatchTranslation(translatableSlice, target);

  // Keep the selected article coherent: if the chosen article scrolls out of
  // the filtered set (e.g. user changed topic), fall back to the first visible.
  // Skip when navigating via a direct article URL — the separate effect handles that.
  useEffect(() => {
    if (articleId) return;
    if (filtered.length === 0) {
      setSelectedUrl(null);
      return;
    }
    const stillVisible = filtered.some((a) => a.article_url === selectedUrl);
    if (!stillVisible) setSelectedUrl(filtered[0].article_url);
  }, [filtered, selectedUrl, articleId]);

  // Auto-select article from URL on load
  useEffect(() => {
    if (!articleId || completeArticles.length === 0) return;
    const found = completeArticles.find(a => a.id === articleId);
    if (found) setSelectedUrl(found.article_url);
  }, [articleId, completeArticles]);

  const selectedIndex = selectedUrl
    ? filtered.findIndex((a) => a.article_url === selectedUrl)
    : (filtered.length ? 0 : -1);

  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
  }, [filtered.length]);

  const handleSelect = useCallback((article) => {
    setSelectedUrl(article.article_url);
    // If on Home/Special/Feedback, switch to All News so the Reader is visible
    if (navTab === 'home' || navTab === 'special' || navTab === 'feedback') {
      setNavTabState('allnews');
    }
    if (article.id && article.title) {
      const slug = slugify(article.title);
      window.location.hash = `/news/${slug}-${article.id}`;
    }
  }, [navTab]);

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
  // '#/news' and '#/' both fall through to the main app

  const showHomePage = navTab === 'home' && view !== 'bookmarks' && !debouncedSearch.trim();
  const showSpecial  = navTab === 'special';
  const showAllNews  = navTab === 'allnews' && view !== 'bookmarks';
  const showFeedback = navTab === 'feedback';

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

      <TopNav tab={navTab} onTabChange={setNavTab} />

      <main className="layout">
        <section>
          {showHomePage && (
            <HomePage
              articles={completeArticles}
              selectedUrl={selected?.article_url}
              onSelect={handleSelect}
              target={target}
              onSeeAll={(cat) => {
                setNavTab('allnews');
                setAllNewsTopics(cat ? [cat] : []);
              }}
            />
          )}
          {showSpecial && (
            <YourSpecial
              articles={completeArticles}
              selectedUrl={selected?.article_url}
              onSelect={handleSelect}
              target={target}
            />
          )}
          {showFeedback && <Feedback />}
          {!showHomePage && !showSpecial && !showFeedback && (
            <AllNews
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
              onRefresh={refresh}
              topics={allNewsTopics}
              onTopicToggle={(t) => setAllNewsTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
              onTopicClear={() => setAllNewsTopics([])}
            />
          )}
        </section>

        {!showHomePage && !showSpecial && !showFeedback && (
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
        )}
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
