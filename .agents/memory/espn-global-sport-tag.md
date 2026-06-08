---
name: ESPN global-sport match ID & sportTag
description: Global-sport matches (tennis, basketball, etc.) use espn_global<leagueId>_<eventId> IDs, not espn_atp_<eventId>. getEspnLeagueConfigForId must handle this to avoid teamSportTag=null and cross-sport team URL collisions.
---

## The rule
`fetchESPNGlobalSport` builds match IDs as `espn_global<leagueId>_<eventId>` (e.g. `espn_global140_401235678` for ATP tennis). The `ESPN_LEAGUE_BY_SLUG` map keyed on `atp`/`wta`/`nba` etc. does NOT match these IDs.

**Why:** `getEspnLeagueConfigForId` extracts the segment between `espn_` and the numeric suffix and looks it up in `ESPN_LEAGUE_BY_SLUG`. For a global-sport match, that segment is `global140`, which maps to nothing → returns `null` → `teamSportTag = null` → team URL built without sport tag → wrong team resolved (ESPN IDs collide across sports).

**How to apply:** `getEspnLeagueConfigForId` now has a secondary `ESPN_LEAGUE_BY_ID` map (keyed on numeric `leagueId`). When the extracted slug matches `/^global(\d+)$/`, parse the number and look it up in `ESPN_LEAGUE_BY_ID` instead.

The `LEAGUE_TO_SPORT_TAG` in the match-details route uses bare league keys (`atp`, `wta`, `nhl`, etc.) which match `cfg.league` values from ESPN_LEAGUES and work correctly once `cfg` is non-null.
