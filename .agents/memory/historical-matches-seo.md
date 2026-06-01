---
name: Historical matches & SEO timezone
description: How old/historical match pages load, SEO timezone fix, and league page historical season data.
---

## tryLeagues — no age cutoff, collision guard
**Rule:** `tryLeagues` in `getMatchById` must NOT have a 60-day (or any) age cutoff.  
**Why:** Google indexes old match URLs (e.g. `/matches/real-madrid-vs-barca-731202`) that remain live forever. A cutoff causes "Match not found" for any Google-indexed historical URL.  
**How to apply:** Use the collector pattern — collect ALL results within 10s timeout, then pick the candidate with the most recent kickoff date. This is the collision guard: if two leagues both return a match for the same numeric event ID, the current one wins, but old matches still resolve.

## SEO timezone — Africa/Nairobi
**Rule:** `formatKickoffDate` and JSON-LD `startDate`/`endDate` must use `Africa/Nairobi` (UTC+3).  
**Why:** Without timezone, Google shows UTC dates in search snippets. A match on Jan 1 at 22:00 UTC shows as "Dec 31" in Kenya.  
**How to apply:** In `app/(main)/matches/[id]/layout.tsx`:
- `formatKickoffDate` → `toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' })`
- JSON-LD → `toEatIso(utcString)` shifts +3h and appends `+03:00` suffix

## League page historical season data
**Rule:** When a past season is selected in the league page dropdown, fetch from `/api/leagues/[id]/matches?season=YEAR`.  
**Why:** The normal `useMatches` hook only covers a rolling ±365/+200 day window. Seasons older than ~1 year are outside this window.  
**How to apply:**
- `getHistoricalLeagueMatches(leagueId, seasonYear)` in `unified-sports-api.ts` fetches two half-season ESPN scoreboard date ranges in parallel, produces proper `UnifiedMatch[]`.
- API route at `app/api/leagues/[id]/matches/route.ts` — requires `?season=YEAR`.
- League page uses `effectiveLeagueId` (before `league` is derived from `allMatches`) to avoid circular dependency in the SWR key.
- 24h cache for historical data (seasons don't change).
