import { memo } from 'react';
import { useFuel } from '../hooks/useFuel.js';

export default memo(function FuelWidget() {
  const { data, loading } = useFuel();

  return (
    <section className="fuel-wrap" aria-label="Today's fuel prices">
      <div className="fuel-head">
        <span className="fuel-title">⛽ Fuel Prices</span>
        {data?.city && <span className="fuel-city">{data.city}</span>}
        <span className={`fuel-source ${data?.source === 'live' ? 'fuel-src-live' : 'fuel-src-ref'}`}>
          {data?.source === 'live' ? '🟢 Live' : 'Reference'}
        </span>
      </div>

      {loading && !data ? (
        <div className="fuel-grid">
          <div className="fuel-card"><span className="fuel-skel" /></div>
          <div className="fuel-card"><span className="fuel-skel" /></div>
        </div>
      ) : (
        <div className="fuel-grid">
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
        </div>
      )}
    </section>
  );
});
