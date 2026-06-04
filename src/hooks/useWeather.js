import { useEffect, useState } from 'react';

// WMO weather interpretation codes → emoji + short label
const WMO = {
  0:  { emoji: '☀️',  label: 'Clear'          },
  1:  { emoji: '🌤️', label: 'Mostly clear'   },
  2:  { emoji: '⛅',  label: 'Partly cloudy'  },
  3:  { emoji: '☁️',  label: 'Overcast'       },
  45: { emoji: '🌫️', label: 'Foggy'          },
  48: { emoji: '🌫️', label: 'Foggy'          },
  51: { emoji: '🌦️', label: 'Light drizzle'  },
  53: { emoji: '🌦️', label: 'Drizzle'        },
  55: { emoji: '🌧️', label: 'Heavy drizzle'  },
  61: { emoji: '🌧️', label: 'Light rain'     },
  63: { emoji: '🌧️', label: 'Rainy'          },
  65: { emoji: '🌧️', label: 'Heavy rain'     },
  71: { emoji: '❄️',  label: 'Light snow'     },
  73: { emoji: '❄️',  label: 'Snowy'          },
  75: { emoji: '❄️',  label: 'Heavy snow'     },
  77: { emoji: '🌨️', label: 'Snow grains'    },
  80: { emoji: '🌦️', label: 'Showers'        },
  81: { emoji: '🌦️', label: 'Showers'        },
  82: { emoji: '⛈️',  label: 'Heavy showers'  },
  85: { emoji: '🌨️', label: 'Snow showers'   },
  86: { emoji: '🌨️', label: 'Heavy snow'     },
  95: { emoji: '⛈️',  label: 'Thunderstorm'   },
  96: { emoji: '⛈️',  label: 'Thunderstorm'   },
  99: { emoji: '⛈️',  label: 'Thunderstorm'   },
};

// Default: New Delhi, India
const DEF = { lat: 28.6139, lon: 77.209, city: 'India' };

async function fetchWeather(lat, lon, city) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`,
    { signal: AbortSignal.timeout(6000) }
  );
  if (!res.ok) throw new Error();
  const json = await res.json();
  const cw = json.current_weather;
  const wmo = WMO[cw?.weathercode] ?? { emoji: '🌡️', label: 'Unknown' };
  return { city, temp: Math.round(cw?.temperature ?? 0), ...wmo };
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { signal: AbortSignal.timeout(5000), headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) return DEF.city;
    const j = await res.json();
    return (
      j?.address?.city   ||
      j?.address?.town   ||
      j?.address?.county ||
      j?.address?.state  ||
      DEF.city
    );
  } catch { return DEF.city; }
}

export function useWeather() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;

    async function loadDefault() {
      try {
        const w = await fetchWeather(DEF.lat, DEF.lon, DEF.city);
        if (live) { setWeather(w); setLoading(false); }
      } catch {
        if (live) setLoading(false);
      }
    }

    if (!('geolocation' in navigator)) { loadDefault(); return; }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (!live) return;
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const [city] = await Promise.all([reverseGeocode(lat, lon)]);
          const w = await fetchWeather(lat, lon, city);
          if (live) { setWeather(w); setLoading(false); }
        } catch { loadDefault(); }
      },
      () => { if (live) loadDefault(); }, // permission denied → use India default
      { timeout: 5000, maximumAge: 600000 }
    );

    return () => { live = false; };
  }, []);

  return { weather, loading };
}
