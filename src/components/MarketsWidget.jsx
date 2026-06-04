import { memo } from 'react';
import { useMarkets } from '../hooks/useMarkets.js';

// Indian number formatting (lakh/crore system)
function inr(n, decimals = 0) {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function num(n, decimals = 0) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function ChangeBadge({ change }) {
  if (change == null) return null;
  const up = change >= 0;
  return (
    <span className={`mkt-change ${up ? 'mkt-up' : 'mkt-dn'}`}>
      {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
    </span>
  );
}

function Tile({ label, value, sub, change, loading, icon }) {
  return (
    <div className="mkt-tile" role="listitem">
      <span className="mkt-label">{icon && <span className="mkt-icon">{icon}</span>}{label}</span>
      {loading
        ? <span className="mkt-skel" aria-hidden />
        : <span className="mkt-value">{value}</span>
      }
      {!loading && (change != null
        ? <ChangeBadge change={change} />
        : sub ? <span className="mkt-sub">{sub}</span> : null
      )}
    </div>
  );
}

function lastUpdated(ts) {
  if (!ts) return '';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default memo(function MarketsWidget() {
  const { data, loading, refresh } = useMarkets();

  const tiles = [
    {
      key: 'usd',
      icon: '🇺🇸',
      label: 'USD/INR',
      value: data?.usdInr ? `₹${Number(data.usdInr).toFixed(2)}` : '—',
      sub: 'forex',
    },
    {
      key: 'sensex',
      icon: '📈',
      label: 'Sensex',
      value: num(data?.sensex?.price),
      change: data?.sensex?.change,
    },
    {
      key: 'nifty',
      icon: '📊',
      label: 'Nifty 50',
      value: num(data?.nifty?.price),
      change: data?.nifty?.change,
    },
    {
      key: 'g24',
      icon: '🥇',
      label: 'Gold 24K',
      value: inr(data?.gold24k),
      sub: '/10g',
    },
    {
      key: 'g22',
      icon: '🏅',
      label: 'Gold 22K',
      value: inr(data?.gold22k),
      sub: '/10g',
    },
    {
      key: 'silver',
      icon: '🥈',
      label: 'Silver',
      value: inr(data?.silver),
      sub: '/kg',
    },
    {
      key: 'btc',
      icon: '₿',
      label: 'Bitcoin',
      value: inr(data?.btc?.price),
      change: data?.btc?.change,
    },
    {
      key: 'eth',
      icon: 'Ξ',
      label: 'Ethereum',
      value: inr(data?.eth?.price),
      change: data?.eth?.change,
    },
  ];

  return (
    <section className="mkt-wrap" aria-label="Markets">
      <div className="mkt-head">
        <span className="mkt-title">Markets</span>
        <div className="mkt-head-right">
          {data?.ts && (
            <span className="mkt-updated">
              <span className="mkt-dot" aria-hidden />
              {lastUpdated(data.ts)}
            </span>
          )}
          <button
            className={`mkt-refresh${loading ? ' mkt-spinning' : ''}`}
            onClick={refresh}
            disabled={loading}
            title="Refresh market data"
            aria-label="Refresh market data"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="mkt-strip" role="list">
        {tiles.map(t => (
          <Tile key={t.key} {...t} loading={loading} />
        ))}
      </div>
    </section>
  );
});
