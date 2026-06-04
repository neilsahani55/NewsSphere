import { memo } from 'react';
import { aqiCategory, useAQI } from '../hooks/useAQI.js';

export default memo(function AQIBadge() {
  const data = useAQI();
  if (!data) return null;

  const cat = aqiCategory(data.aqi);

  return (
    <div
      className="aqi-badge"
      style={{ '--aqi-color': cat.color, '--aqi-bg': cat.bg }}
      title={`Air Quality Index: ${data.aqi} — ${cat.label}${data.pm25 != null ? ` · PM2.5 ${data.pm25.toFixed(1)} μg/m³` : ''}`}
    >
      <span className="aqi-dot" aria-hidden />
      <span className="aqi-label">AQI</span>
      <span className="aqi-value">{data.aqi}</span>
      <span className="aqi-cat">{cat.label}</span>
    </div>
  );
});
