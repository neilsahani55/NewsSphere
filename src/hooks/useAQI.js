import { useEffect, useState } from 'react';

const INDIA = { lat: 28.6139, lon: 77.209 };

export function aqiCategory(aqi) {
  if (aqi == null) return null;
  if (aqi <= 50)  return { label: 'Good',        color: '#16a34a', bg: '#dcfce7' };
  if (aqi <= 100) return { label: 'Moderate',     color: '#ca8a04', bg: '#fef9c3' };
  if (aqi <= 150) return { label: 'Unhealthy*',   color: '#ea580c', bg: '#ffedd5' };
  if (aqi <= 200) return { label: 'Unhealthy',    color: '#dc2626', bg: '#fee2e2' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#7c3aed', bg: '#ede9fe' };
  return           { label: 'Hazardous',          color: '#9f1239', bg: '#ffe4e6' };
}

export function useAQI() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let live = true;

    async function load() {
      // Get location from ipapi.co (same as useWeather — instant, no permission)
      let lat = INDIA.lat, lon = INDIA.lon;
      try {
        const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
        if (r.ok) { const j = await r.json(); if (j.latitude) { lat = j.latitude; lon = j.longitude; } }
      } catch {}

      try {
        const res = await fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality` +
          `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
          `&current=us_aqi,pm2_5&timezone=Asia%2FKolkata`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (!res.ok) return;
        const json = await res.json();
        const aqi  = json?.current?.us_aqi;
        const pm25 = json?.current?.pm2_5;
        if (live && aqi != null) setData({ aqi, pm25 });
      } catch {}
    }

    load();
    return () => { live = false; };
  }, []);

  return data;
}
