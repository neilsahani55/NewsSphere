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

function formatIST(ts) {
  if (!ts) return '';
  const d   = new Date(ts);
  const now = new Date();
  const opts = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true };
  const time = new Intl.DateTimeFormat('en-IN', opts).format(d);

  // If the update happened on a previous day, also show the date
  const sameDay =
    d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) ===
    now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

  if (sameDay) return `${time} IST`;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(d);
}

export default memo(function MarketsWidget() {
  const { data, loading } = useMarkets();

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
        {(data?.dbUpdatedAt || loading) && (
          <span className="mkt-updated">
            <span className="mkt-dot" aria-hidden />
            {loading && !data ? 'Loading…' : `Updated ${formatIST(data.dbUpdatedAt)}`}
          </span>
        )}
      </div>
      <div className="mkt-strip" role="list">
        {tiles.map(t => (
          <Tile key={t.key} {...t} loading={loading} />
        ))}
      </div>
    </section>
  );
});
