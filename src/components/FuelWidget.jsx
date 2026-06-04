import { memo } from 'react';
import { useFuel } from '../hooks/useFuel.js';

function formatIST(ts) {
  if (!ts) return null;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(new Date(ts));
}

export default memo(function FuelWidget() {
  const { data, loading } = useFuel();

  return (
    <section className="fuel-wrap" aria-label="Today's fuel prices">
      <div className="fuel-head">
        <span className="fuel-title">⛽ Fuel Prices</span>
        {data?.city && <span className="fuel-city">{data.city}</span>}
        <span className="fuel-note">
          {data?.updatedAt ? formatIST(data.updatedAt) : 'Per litre'}
        </span>
      </div>

      {loading && !data ? (
        <div className="fuel-grid">
          <div className="fuel-card"><span className="fuel-skel" /></div>
          <div className="fuel-card"><span className="fuel-skel" /></div>
        </div>
      ) : !data ? (
        <p className="fuel-unavail">Prices unavailable. Run the market pipeline to populate.</p>
      ) : (
        <div className="fuel-grid">
          <div className="fuel-card fuel-petrol">
            <span className="fuel-icon" aria-hidden>🟢</span>
            <div className="fuel-body">
              <span className="fuel-type">Petrol</span>
              <span className="fuel-price">₹{Number(data.petrol).toFixed(2)}</span>
              <span className="fuel-unit">per litre</span>
            </div>
          </div>

          <div className="fuel-card fuel-diesel">
            <span className="fuel-icon" aria-hidden>🔵</span>
            <div className="fuel-body">
              <span className="fuel-type">Diesel</span>
              <span className="fuel-price">
                {data.diesel != null ? `₹${Number(data.diesel).toFixed(2)}` : '—'}
              </span>
              <span className="fuel-unit">per litre</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
});
