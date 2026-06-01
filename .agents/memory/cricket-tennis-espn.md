---
name: Cricket & Tennis ESPN fetch quirks
description: How ESPN returns cricket and tennis data, and why the match cache can serve stale 0-count results after restarts
---

## Cricket

ESPN has no `/cricket/all/scoreboard` endpoint — it returns 404.
Must fetch individual series IDs (sequential integers, e.g. 8634, 8658, 8738).
IDs are assigned as new series are created; scan a wide range including known-active ones.
As of Jun 2026, active IDs include 8634, 8658, 8738. Nearby IDs (±5) are also scanned as a buffer.
Cricket event UIDs have no `l:` fragment (format: `s:200~e:1528541`), so league ID must come from `ev.season.type` or be annotated at fetch time via `Object.assign(ev, { _cricketLeagueId: lid, _cricketLeagueName: seriesName })`.
The ESPN scoreboard response's top-level `leagues[0].name` contains the friendly series name (e.g. "Ireland Tri-Nation Women's T20 Series").
Date window: ±30 days (cricket series span multiple weeks; a tighter window misses matches just outside it).

**Why:** ESPN /cricket/all/ returns 404; series IDs rotate as new bilateral series are created; event UIDs lack league info so it must be annotated at fetch time.

**How to apply:** When cricket returns 0, first test a few known IDs directly (`/cricket/8634/scoreboard`), then verify the date window covers the event dates. If IDs are stale, scan 8600–8800+ range in batches.

## Tennis

ESPN /tennis/all/scoreboard is often empty. Fall back to fetching `/tennis/atp/scoreboard` and `/tennis/wta/scoreboard` and merging.
Tennis matches are nested under `event.groupings[].competitions` not `event.competitions`.
Competitor UIDs contain athlete IDs: `s:850~l:851~a:4691` — extract with `/a:(\d+)/` for ESPN CDN headshots.
Headshot URL: `https://a.espncdn.com/i/headshots/tennis/players/full/{athleteId}.png`
League name: for generic names like "League 851", override with `eventName — groupingName` (e.g. "Roland Garros — Women's Singles").

## isStaleLive false-positive: "appear then disappear" bug

`FINAL_PERIOD_PATTERNS` in `app/api/matches/route.ts` originally included `\bend\b` and `\bover\b`.
- `\bend\b` matches ESPN's between-set period string **"End of Set 1"** in tennis → live match wrongly filtered as finished
- `\bover\b` could match cricket over-count strings → same false-positive

Fix: removed `\bend\b`, `\bover\b`, and `\bf\b` (too ambiguous) from the pattern. The safe patterns are:
`/\b(ft|final|full.?time|game.?over|finished)\b/i`

Also bumped `STALE_LIVE_HOURS`: tennis 5→7h (Grand Slams), cricket 10→12h (Test matches).

**Why:** The time-based fallback (tennis 7h, cricket 12h) is the correct safety net for genuinely stale live matches. Period-string detection must only use unambiguous terminal strings.

**How to apply:** If cricket/tennis matches appear then vanish, check `isStaleLive` period-pattern false-positives first.

## Match cache stale-zero problem

`g_allMatchesCache` (in-memory, 30s TTL) + DB `match_cache` table (5-min stale TTL) + `/tmp/betcheza_matches_cache.json` (5-min stale TTL) all persist across app restarts.
If cricket returned 0 and got cached, the next restart will serve that 0 from DB/file cache without re-fetching.

To force a fresh fetch after fixing cricket:
```bash
rm -f /tmp/betcheza_matches_cache.json
node -e "const mysql=require('mysql2/promise');const p=mysql.createPool({...});p.query(\"DELETE FROM match_cache WHERE cache_key='all_matches'\").then(()=>process.exit(0));"
```

The startup IIFE reads DB/file cache first and returns early if valid — so stale empty results persist until the cache TTL expires OR caches are manually cleared.
