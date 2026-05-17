import { useEffect, useState, useMemo } from 'react';
import { authSupabase, useAuth } from '../hooks/useAuth.js';
import { useBookmarks } from '../hooks/useBookmarks.js';
import { TOPIC_CATEGORIES, matchesTopic } from '../utils/categories.js';
import NewsFeed from '../components/NewsFeed.jsx';

const TOPIC_ICONS = {
  India: '🇮🇳', World: '🌍', Tech: '💻', Business: '📈',
  Science: '🔬', Health: '🏥', Sports: '🏏', Entertainment: '🎬',
  Crypto: '₿', Politics: '🏛️', Environment: '🌿', Crime: '⚖️',
};

const SOURCE_GROUPS = [
  { label: 'India', sources: ['Times of India','Hindustan Times','The Hindu','Firstpost','Indian Express','India Today','Scroll.in','Deccan Herald','News18','The Quint','The News Minute','Business Standard','Outlook India'] },
  { label: 'World', sources: ['BBC','Al Jazeera','CNN','The Guardian'] },
  { label: 'Tech', sources: ['TechCrunch','The Verge','Hacker News'] },
  { label: 'Business', sources: ['Livemint','Economic Times','Guardian Business'] },
  { label: 'Science & Health', sources: ['ScienceDaily','BBC Health'] },
  { label: 'Sports', sources: ['ESPNcricinfo','ESPN'] },
  { label: 'Entertainment', sources: ['Variety','Bollywood Hungama'] },
  { label: 'Crypto', sources: ['CoinDesk','CoinTelegraph'] },
  { label: 'Politics', sources: ['The Print','Politico'] },
  { label: 'Other', sources: ['Krebs on Security'] },
];

const FEATURES = [
  { icon: '🎯', title: 'Follow topics', desc: 'Pin the categories you care about most' },
  { icon: '📰', title: 'Follow sources', desc: 'Choose which publications you trust' },
  { icon: '🔖', title: 'Save stories', desc: 'Bookmark articles and read them later' },
];

export default function YourSpecial({ articles, selectedUrl, onSelect, target }) {
  const { user, loading, authError, signIn, signOut } = useAuth();
  const { isBookmarked, toggle: toggleBookmark } = useBookmarks();
  const [panel, setPanel] = useState('topics');
  const [editing, setEditing] = useState(false);
  const [followedSources, setFollowedSources] = useState([]);
  const [followedTopics, setFollowedTopics] = useState([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      authSupabase.from('source_prefs').select('*').eq('user_id', user.id),
      authSupabase.from('topic_prefs').select('*').eq('user_id', user.id),
    ]).then(([sp, tp]) => {
      setFollowedSources((sp.data || []).filter(r => r.followed).map(r => r.source_name));
      setFollowedTopics((tp.data || []).filter(r => r.followed).map(r => r.topic));
    });
  }, [user]);

  const toggleSource = async (src) => {
    if (!user) return;
    const followed = !followedSources.includes(src);
    setFollowedSources(prev => followed ? [...prev, src] : prev.filter(s => s !== src));
    await authSupabase.from('source_prefs').upsert(
      { user_id: user.id, source_name: src, followed },
      { onConflict: 'user_id,source_name' }
    );
  };

  const toggleTopic = async (topic) => {
    if (!user) return;
    const followed = !followedTopics.includes(topic);
    setFollowedTopics(prev => followed ? [...prev, topic] : prev.filter(t => t !== topic));
    await authSupabase.from('topic_prefs').upsert(
      { user_id: user.id, topic, followed },
      { onConflict: 'user_id,topic' }
    );
  };

  // Personalised feed: articles matching any followed topic OR any followed source
  const feedArticles = useMemo(() => {
    if (followedTopics.length === 0 && followedSources.length === 0) return [];
    return articles.filter(a => {
      const topicMatch = followedTopics.length > 0 && followedTopics.some(t => matchesTopic(a.category, t));
      const sourceMatch = followedSources.length > 0 && followedSources.includes(a.source_name);
      return topicMatch || sourceMatch;
    });
  }, [articles, followedTopics, followedSources]);

  const savedArticles = useMemo(
    () => articles.filter(a => isBookmarked(a.article_url)),
    [articles, isBookmarked]
  );

  // Shared props for NewsFeed in both panels
  const feedProps = {
    visibleCount: Infinity,
    onLoadMore: () => {},
    status: 'idle',
    error: null,
    selectedUrl,
    onSelect,
    isBookmarked,
    onToggleBookmark: toggleBookmark,
    target,
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="sp-loading-screen">
        <div className="sp-spinner" aria-hidden />
        <span>Loading your profile…</span>
      </div>
    );
  }

  // ── Login gate ───────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="sp-gate">
        <div className="sp-gate-hero">
          <div className="sp-gate-badge">✦ Personalised</div>
          <h1 className="sp-gate-title">Your Special</h1>
          <p className="sp-gate-sub">Sign in to get a news experience built around what matters to you.</p>

          <div className="sp-gate-features">
            {FEATURES.map(f => (
              <div key={f.title} className="sp-gate-feat">
                <span className="sp-gate-feat-icon">{f.icon}</span>
                <div>
                  <div className="sp-gate-feat-title">{f.title}</div>
                  <div className="sp-gate-feat-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <button className="sp-google-btn" onClick={signIn}>
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.6 2.2 30.1 0 24 0 14.7 0 6.7 5.3 2.7 13l7.8 6c1.8-5.4 6.8-9.5 13.5-9.5z"/>
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.2-4.5 6.8l7 5.5c4.1-3.8 6.5-9.4 6.5-16.3z"/>
              <path fill="#FBBC05" d="M10.5 28.5c-.5-1.5-.8-3-.8-4.5s.3-3 .8-4.5l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.7 10.5l7.8-6z"/>
              <path fill="#34A853" d="M24 48c6.1 0 11.2-2 14.9-5.4l-7-5.5c-2 1.3-4.5 2.1-7.9 2.1-6.7 0-12.4-4.5-14.4-10.7l-7.8 6C6.7 42.7 14.7 48 24 48z"/>
            </svg>
            Continue with Google
          </button>
          <div id="g-signin-btn" />
          {authError && <p className="sp-auth-err">{authError}</p>}
          <p className="sp-gate-note">Free · No spam · Stored securely in your account</p>
        </div>
      </div>
    );
  }

  // ── Logged-in ────────────────────────────────────────────────────────────
  const avatarUrl = user.user_metadata?.avatar_url;
  const displayName = user.user_metadata?.full_name || user.email.split('@')[0];

  return (
    <div className="sp-wrap">

      {/* Profile card */}
      <div className="sp-profile-card">
        <div className="sp-profile-left">
          {avatarUrl
            ? <img className="sp-avatar-lg" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
            : <div className="sp-avatar-lg sp-avatar-fallback">{displayName[0].toUpperCase()}</div>
          }
          <div className="sp-profile-info">
            <span className="sp-profile-name">{displayName}</span>
            <span className="sp-profile-email">{user.email}</span>
            <div className="sp-profile-stats">
              <span><strong>{followedTopics.length}</strong> topics</span>
              <span aria-hidden>·</span>
              <span><strong>{followedSources.length}</strong> sources</span>
              <span aria-hidden>·</span>
              <span><strong>{savedArticles.length}</strong> saved</span>
            </div>
          </div>
        </div>
        <button className="sp-signout" onClick={signOut}>Sign out</button>
      </div>

      {/* Sub-panel tabs */}
      <div className="sp-tabs">
        {[
          ['topics', '🎯', 'My Feed'],
          ['saved',  '🔖', 'Saved Stories'],
        ].map(([id, icon, label]) => (
          <button key={id} className={`sp-tab${panel === id ? ' on' : ''}`} onClick={() => { setPanel(id); if (id !== 'topics') setEditing(false); }}>
            <span className="sp-tab-icon">{icon}</span>
            <span className="sp-tab-label">{label}</span>
            {id === 'saved' && savedArticles.length > 0 && (
              <span className="sp-tab-badge">{savedArticles.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── My Feed panel ─────────────────────────────────────────────── */}
      {panel === 'topics' && (
        <div className="sp-panel">

          {/* Feed header row */}
          <div className="sp-feed-hdr">
            <div className="sp-feed-hdr-left">
              {editing ? (
                <>
                  <span className="sp-feed-hdr-title">Edit Preferences</span>
                  <span className="sp-feed-hdr-sub">Toggle topics and sources for your feed</span>
                </>
              ) : (
                <>
                  <span className="sp-feed-hdr-title">Your Feed</span>
                  {feedArticles.length > 0
                    ? <span className="sp-feed-hdr-sub">{feedArticles.length} stories from your followed topics & sources</span>
                    : <span className="sp-feed-hdr-sub">Follow topics or sources to build your personalised feed</span>
                  }
                </>
              )}
            </div>
            <button
              className={`sp-edit-btn${editing ? ' done' : ''}`}
              onClick={() => setEditing(e => !e)}
            >
              {editing ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Done
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit Preferences
                </>
              )}
            </button>
          </div>

          {/* ── Edit mode: topic + source toggles ── */}
          {editing && (
            <>
              <div className="sp-section">
                <div className="sp-section-hdr">
                  <h3 className="sp-sec-title">Topics</h3>
                  <span className="sp-sec-hint">{followedTopics.length} followed</span>
                </div>
                <div className="sp-topic-grid">
                  {TOPIC_CATEGORIES.filter(c => c.id !== 'All').map(c => {
                    const active = followedTopics.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        className={`sp-topic-card${active ? ' on' : ''}`}
                        onClick={() => toggleTopic(c.id)}
                        aria-pressed={active}
                      >
                        <span className="sp-topic-icon">{TOPIC_ICONS[c.id] || '📌'}</span>
                        <span className="sp-topic-label">{c.label}</span>
                        <span className="sp-topic-check">{active ? '✓' : '+'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="sp-section">
                <div className="sp-section-hdr">
                  <h3 className="sp-sec-title">Sources</h3>
                  <span className="sp-sec-hint">{followedSources.length} followed</span>
                </div>
                <div className="sp-source-groups">
                  {SOURCE_GROUPS.map(group => (
                    <div key={group.label} className="sp-source-group">
                      <div className="sp-source-group-label">{group.label}</div>
                      <div className="sp-source-group-list">
                        {group.sources.map(src => {
                          const followed = followedSources.includes(src);
                          return (
                            <button
                              key={src}
                              className={`sp-source-pill${followed ? ' on' : ''}`}
                              onClick={() => toggleSource(src)}
                              aria-pressed={followed}
                            >
                              {followed ? '✓ ' : ''}{src}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Feed mode: horizontal scrolling cards ── */}
          {!editing && (
            followedTopics.length === 0 && followedSources.length === 0 ? (
              <div className="sp-empty-state">
                <div className="sp-empty-icon">🎯</div>
                <h3>Your feed is empty</h3>
                <p>Tap <strong>Edit Preferences</strong> above to follow topics and sources you care about.</p>
              </div>
            ) : (
              <NewsFeed
                {...feedProps}
                articles={feedArticles}
                emptyTitle="No recent stories"
                emptySubtitle="No new articles yet from your followed topics and sources."
              />
            )
          )}
        </div>
      )}

      {/* ── Saved Stories panel ───────────────────────────────────────── */}
      {panel === 'saved' && (
        <div className="sp-panel">
          <NewsFeed
            {...feedProps}
            articles={savedArticles}
            emptyTitle="No saved stories yet"
            emptySubtitle="Tap the ☆ star on any article to save it here and read later."
          />
        </div>
      )}
    </div>
  );
}
