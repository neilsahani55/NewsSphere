import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import TopNav from './components/TopNav.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import { useNews } from './hooks/useNews.js';
import { useTheme } from './hooks/useTheme.js';
import { useBookmarks } from './hooks/useBookmarks.js';
import { useReadArticles } from './hooks/useReadArticles.js';
import { useDebounce } from './hooks/useDebounce.js';
import { useBatchTranslation } from './hooks/useBatchTranslation.js';
import { useRoute, TAB_HASHES, navigate } from './hooks/useRoute.js';
import { authSupabase, useAuth } from './hooks/useAuth.js';
import { hasFullArticle, parseDate } from './utils/format.js';
import { fetchArticleById } from './services/supabaseService.js';
import { matchesTopic } from './utils/categories.js';
import { slugify } from './utils/slug.js';

function istNow() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date());
}

// Persists the last signed-in user ID across page reloads so we can detect
// account switches vs. the same user logging back in.
function getLastUid() { try { return localStorage.getItem('ns_last_uid'); } catch { return null; } }
function setLastUid(id) { try { if (id) localStorage.setItem('ns_last_uid', id); else localStorage.removeItem('ns_last_uid'); } catch {} }
// Legal pages are rarely visited — load them only when navigated to.
const Privacy     = lazy(() => import('./pages/Privacy.jsx'));
const Terms       = lazy(() => import('./pages/Terms.jsx'));
const Grievance   = lazy(() => import('./pages/Grievance.jsx'));
const Methodology = lazy(() => import('./pages/Methodology.jsx'));
const Status      = lazy(() => import('./pages/Status.jsx'));
import HomePage from './pages/HomePage.jsx';
import AllNews from './pages/AllNews.jsx';
import YourSpecial from './pages/YourSpecial.jsx';
import Feedback from './pages/Feedback.jsx';

const PAGE_SIZE = 50;

export default function App() {
  const { route, tab: routeTab, articleId } = useRoute();
  const { articles, status, backgroundLoading, error, refresh } = useNews();
  const { theme, toggle: toggleTheme } = useTheme();
  const { bookmarks, isBookmarked, toggle: toggleBookmark, clearAll: clearBookmarks, setAll: setBookmarks } = useBookmarks();
  const { isRead, markRead, readUrls, readCount, clearRead } = useReadArticles();
  const { user, loading: authLoading } = useAuth();
  const [savePrompt, setSavePrompt] = useState(false);

  // Account isolation + cross-device bookmark sync.
  // Guards on authLoading so we never act on a transient null user during the
  // initial session check — only after Supabase has confirmed the auth state.
  useEffect(() => {
    if (authLoading) return; // session not yet resolved — don't act yet

    const currentId = user?.id ?? null;

    if (!currentId) {
      // Confirmed logged-out — wipe local user data so the next person
      // who opens this device cannot see the previous user's saves/reads.
      clearBookmarks();
      clearRead();
      setLastUid(null);
      return;
    }

    const lastId = getLastUid();
    setLastUid(currentId);

    if (lastId !== currentId) {
      // Different account (or first-ever login on this device) — wipe local data
      clearBookmarks();
      clearRead();
    }

    // Always restore this user's saved articles from Supabase on every login
    // so bookmarks appear on any device they sign into.
    authSupabase
      .from('saved_news')
      .select('article_urls')
      .eq('user_id', currentId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error) setBookmarks(data?.article_urls || []);
      });
  }, [user, authLoading]);

  // When visiting a /news/slug-id URL directly, routeTab is null (tab is
  // preserved, not forced). Default to 'allnews' so the reader is visible.
  const [navTab, setNavTabState] = useState(routeTab || (articleId ? 'allnews' : 'home'));

  // Keep navTab in sync when the user presses Back/Forward
  useEffect(() => {
    if (routeTab && routeTab !== navTab) setNavTabState(routeTab);
  }, [routeTab]);

  // Tab change: clear selection (stops TTS, resets reader) then navigate
  const setNavTab = useCallback((tab) => {
    setSelectedUrl(null);
    navigate(TAB_HASHES[tab] || '/');
  }, []);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState(() => {
    try { return localStorage.getItem('ns_lang') || 'en'; } catch { return 'en'; }
  });
  useEffect(() => {
    try { localStorage.setItem('ns_lang', target); } catch {}
  }, [target]);
  const [selectedUrl, setSelectedUrl] = useState(null);
  const [directArticle, setDirectArticle] = useState(null); // article fetched directly for /news/:id URLs
  const directFetchedRef = useRef(null); // prevents re-fetching the same article ID
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [allNewsTopics, setAllNewsTopics] = useState([]);

  // Always track the latest bookmarks in a ref so the debounced Supabase
  // write reads the final state, not a stale closure snapshot.
  const bookmarksRef = useRef(bookmarks);
  useEffect(() => { bookmarksRef.current = bookmarks; }, [bookmarks]);
  const syncTimeoutRef = useRef(null);

  // Unified save toggle: gates on login, syncs to Supabase when logged in.
  // Used by AllNews cards, the reader panel, and YourSpecial — single source of truth.
  //
  // The Supabase write is debounced (800 ms) so that quickly saving several
  // articles in a row results in ONE upsert with the final list, preventing
  // the race condition where an earlier upsert finishes last and overwrites
  // a later one (e.g. save A then B → only A ends up in the DB).
  const handleBookmarkToggle = useCallback((url) => {
    if (!user) {
      setSavePrompt(true);
      setTimeout(() => setSavePrompt(false), 3500);
      return;
    }
    toggleBookmark(url); // optimistic local update — instant feedback

    clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      authSupabase.from('saved_news').upsert({
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email.split('@')[0],
        user_email: user.email,
        article_urls: bookmarksRef.current,
        updated_at: istNow(),
      }, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error) console.error('bookmark sync failed:', error.message);
        });
    }, 800);
  }, [user, toggleBookmark]);

  const debouncedSearch = useDebounce(search, 200);

  // Articles with both `content` and `key_points` populated. Half-finished
  // rows are hidden from the feed and only become visible once the Apps Script
  // refresh fills them in.
  const completeArticles = useMemo(
    () => articles.filter(hasFullArticle),
    [articles]
  );

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();

    return completeArticles
      .filter((a) => {
        if (navTab !== 'allnews') return true;
        // 'Read' chip: show only articles the user has already opened
        if (allNewsTopics.includes('Read')) return isRead(a.article_url);
        // Keep the currently open article visible even after it is marked read,
        // so the reader panel doesn't go blank mid-article and auto-select
        // doesn't immediately jump to the next story.
        if (a.article_url === selectedUrl) return true;
        // Default "All" view and topic-filtered views: hide already-read articles
        const topicOk = allNewsTopics.length === 0 || allNewsTopics.some(t => matchesTopic(a.category, t));
        return topicOk && !isRead(a.article_url);
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
  }, [completeArticles, navTab, debouncedSearch, allNewsTopics, isRead, selectedUrl]);

  // Reset pagination whenever the filtered set changes shape.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [navTab, debouncedSearch, allNewsTopics]);

  // Translate the slice that's actually rendered. As the user scrolls and
  // visibleCount grows, more articles are queued for background translation.
  const translatableSlice = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );
  // version bumps each time a translation batch completes — passed to NewsCard
  // so it re-renders and picks up the newly cached translated text.
  const { version: translateVersion, pending: translatePending } = useBatchTranslation(translatableSlice, target);

  // On mobile, scroll to the reader panel when an article is opened.
  useEffect(() => {
    if (!selectedUrl || window.innerWidth > 768) return;
    requestAnimationFrame(() => {
      document.getElementById('news-reader')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [selectedUrl]);

  // Auto-select first article for All News only (desktop only — on mobile the
  // user taps a card to open the reader so auto-select would hijack the feed view).
  useEffect(() => {
    if (navTab !== 'allnews') return;
    if (articleId) return;
    if (window.innerWidth <= 768) return;
    if (filtered.length === 0) { setSelectedUrl(null); return; }
    const stillVisible = filtered.some((a) => a.article_url === selectedUrl);
    if (!stillVisible) setSelectedUrl(filtered[0].article_url);
  }, [navTab, filtered, selectedUrl, articleId]);

  // Auto-select article from URL on load.
  // If the article is in the loaded batch, use it directly.
  // If not (e.g. shared link for an older article), fetch it from Supabase.
  useEffect(() => {
    if (!articleId) return;
    const found = completeArticles.find(a => a.id === articleId);
    if (found) {
      setSelectedUrl(found.article_url);
      setDirectArticle(null);
      return;
    }
    // Wait until at least the first batch has loaded before concluding the
    // article isn't present, then do a targeted single-row fetch.
    if (completeArticles.length > 0 && directFetchedRef.current !== articleId) {
      directFetchedRef.current = articleId;
      fetchArticleById(articleId).then(article => {
        if (article) {
          setDirectArticle(article);
          setSelectedUrl(article.article_url);
        }
      });
    }
  }, [articleId, completeArticles]);

  // selectedIndex is -1 when nothing is explicitly selected.
  // All News auto-select effect above handles the first-article default for allnews.
  const selectedIndex = selectedUrl
    ? filtered.findIndex((a) => a.article_url === selectedUrl)
    : -1;

  // Fall back to directArticle (fetched by ID) when the article isn't in the
  // current filtered list — happens when opening a shared /news/ link for an
  // older article that isn't in the top-500 loaded batch.
  const selected = selectedIndex >= 0
    ? filtered[selectedIndex]
    : (directArticle?.article_url === selectedUrl ? directArticle : null);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
  }, [filtered.length]);

  const handleTopicToggle = useCallback(
    (t) => setAllNewsTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]),
    []
  );
  const handleTopicClear = useCallback(() => setAllNewsTopics([]), []);

  const handleSelect = useCallback((article) => {
    setSelectedUrl(article.article_url);
    markRead(article.article_url);
    if (navTab === 'home' || navTab === 'feedback') {
      // Home/Feedback don't show a reader — jump to All News
      setNavTabState('allnews');
    }
    // Always push the canonical news URL so sharing works from any tab.
    // useRoute returns tab:null for /news/* URLs so the active tab is preserved.
    if (article.id && article.title) {
      navigate(`/news/${slugify(article.title)}-${article.id}`);
    }
  }, [navTab, markRead]);

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

  if (route === '/privacy')     return <Suspense fallback={null}><Privacy /></Suspense>;
  if (route === '/terms')       return <Suspense fallback={null}><Terms /></Suspense>;
  if (route === '/grievance')   return <Suspense fallback={null}><Grievance /></Suspense>;
  if (route === '/methodology') return <Suspense fallback={null}><Methodology /></Suspense>;
  if (route === '/status')      return <Suspense fallback={null}><Status /></Suspense>;
  // '#/news' and '#/' both fall through to the main app

  const showHomePage = navTab === 'home' && !debouncedSearch.trim();
  const showSpecial  = navTab === 'special';
  const showAllNews  = navTab === 'allnews';
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
        target={target}
        onTargetChange={setTarget}
        translatePending={translatePending}
      />

      <TopNav tab={navTab} onTabChange={setNavTab} />

      <main className="layout">
        <section id="news-feed">
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
              onAutoSelect={setSelectedUrl}
              target={target}
              isRead={isRead}
              readUrls={readUrls}
              isBookmarked={isBookmarked}
              onToggleBookmark={handleBookmarkToggle}
            />
          )}
          {showFeedback && <Feedback target={target} />}
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
              onToggleBookmark={handleBookmarkToggle}
              target={target}
              translateVersion={translateVersion}
              onRefresh={refresh}
              topics={allNewsTopics}
              onTopicToggle={handleTopicToggle}
              onTopicClear={handleTopicClear}
              readCount={readCount}
              backgroundLoading={backgroundLoading}
            />
          )}
        </section>

        {!showHomePage && !showFeedback && (!showSpecial || selectedUrl) && (
          <div id="news-reader">
            <DetailPanel
              article={selected}
              bookmarked={selected ? isBookmarked(selected.article_url) : false}
              onToggleBookmark={handleBookmarkToggle}
              target={target}
              allArticles={completeArticles}
              onSelectArticle={handleSelect}
              onPrev={handlePrev}
              onNext={handleNext}
              hasPrev={selectedIndex > 0}
              hasNext={selectedIndex >= 0 && selectedIndex < filtered.length - 1}
              position={selectedIndex >= 0 ? { current: selectedIndex + 1, total: filtered.length } : null}
              onClose={() => {
                setSelectedUrl(null);
                document.getElementById('news-feed')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          </div>
        )}
      </main>

      <footer className="foot">
        <div className="foot-grid">
          <div className="foot-col foot-col--brand">
            <span className="foot-name">NewsSphere</span>
            <p className="foot-desc">AI-powered news intelligence — aggregated, enriched, and delivered around the clock across 12 categories and 37+ sources.</p>
            <p className="foot-copy">© {new Date().getFullYear()} NewsSphere. All rights reserved.</p>
          </div>

          <div className="foot-col">
            <span className="foot-col-hd">Explore</span>
            <nav className="foot-col-links">
              <button className="foot-nav-btn" onClick={() => setNavTab('home')}>Home</button>
              <button className="foot-nav-btn" onClick={() => setNavTab('allnews')}>All News</button>
              <button className="foot-nav-btn" onClick={() => setNavTab('special')}>Your Special</button>
              <button className="foot-nav-btn" onClick={() => setNavTab('feedback')}>Feedback</button>
            </nav>
          </div>

          <div className="foot-col">
            <span className="foot-col-hd">Company</span>
            <nav className="foot-col-links">
              <a href="/methodology">How it works</a>
              <a href="/privacy">Privacy policy</a>
              <a href="/terms">Terms of use</a>
              <a href="/grievance">Grievance officer</a>
            </nav>
          </div>

          <div className="foot-col">
            <span className="foot-col-hd">Contact</span>
            <div className="foot-col-links">
              <a href="mailto:newssphere55@gmail.com" className="foot-email">newssphere55@gmail.com</a>
              <p className="foot-response">We respond within 72 hours</p>
            </div>
          </div>
        </div>
      </footer>

      {savePrompt && (
        <div className="save-prompt" role="status">
          Sign in to save articles
          <button onClick={() => { setSavePrompt(false); setNavTab('special'); }}>
            Sign in →
          </button>
        </div>
      )}
    </div>
  );
}
