import { useEffect, useState } from 'react';
import { fetchLocation, INDIA_DEFAULT } from './useLocation.js';

// wttr.in weather codes → emoji + short label
function wttrLabel(code) {
  const c = parseInt(code, 10);
  if (c === 113)                    return { emoji: '☀️',  label: 'Clear'         };
  if (c === 116)                    return { emoji: '⛅',  label: 'Partly cloudy' };
  if (c === 119 || c === 122)       return { emoji: '☁️',  label: 'Overcast'      };
  if (c === 143 || c === 248 || c === 260) return { emoji: '🌫️', label: 'Foggy'  };
  if ([176,263,266,281,353].includes(c))  return { emoji: '🌦️', label: 'Drizzle'  };
  if ([284,293,296,299,302,305,308,356,359].includes(c)) return { emoji: '🌧️', label: 'Rainy' };
  if ([179,182,185,311,314,317,320,362,365].includes(c)) return { emoji: '🌨️', label: 'Sleet' };
  if ([227,230,323,326,329,332,335,338,368,371,392,395].includes(c)) return { emoji: '❄️', label: 'Snowy' };
  if ([200,386,389].includes(c))    return { emoji: '⛈️',  label: 'Thunderstorm'  };
  return { emoji: '🌡️', label: 'Unknown' };
}

// Step 1: IP-based location (ipapi.co) — no permission prompt, instant
// Use shared location hook (de-duplicates the ipapi.co call across all widgets)

// Step 2: wttr.in weather — highly reliable CORS, works from any origin
async function wttrWeather(lat, lon, city) {
  const res = await fetch(
    `https://wttr.in/${lat.toFixed(4)},${lon.toFixed(4)}?format=j1`,
    { signal: AbortSignal.timeout(6000) }
  );
  if (!res.ok) throw new Error('wttr failed');
  const json = await res.json();
  const curr = json.current_condition?.[0];
  if (!curr) throw new Error('no data');
  const { emoji, label } = wttrLabel(curr.weatherCode);
  return { city, temp: parseInt(curr.temp_C, 10), emoji, label };
}

async function loadWeatherForLocation(location) {
  return wttrWeather(location.lat, location.lon, location.city);
}

export function useWeather() {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    let live = true;
    fetchLocation()
      .then(async (location) => {
        try {
          return await loadWeatherForLocation(location);
        } catch {
          if (location.city === INDIA_DEFAULT.city) throw new Error('weather unavailable');
          return loadWeatherForLocation(INDIA_DEFAULT);
        }
      })
      .then(w => { if (live) setWeather(w); })
      .catch(() => { if (live) setWeather(null); });
    return () => { live = false; };
  }, []);

  return { weather, loading: weather === null };
}
