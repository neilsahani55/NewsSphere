import { useMemo } from 'react';
import { matchesTopic } from '../utils/categories.js';
import { isBoilerplate, parseDate, relativeTime, stripHtml, truncate } from '../utils/format.js';
import { getCached } from '../services/translateService.js';
import { useUIStrings } from '../hooks/useUIStrings.js';
import TodayHistory from '../components/TodayHistory.jsx';

const HOME_STRINGS = {
  briefing: 'Your briefing',
  topStories: 'Top stories',
  seeAll: 'See all →',
};

const SECTIONS = ['India','World','Tech','Business','Science','Health','Sports','Entertainment','Crypto','Politics','Environment','Crime'];

function HomeCard({ article, featured, compact, selected, onSelect, target }) {
  const title = getCached(article, 'title', target) || article.title || 'Untitled';
  const rawDesc = getCached(article, 'description', target);
  const desc = isBoilerplate(rawDesc) ? null : rawDesc;
  const preview = !compact && truncate(stripHtml(desc || article.content), featured ? 180 : 100);

  return (
    <article
      className={`hcard${featured ? ' hcard-feat' : ''}${compact ? ' hcard-compact' : ''}${selected ? ' hcard-on' : ''}`}
      onClick={() => onSelect(article)}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(article); } }}
    >
      {!compact && article.image_url && (
        <img className="hcard-img" src={article.image_url} alt="" loading={featured ? 'eager' : 'lazy'} fetchPriority={featured ? 'high' : 'auto'} referrerPolicy="no-referrer" />
      )}
      <div className="hcard-body">
        <h3 className="hcard-title">{title}</h3>
        {preview && <p className="hcard-prev">{preview}</p>}
        <div className="hcard-meta">
          <span className="hcard-src">{article.source_name || 'Unknown'}</span>
          <span className="dot-sep" aria-hidden>·</span>
          <span>{relativeTime(article.published_at_ist || article.fetched_at_ist)}</span>
        </div>
      </div>
    </article>
  );
}

function HomeSkeleton() {
  return (
    <div className="home-skeleton-wrap" aria-hidden>
      <div className="home-sec">
        <div className="home-sec-hdr">
          <div className="hskel-line hskel-line--hd" />
        </div>
        <div className="home-top-grid">
          <div className="hskel-card hskel-card--feat">
            <div className="hskel-img" />
            <div className="hskel-body">
              <div className="hskel-line" />
              <div className="hskel-line hskel-line--sm" />
            </div>
          </div>
          <div className="home-top-side">
            {[0, 1, 2].map(i => (
              <div key={i} className="hskel-card hskel-card--compact">
                <div className="hskel-line" />
                <div className="hskel-line hskel-line--sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {[0, 1].map(i => (
        <div key={i} className="home-sec">
          <div className="home-sec-hdr">
            <div className="hskel-line hskel-line--hd" />
          </div>
          <div className="home-cat-grid">
            {[0, 1, 2, 3].map(j => (
              <div key={j} className="hskel-card hskel-card--compact">
                <div className="hskel-line" />
                <div className="hskel-line hskel-line--sm" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage({ articles, articlesStatus, selectedUrl, onSelect, target, onSeeAll }) {
  const t = useUIStrings(HOME_STRINGS, target);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const now = Date.now();
  const loading = articlesStatus === 'loading' || articlesStatus === 'idle';

  const topStories = useMemo(() => {
    const last24h = articles.filter(a => {
      const d = parseDate(a.published_at_ist || a.fetched_at_ist);
      return d && (now - d.getTime()) < 86400000;
    });
    const pool = last24h.length >= 4 ? last24h : articles;
    // Featured slot needs an image — sort articles with images first
    return [...pool].sort((a, b) => (b.image_url ? 1 : 0) - (a.image_url ? 1 : 0)).slice(0, 4);
  }, [articles]);

  const sections = useMemo(() =>
    SECTIONS.map(cat => ({
      cat,
      items: articles.filter(a => matchesTopic(a.category, cat)).slice(0, 4),
    })).filter(s => s.items.length > 0),
    [articles]
  );

  const [featured, ...sideStories] = topStories;

  return (
    <div className="home-pg">
      <div className="home-briefing">
        <h2 className="home-briefing-title">{t.briefing}</h2>
        <span className="home-briefing-date">{today}</span>
      </div>

      <TodayHistory target={target} />

      {loading && topStories.length === 0 && <HomeSkeleton />}

      {topStories.length > 0 && (
        <section className="home-sec">
          <div className="home-sec-hdr">
            <h3>{t.topStories}</h3>
            <button className="home-see-all" onClick={() => onSeeAll(null)}>{t.seeAll}</button>
          </div>
          <div className="home-top-grid">
            {featured && (
              <HomeCard
                article={featured}
                featured
                selected={featured.article_url === selectedUrl}
                onSelect={onSelect}
                target={target}
              />
            )}
            <div className="home-top-side">
              {sideStories.map(a => (
                <HomeCard
                  key={a.article_url}
                  article={a}
                  compact
                  selected={a.article_url === selectedUrl}
                  onSelect={onSelect}
                  target={target}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {sections.map(({ cat, items }) => (
        <section key={cat} className="home-sec">
          <div className="home-sec-hdr">
            <h3>{cat}</h3>
            <button className="home-see-all" onClick={() => onSeeAll(cat)}>{t.seeAll}</button>
          </div>
          <div className="home-cat-grid">
            {items.map(a => (
              <HomeCard
                key={a.article_url}
                article={a}
                compact
                selected={a.article_url === selectedUrl}
                onSelect={onSelect}
                target={target}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
