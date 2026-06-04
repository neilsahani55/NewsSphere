import { memo } from 'react';
import { useMarkets } from '../hooks/useMarkets.js';

function inr(n) {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function num(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function ChangeBadge({ change, period }) {
  if (change == null) return null;
  const up = change >= 0;
  return (
    <div className="mkt-change-row">
      <span className={`mkt-change ${up ? 'mkt-up' : 'mkt-dn'}`}>
        {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
      </span>
      {period && <span className="mkt-period">{period}</span>}
    </div>
  );
}

// period: '1D' for stocks/commodities (day change from previous close)
//         '24h' for crypto (rolling 24-hour window from CoinGecko)
function Tile({ label, value, sub, change, period, loading, icon }) {
  return (
    <div className="mkt-tile" role="listitem">
      <span className="mkt-label">
        {icon && <span className="mkt-icon">{icon}</span>}
        {label}
      </span>
      {loading ? (
        <span className="mkt-skel" aria-hidden />
      ) : (
        <div className="mkt-value-row">
          <span className="mkt-value">{value}</span>
          {sub && <span className="mkt-sub">{sub}</span>}
        </div>
      )}
      {!loading && <ChangeBadge change={change} period={period} />}
    </div>
  );
}

function formatIST(ts) {
  if (!ts) return '';
  const d   = new Date(ts);
  const now = new Date();
  const opts = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true };
  const time = new Intl.DateTimeFormat('en-IN', opts).format(d);
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
      change: data?.usdInrChange,
      period: '1D',
    },
    {
      key: 'sensex',
      icon: '📈',
      label: 'Sensex',
      value: num(data?.sensex?.price),
      change: data?.sensex?.change,
      period: '1D',
    },
    {
      key: 'nifty',
      icon: '📊',
      label: 'Nifty 50',
      value: num(data?.nifty?.price),
      change: data?.nifty?.change,
      period: '1D',
    },
    {
      key: 'g24',
      icon: '🥇',
      label: 'Gold 24K',
      value: inr(data?.gold24k),
      sub: '/10g',
      change: data?.gold24kChange,
      period: '1D',
    },
    {
      key: 'g22',
      icon: '🏅',
      label: 'Gold 22K',
      value: inr(data?.gold22k),
      sub: '/10g',
      change: data?.gold22kChange,
      period: '1D',
    },
    {
      key: 'silver',
      icon: '🥈',
      label: 'Silver',
      value: inr(data?.silver),
      sub: '/kg',
      change: data?.silverChange,
      period: '1D',
    },
    {
      key: 'btc',
      icon: '₿',
      label: 'Bitcoin',
      value: inr(data?.btc?.price),
      change: data?.btc?.change,
      period: '1D',
    },
    {
      key: 'eth',
      icon: 'Ξ',
      label: 'Ethereum',
      value: inr(data?.eth?.price),
      change: data?.eth?.change,
      period: '1D',
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
