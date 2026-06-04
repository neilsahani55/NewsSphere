import { memo } from 'react';
import { useLocation } from '../hooks/useLocation.js';
import { FUEL_LAST_REVISED, getFuelForCity } from '../data/fuelPrices.js';

export default memo(function FuelWidget() {
  const { city } = useLocation();
  const { petrol, diesel, city: matchedCity } = getFuelForCity(city);

  return (
    <section className="fuel-wrap" aria-label="Today's fuel prices">
      <div className="fuel-head">
        <span className="fuel-title">⛽ Fuel Prices</span>
        <span className="fuel-city">{matchedCity}</span>
        <span className="fuel-note">Last revised {FUEL_LAST_REVISED}</span>
      </div>

      <div className="fuel-grid">
        <div className="fuel-card fuel-petrol">
          <span className="fuel-icon" aria-hidden>🟢</span>
          <div className="fuel-body">
            <span className="fuel-type">Petrol</span>
            <span className="fuel-price">₹{petrol.toFixed(2)}</span>
            <span className="fuel-unit">per litre</span>
          </div>
        </div>

        <div className="fuel-card fuel-diesel">
          <span className="fuel-icon" aria-hidden>🔵</span>
          <div className="fuel-body">
            <span className="fuel-type">Diesel</span>
            <span className="fuel-price">₹{diesel.toFixed(2)}</span>
            <span className="fuel-unit">per litre</span>
          </div>
        </div>
      </div>
    </section>
  );
});
