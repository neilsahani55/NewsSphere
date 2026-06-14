import { useEffect, useState } from 'react';
import { fetchLocation, INDIA_DEFAULT } from './useLocation.js';

export function aqiCategory(aqi) {
  if (aqi == null) return null;
  if (aqi <= 50)  return { label: 'Good',            color: '#16a34a', bg: '#dcfce7' };
  if (aqi <= 100) return { label: 'Moderate',         color: '#ca8a04', bg: '#fef9c3' };
  if (aqi <= 150) return { label: 'Unhealthy*',       color: '#ea580c', bg: '#ffedd5' };
  if (aqi <= 200) return { label: 'Unhealthy',        color: '#dc2626', bg: '#fee2e2' };
  if (aqi <= 300) return { label: 'Very Unhealthy',   color: '#7c3aed', bg: '#ede9fe' };
  return           { label: 'Hazardous',              color: '#9f1239', bg: '#ffe4e6' };
}

export function useAQI() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let live = true;

    function fetchAqiForLocation({ lat, lon }) {
      return fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality` +
        `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
        `&current=us_aqi,pm2_5&timezone=Asia%2FKolkata`,
        { signal: AbortSignal.timeout(6000) }
      ).then(r => r.ok ? r.json() : null)
       .then((json) => {
         const aqi = json?.current?.us_aqi;
         const pm25 = json?.current?.pm2_5;
         if (aqi == null) throw new Error('aqi unavailable');
         return { aqi, pm25 };
       });
    }

    fetchLocation()
      .then(async (location) => {
        try {
          return await fetchAqiForLocation(location);
        } catch {
          if (
            location.lat === INDIA_DEFAULT.lat &&
            location.lon === INDIA_DEFAULT.lon
          ) {
            throw new Error('aqi unavailable');
          }
          return fetchAqiForLocation(INDIA_DEFAULT);
        }
      })
      .then((next) => {
        if (live) setData(next);
      })
      .catch(() => {});

    return () => { live = false; };
  }, []);

  return data;
}
