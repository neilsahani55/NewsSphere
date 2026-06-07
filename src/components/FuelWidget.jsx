import { memo } from 'react';
import { useFuel } from '../hooks/useFuel.js';

function formatIST(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const sameDay = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) ===
                  new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(d);
  return sameDay ? `${time} IST` : new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(d);
}

export default memo(function FuelWidget() {
  const { data, loading } = useFuel();
  const hasCNG = data?.cng != null;

  // While pipeline hasn't run yet, show a neutral "no data" state
  if (!loading && !data) {
    return (
      <section className="fuel-wrap" aria-label="Fuel prices">
        <div className="fuel-head">
          <span className="fuel-title">⛽ Fuel Prices</span>
        </div>
        <p style={{ fontSize: '.75rem', color: 'var(--ink3)', margin: 0 }}>
          Prices loading — pipeline populates data every 6 hours.
        </p>
      </section>
    );
  }

  return (
    <section className="fuel-wrap" aria-label="Today's fuel prices">
      <div className="fuel-head">
        <span className="fuel-title">⛽ Fuel Prices</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginLeft: 'auto' }}>
          {data?.city && <span className="fuel-city">{data.city}</span>}
          {data?.updatedAt && (
            <span className="fuel-note">{formatIST(data.updatedAt)}</span>
          )}
        </div>
      </div>

      {loading && !data ? (
        <div className="fuel-grid">
          <div className="fuel-card"><span className="fuel-skel" /></div>
          <div className="fuel-card"><span className="fuel-skel" /></div>
        </div>
      ) : (
        <div className={`fuel-grid${hasCNG ? ' fuel-grid-3' : ''}`}>
          <div className="fuel-card fuel-petrol">
            <span className="fuel-icon" aria-hidden>🟢</span>
            <div className="fuel-body">
              <span className="fuel-type">Petrol</span>
              <span className="fuel-price">
                {data?.petrol != null ? `₹${Number(data.petrol).toFixed(2)}` : '—'}
              </span>
              <span className="fuel-unit">per litre</span>
            </div>
          </div>

          <div className="fuel-card fuel-diesel">
            <span className="fuel-icon" aria-hidden>🔵</span>
            <div className="fuel-body">
              <span className="fuel-type">Diesel</span>
              <span className="fuel-price">
                {data?.diesel != null ? `₹${Number(data.diesel).toFixed(2)}` : '—'}
              </span>
              <span className="fuel-unit">per litre</span>
            </div>
          </div>

          {hasCNG && (
            <div className="fuel-card fuel-cng">
              <span className="fuel-icon" aria-hidden>🟡</span>
              <div className="fuel-body">
                <span className="fuel-type">CNG</span>
                <span className="fuel-price">₹{Number(data.cng).toFixed(2)}</span>
                <span className="fuel-unit">per kg</span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
});
