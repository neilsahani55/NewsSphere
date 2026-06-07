import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function todayIST() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function readCache(date) {
  try {
    const raw = sessionStorage.getItem(`ns_history_v2_${date}`);
    if (!raw) return null;
    const { data } = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch { return null; }
}

function writeCache(date, data) {
  try {
    sessionStorage.setItem(`ns_history_v2_${date}`, JSON.stringify({ data }));
  } catch {}
}

export function useHistory(date) {
  const targetDate = date || todayIST();
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('loading');
  const activeDate = useRef(null);

  useEffect(() => {
    activeDate.current = targetDate;

    const cached = readCache(targetDate);
    if (cached !== null) {
      setEvents(cached);
      setStatus(cached.length > 0 ? 'success' : 'empty');
      return;
    }

    setEvents([]);
    setStatus('loading');

    supabase
      .from('today_history')
      .select('id, event_year, title, description, category, details')
      .eq('history_date', targetDate)
      // Fetch all rows then sort numerically on the client.
      // DB text ordering ('event_year' is stored as TEXT) fails for ancient years:
      // "500" > "2026" alphabetically ('5' > '2'), putting year-500 events first.
      // Numeric sort fixes this completely regardless of year magnitude.
      .then(({ data, error }) => {
        if (activeDate.current !== targetDate) return; // stale response
        if (error) { setStatus('error'); return; }

        // Deduplicate by (event_year, title)
        const seen = new Set();
        const deduped = (data || []).filter(r => {
          const key = `${r.event_year}|${(r.title || '').toLowerCase().trim()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Sort descending by year numerically (most recent first)
        const rows = deduped.sort((a, b) => Number(b.event_year) - Number(a.event_year));

        writeCache(targetDate, rows);
        setEvents(rows);
        setStatus(rows.length > 0 ? 'success' : 'empty');
      });
  }, [targetDate]);

  return { events, status };
}
