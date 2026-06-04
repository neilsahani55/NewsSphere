import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

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
      .order('event_year', { ascending: false })
      .then(({ data, error }) => {
        if (activeDate.current !== targetDate) return; // stale response
        if (error) { setStatus('error'); return; }
        const rows = data || [];
        writeCache(targetDate, rows);
        setEvents(rows);
        setStatus(rows.length > 0 ? 'success' : 'empty');
      });
  }, [targetDate]);

  return { events, status };
}
