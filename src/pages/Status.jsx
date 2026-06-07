import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import PageShell from './PageShell.jsx';

export default function Status() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('news')
        .select('id, category, fetched_at_ist, source_name, enriched')
        .eq('enriched', true)
        .order('fetched_at_ist', { ascending: false })
        .limit(2000);

      if (error || !data) { setLoading(false); return; }

      const lastFetch = data[0]?.fetched_at_ist ? new Date(data[0].fetched_at_ist) : null;
      const catCounts = {};
      const srcCounts = {};
      data.forEach(a => {
        const cats = (a.category || 'Other').split(',').map(c => c.trim()).filter(Boolean);
        cats.forEach(c => { catCounts[c] = (catCounts[c] || 0) + 1; });
        const src = a.source_name || 'Unknown';
        srcCounts[src] = (srcCounts[src] || 0) + 1;
      });

      const topSources = Object.entries(srcCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const topCats = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1]);

      setStats({ total: data.length, lastFetch, topCats, topSources });
      setLoading(false);
    }
    load();
  }, []);

  function age(date) {
    if (!date) return 'unknown';
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  return (
    <PageShell title="Service Status">
      <p className="pg-updated">Live stats — updated automatically throughout the day.</p>
      {loading && <p className="pg-loading">Loading status…</p>}
      {!loading && !stats && <p className="pg-err">Could not load status information at this time.</p>}
      {stats && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-num">{stats.total.toLocaleString()}</span>
              <span className="stat-lbl">Articles available</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{stats.lastFetch ? age(stats.lastFetch) : '—'}</span>
              <span className="stat-lbl">Last updated</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{stats.topCats.length}</span>
              <span className="stat-lbl">Topic categories</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{stats.topSources.length}+</span>
              <span className="stat-lbl">News sources</span>
            </div>
          </div>

          <h2>Articles by topic</h2>
          <div className="stat-bars">
            {stats.topCats.map(([cat, n]) => (
              <div key={cat} className="stat-bar-row">
                <span className="stat-bar-lbl">{cat}</span>
                <div className="stat-bar-track">
                  <div
                    className="stat-bar-fill"
                    style={{ width: `${Math.round((n / stats.topCats[0][1]) * 100)}%` }}
                  />
                </div>
                <span className="stat-bar-val">{n}</span>
              </div>
            ))}
          </div>

          <h2>Top sources</h2>
          <div className="stat-bars">
            {stats.topSources.map(([src, n]) => (
              <div key={src} className="stat-bar-row">
                <span className="stat-bar-lbl">{src}</span>
                <div className="stat-bar-track">
                  <div
                    className="stat-bar-fill"
                    style={{ width: `${Math.round((n / stats.topSources[0][1]) * 100)}%` }}
                  />
                </div>
                <span className="stat-bar-val">{n}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
