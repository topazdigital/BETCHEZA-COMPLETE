---
name: ESPN league name persistence
description: Persistent disk cache for ESPN league display names to eliminate "League XXXXX" fallback labels
---

# ESPN league name persistence

## The rule
`persistedESPNLeagueNames` (Map) + `.local/data/espn-league-names-cache.json` accumulate ESPN-provided `displayName` values for every league numeric ID ever seen. `resolveGlobalLeagueInfo` checks this as step 4 before falling back to `"League XXXXX"`.

**Why:** ESPN's global scoreboard only reliably includes `leagues[].displayName` for major leagues. Minor/regional leagues appear in events but not in the top-level `leagues[]` array, or ESPN omits names for them. Without persistence, names vanish on restart and leagues that ESPN names inconsistently keep showing "League XXXXX".

**How to apply:**
- Any new path that fetches from ESPN's global scoreboard (`fetchESPNGlobalSport`) should merge names into `persistedESPNLeagueNames` and call `scheduleESPNNamesSave()`.
- If a league still shows "League XXXXX" after several cron cycles, ESPN truly doesn't return its name — add it manually to `KNOWN_GLOBAL_LEAGUES`.
- The JSON file grows unboundedly but is small (one line per league; ESPN covers ~2000 leagues globally).
