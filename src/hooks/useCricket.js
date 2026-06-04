import { useEffect, useState } from 'react';

// ESPN cricket league IDs for live data
// Trying multiple IDs to cover international + IPL matches
const LEAGUE_IDS = [
  '6048',  // IPL
  '28',    // International cricket (bilateral series)
  '7',     // ICC events
  '8',     // Test matches
];

const CACHE_KEY = 'ns_cricket_v1';
const CACHE_TTL = 3 * 60 * 1000; // 3 min (cricket scores change fast)

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return Date.now() - ts > CACHE_TTL ? null : data;
  } catch { return null; }
}

function writeCache(data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

async function fetchLeague(id) {
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/cricket/${id}/scoreboard`,
    { signal: AbortSignal.timeout(6000) }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json?.events ?? [];
}

function parseEvent(ev) {
  const comp = ev?.competitions?.[0];
  if (!comp) return null;

  const state   = comp.status?.type?.state;   // 'pre' | 'in' | 'post'
  const summary = comp.status?.summary ?? '';
  const detail  = comp.status?.type?.detail ?? '';

  const competitors = (comp.competitors ?? []).map(c => ({
    name:   c.team?.shortDisplayName || c.team?.displayName || '?',
    score:  c.score ?? '',
    winner: c.winner === 'true' || c.winner === true,
  }));

  return {
    id:    ev.id,
    name:  ev.shortName || ev.name,
    state,
    summary,
    detail,
    competitors,
  };
}

export function useCricket() {
  const [matches, setMatches] = useState(null); // null = loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;

    async function load() {
      const cached = readCache();
      if (cached) { setMatches(cached); setLoading(false); return; }

      // Fetch all leagues in parallel; collect all events
      const results = await Promise.allSettled(LEAGUE_IDS.map(fetchLeague));
      const allEvents = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .flatMap(r => r.value);

      const parsed = allEvents
        .map(parseEvent)
        .filter(Boolean);

      // Priority: live first, then upcoming, then recent results
      const live_  = parsed.filter(m => m.state === 'in');
      const pre    = parsed.filter(m => m.state === 'pre');
      const post   = parsed.filter(m => m.state === 'post');
      const ordered = [...live_, ...pre, ...post].slice(0, 5);

      writeCache(ordered);
      if (live) { setMatches(ordered); setLoading(false); }
    }

    load();
    // Refresh every 3 minutes during a live match
    const timer = setInterval(load, CACHE_TTL);
    return () => { live = false; clearInterval(timer); };
  }, []);

  const liveMatches     = (matches ?? []).filter(m => m.state === 'in');
  const upcomingMatches = (matches ?? []).filter(m => m.state === 'pre');

  return { liveMatches, upcomingMatches, allMatches: matches ?? [], loading };
}
