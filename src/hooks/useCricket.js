/**
 * Live cricket scores — currently disabled.
 *
 * ESPN's cricket API (site.api.espn.com) blocks browser requests with
 * a CORS error from production domains. A server-side proxy (api/cricket.js
 * Vercel function) is needed before this can work in production.
 *
 * Returning empty state keeps the CricketWidget rendering nothing silently
 * (it already returns null when liveMatches and upcomingMatches are both empty).
 * Zero console errors.
 *
 * TODO: Implement api/cricket.js as a Vercel serverless function that fetches
 * from ESPN server-side, then re-enable fetching here by calling /api/cricket.
 */

export function useCricket() {
  return { liveMatches: [], upcomingMatches: [], allMatches: [], loading: false };
}
