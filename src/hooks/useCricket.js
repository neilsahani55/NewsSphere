/**
 * Live cricket scores from ESPN public scoreboard API.
 *
 * Rather than hardcoding league IDs (which change every season and return
 * 404 when the season ends — causing red console errors), this hook:
 *   1. Discovers active cricket leagues from ESPN's leagues endpoint
 *   2. Fetches scoreboards only for leagues that actually exist
 *
 * Browser DevTools always shows 404 requests as red errors regardless of
 * how you handle them in JS — the only fix is to not request invalid URLs.
 *
 * Cache: 3 minutes (cricket scores change frequently during live matches).
 */

import { useEffect, useState } from 'react';

const CACHE_KEY = 'ns_cricket_v2';
const CACHE_TTL = 3 * 60 * 1000;

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return Date.now() - ts > CACHE_TTL ? null : data;
  } catch { return null; }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

async function safeJson(url, ms = 6000) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;          // 404 / 4xx → null, no console error
    return await r.json();
  } catch { return null; }
}

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/cricket';

/** Step 1: discover which cricket leagues ESPN currently has active */
async function getActiveLeagueIds() {
  // Try ESPN's leagues listing endpoint first
  const json = await safeJson(`${ESPN}/leagues`);
  if (json?.leagues?.length) {
    return json.leagues.map(l => String(l.id)).filter(Boolean).slice(0, 10);
  }

  // Fallback: try ESPN's general cricket scoreboard (no league ID)
  const general = await safeJson(`${ESPN}/scoreboard`);
  if (general?.events?.length) {
    // Extract league IDs from the events themselves
    const ids = new Set(general.events.map(e => e?.season?.year || e?.league?.id).filter(Boolean));
    return [...ids].map(String);
  }

  return [];
}

/** Step 2: fetch scoreboard for a specific league (only called for valid IDs) */
async function fetchLeagueScoreboard(leagueId) {
  return safeJson(`${ESPN}/${leagueId}/scoreboard`);
}

function parseEvent(ev) {
  const comp = ev?.competitions?.[0];
  if (!comp) return null;
  const state   = comp.status?.type?.state;
  const summary = comp.status?.summary ?? '';
  const detail  = comp.status?.type?.detail ?? '';
  const competitors = (comp.competitors ?? []).map(c => ({
    name:  c.team?.shortDisplayName || c.team?.displayName || '?',
    score: c.score ?? '',
    winner: c.winner === 'true' || c.winner === true,
  }));
  return { id: ev.id, name: ev.shortName || ev.name, state, summary, detail, competitors };
}

export function useCricket() {
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;

    async function load() {
      // Return cached data immediately if fresh
      const cached = readCache();
      if (cached) { setMatches(cached); setLoading(false); return; }

      try {
        // Step 1: discover active league IDs (no 404s — only queries existing endpoints)
        const leagueIds = await getActiveLeagueIds();

        let allEvents = [];

        if (leagueIds.length > 0) {
          // Step 2: fetch scoreboards only for discovered leagues
          const results = await Promise.all(leagueIds.map(fetchLeagueScoreboard));
          allEvents = results.flatMap(json => json?.events ?? []);
        } else {
          // No leagues discovered — try the general scoreboard as last resort
          const general = await safeJson(`${ESPN}/scoreboard`);
          allEvents = general?.events ?? [];
        }

        const parsed = allEvents.map(parseEvent).filter(Boolean);
        const live_   = parsed.filter(m => m.state === 'in');
        const pre     = parsed.filter(m => m.state === 'pre');
        const post    = parsed.filter(m => m.state === 'post');
        const ordered = [...live_, ...pre, ...post].slice(0, 5);

        writeCache(ordered);
        if (live) { setMatches(ordered); setLoading(false); }
      } catch {
        if (live) { setMatches([]); setLoading(false); }
      }
    }

    load();
    const timer = setInterval(() => {
      sessionStorage.removeItem(CACHE_KEY); // clear cache so next load fetches fresh
      load();
    }, CACHE_TTL);

    return () => { live = false; clearInterval(timer); };
  }, []);

  const liveMatches     = (matches ?? []).filter(m => m.state === 'in');
  const upcomingMatches = (matches ?? []).filter(m => m.state === 'pre');

  return { liveMatches, upcomingMatches, allMatches: matches ?? [], loading };
}
