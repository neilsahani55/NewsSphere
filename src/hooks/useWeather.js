import { useEffect, useState } from 'react';

const WMO = {
  0:  { emoji: '☀️',  label: 'Clear'         },
  1:  { emoji: '🌤️', label: 'Mostly clear'  },
  2:  { emoji: '⛅',  label: 'Partly cloudy' },
  3:  { emoji: '☁️',  label: 'Overcast'      },
  45: { emoji: '🌫️', label: 'Foggy'         },
  48: { emoji: '🌫️', label: 'Foggy'         },
  51: { emoji: '🌦️', label: 'Drizzle'       },
  53: { emoji: '🌦️', label: 'Drizzle'       },
  55: { emoji: '🌧️', label: 'Heavy drizzle' },
  61: { emoji: '🌧️', label: 'Light rain'    },
  63: { emoji: '🌧️', label: 'Rainy'         },
  65: { emoji: '🌧️', label: 'Heavy rain'    },
  71: { emoji: '❄️',  label: 'Light snow'    },
  73: { emoji: '❄️',  label: 'Snowy'         },
  75: { emoji: '❄️',  label: 'Heavy snow'    },
  77: { emoji: '🌨️', label: 'Snow grains'   },
  80: { emoji: '🌦️', label: 'Showers'       },
  81: { emoji: '🌦️', label: 'Showers'       },
  82: { emoji: '⛈️',  label: 'Heavy showers' },
  95: { emoji: '⛈️',  label: 'Thunderstorm'  },
  96: { emoji: '⛈️',  label: 'Thunderstorm'  },
  99: { emoji: '⛈️',  label: 'Thunderstorm'  },
};

// Default: New Delhi, India — shown instantly while geolocation loads
const INDIA = { lat: 28.6139, lon: 77.209, city: 'India' };

async function fetchWeatherAt(lat, lon, city) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`,
    { signal: AbortSignal.timeout(6000) }
  );
  if (!res.ok) throw new Error('weather fetch failed');
  const json = await res.json();
  const cw = json.current_weather;
  const wmo = WMO[cw?.weathercode] ?? { emoji: '🌡️', label: 'Unknown' };
  return { city, temp: Math.round(cw?.temperature ?? 0), emoji: wmo.emoji, label: wmo.label };
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { signal: AbortSignal.timeout(4000), headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) return INDIA.city;
    const j = await res.json();
    return j?.address?.city || j?.address?.town || j?.address?.county || j?.address?.state || INDIA.city;
  } catch { return INDIA.city; }
}

export function useWeather() {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    let live = true;
    let geoResolved = false;

    // Step 1: Show India weather IMMEDIATELY — no waiting for geolocation.
    fetchWeatherAt(INDIA.lat, INDIA.lon, INDIA.city)
      .then(w => { if (live && !geoResolved) setWeather(w); })
      .catch(() => {});

    // Step 2: Silently try geolocation; if it arrives, upgrade to local weather.
    if (!('geolocation' in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (!live) return;
        const { latitude: lat, longitude: lon } = pos.coords;
        const city = await reverseGeocode(lat, lon);
        const local = await fetchWeatherAt(lat, lon, city).catch(() => null);
        if (live && local) {
          geoResolved = true;
          setWeather(local);
        }
      },
      () => { /* permission denied — India weather already showing */ },
      { timeout: 5000, maximumAge: 600000 }
    );

    return () => { live = false; };
  }, []);

  // loading only while the India default hasn't returned yet (<2s normally)
  return { weather, loading: weather === null };
}
