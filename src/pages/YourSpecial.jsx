import { useEffect, useState } from 'react';
import { authSupabase, useAuth } from '../hooks/useAuth.js';
import { useBookmarks } from '../hooks/useBookmarks.js';
import { TOPIC_CATEGORIES } from '../utils/categories.js';
import { relativeTime, isBoilerplate, stripHtml, truncate } from '../utils/format.js';
import { getCached } from '../services/translateService.js';

const ALL_SOURCES = [
  'Times of India','Hindustan Times','The Hindu','Firstpost','Indian Express',
  'India Today','Scroll.in','Deccan Herald','News18','The Quint',
  'The News Minute','Business Standard','Outlook India',
  'BBC','Al Jazeera','CNN','The Guardian',
  'TechCrunch','The Verge','Hacker News',
  'Livemint','Economic Times','ScienceDaily',
  'ESPNcricinfo','ESPN','Variety','Bollywood Hungama',
  'CoinDesk','CoinTelegraph','The Print','Politico','Krebs on Security',
];

export default function YourSpecial({ articles, selectedUrl, onSelect, target, onSeeAll }) {
  const { user, loading, authError, signIn, signOut } = useAuth();
  const { isBookmarked, toggle: toggleBookmark } = useBookmarks();
  const [panel, setPanel] = useState('topics'); // 'topics' | 'searches' | 'saved'
  const [savedSearches, setSavedSearches] = useState([]);
  const [followedSources, setFollowedSources] = useState([]);
  const [followedTopics, setFollowedTopics] = useState([]);
  const [ssLoading, setSsLoading] = useState(false);

  // Load saved searches + prefs from Supabase when logged in
  useEffect(() => {
    if (!user) return;
    setSsLoading(true);
    Promise.all([
      authSupabase.from('saved_searches').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      authSupabase.from('source_prefs').select('*').eq('user_id', user.id),
      authSupabase.from('topic_prefs').select('*').eq('user_id', user.id),
    ]).then(([ss, sp, tp]) => {
      setSavedSearches(ss.data || []);
      setFollowedSources((sp.data || []).filter(r => r.followed).map(r => r.source_name));
      setFollowedTopics((tp.data || []).filter(r => r.followed).map(r => r.topic));
      setSsLoading(false);
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

  const deleteSavedSearch = async (id) => {
    setSavedSearches(prev => prev.filter(s => s.id !== id));
    await authSupabase.from('saved_searches').delete().eq('id', id);
  };

  // Saved articles (bookmarks)
  const savedArticles = articles.filter(a => isBookmarked(a.article_url));

  if (loading) return <div className="sp-loading">Loading…</div>;

  if (!user) {
    return (
      <div className="sp-gate">
        <div className="sp-gate-card">
          <div className="sp-gate-icon" aria-hidden>✦</div>
          <h2>Your Special</h2>
          <p>Sign in to personalise your feed — follow topics and sources, save searches, and access your bookmarks from any device.</p>
          <button className="sp-google-btn" onClick={signIn}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.6 2.2 30.1 0 24 0 14.7 0 6.7 5.3 2.7 13l7.8 6c1.8-5.4 6.8-9.5 13.5-9.5z"/>
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.2-4.5 6.8l7 5.5c4.1-3.8 6.5-9.4 6.5-16.3z"/>
              <path fill="#FBBC05" d="M10.5 28.5c-.5-1.5-.8-3-.8-4.5s.3-3 .8-4.5l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.7 10.5l7.8-6z"/>
              <path fill="#34A853" d="M24 48c6.1 0 11.2-2 14.9-5.4l-7-5.5c-2 1.3-4.5 2.1-7.9 2.1-6.7 0-12.4-4.5-14.4-10.7l-7.8 6C6.7 42.7 14.7 48 24 48z"/>
            </svg>
            Continue with Google
          </button>
          {/* Fallback target for Google's rendered button if One Tap is suppressed */}
          <div id="g-signin-btn" />
          {authError && <p className="sp-auth-err">{authError}</p>}
          <p className="sp-gate-note">Your preferences are stored securely in your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-wrap">
      {/* User header */}
      <div className="sp-user-bar">
        {user.user_metadata?.avatar_url && (
          <img className="sp-avatar" src={user.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" />
        )}
        <div className="sp-user-info">
          <span className="sp-user-name">{user.user_metadata?.full_name || user.email}</span>
          <span className="sp-user-email">{user.email}</span>
        </div>
        <button className="sp-signout" onClick={signOut}>Sign out</button>
      </div>

      {/* Sub-panel tabs */}
      <div className="sp-tabs">
        {[['topics','Topics & Sources'],['searches','Saved Searches'],['saved','Saved Stories']].map(([id, label]) => (
          <button key={id} className={`sp-tab${panel === id ? ' on' : ''}`} onClick={() => setPanel(id)}>
            {label}
          </button>
        ))}
      </div>

      {panel === 'topics' && (
        <div className="sp-panel">
          <div className="sp-section">
            <h3 className="sp-sec-title">Topics</h3>
            <div className="sp-chips">
              {TOPIC_CATEGORIES.filter(c => c.id !== 'All').map(c => (
                <button
                  key={c.id}
                  className={`sp-chip${followedTopics.includes(c.id) ? ' on' : ''}`}
                  onClick={() => toggleTopic(c.id)}
                >
                  {followedTopics.includes(c.id) ? '✓ ' : ''}{c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="sp-section">
            <h3 className="sp-sec-title">Sources</h3>
            <div className="sp-source-list">
              {ALL_SOURCES.map(src => (
                <label key={src} className="sp-source-row">
                  <input
                    type="checkbox"
                    checked={followedSources.includes(src)}
                    onChange={() => toggleSource(src)}
                    className="sp-source-check"
                  />
                  <span className="sp-source-name">{src}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {panel === 'searches' && (
        <div className="sp-panel">
          {ssLoading ? <p className="sp-loading-sm">Loading…</p>
          : savedSearches.length === 0 ? (
            <div className="sp-empty">
              <p>No saved searches yet.</p>
              <p className="sp-empty-sub">Use the search bar and save searches to find them here.</p>
            </div>
          ) : (
            <ul className="sp-search-list">
              {savedSearches.map(s => (
                <li key={s.id} className="sp-search-row">
                  <span className="sp-search-q">{s.query}</span>
                  {s.topics?.length > 0 && <span className="sp-search-topics">{s.topics.join(', ')}</span>}
                  <button className="sp-search-del" onClick={() => deleteSavedSearch(s.id)} aria-label="Delete">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {panel === 'saved' && (
        <div className="sp-panel">
          {savedArticles.length === 0 ? (
            <div className="sp-empty">
              <p>No saved stories yet.</p>
              <p className="sp-empty-sub">Tap ☆ on any article to save it here.</p>
            </div>
          ) : (
            <ul className="sp-saved-list">
              {savedArticles.map(a => {
                const title = getCached(a, 'title', target) || a.title || 'Untitled';
                const rawDesc = getCached(a, 'description', target);
                const desc = isBoilerplate(rawDesc) ? null : rawDesc;
                const preview = truncate(stripHtml(desc || a.content), 120);
                return (
                  <li
                    key={a.article_url}
                    className={`sp-saved-row${a.article_url === selectedUrl ? ' on' : ''}`}
                    onClick={() => onSelect(a)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => { if (e.key === 'Enter') onSelect(a); }}
                  >
                    <div className="sp-saved-body">
                      <span className="sp-saved-title">{title}</span>
                      {preview && <span className="sp-saved-prev">{preview}</span>}
                      <span className="sp-saved-meta">{a.source_name} · {relativeTime(a.published_at_ist || a.fetched_at_ist)}</span>
                    </div>
                    <button
                      className="sp-saved-bm"
                      onClick={(e) => { e.stopPropagation(); toggleBookmark(a.article_url); }}
                      aria-label="Remove bookmark"
                    >★</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
