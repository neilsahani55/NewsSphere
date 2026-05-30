import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

const CACHE_KEY = 'ns_history_v1';

function todayIST() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()); // "YYYY-MM-DD"
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { date, data } = JSON.parse(raw);
    if (date !== todayIST() || !Array.isArray(data) || data.length === 0) return null;
    return data;
  } catch { return null; }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ date: todayIST(), data }));
  } catch {}
}

export function useHistory() {
  const [events, setEvents] = useState(() => readCache() || []);
  const [status, setStatus] = useState(() => (readCache() ? 'success' : 'loading'));

  useEffect(() => {
    const cached = readCache();
    if (cached) { setEvents(cached); setStatus('success'); return; }

    supabase
      .from('today_history')
      .select('id, event_year, title, description, category, details')
      .eq('history_date', todayIST())
      .order('id', { ascending: true })
      .then(({ data, error }) => {
        if (error) { setStatus('error'); return; }
        const rows = data || [];
        setEvents(rows);
        if (rows.length > 0) writeCache(rows);
        setStatus(rows.length > 0 ? 'success' : 'empty');
      });
  }, []);

  return { events, status };
}
