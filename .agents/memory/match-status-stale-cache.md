---
name: Match status stale cache and status inference architecture
description: How match statuses go stale and the multi-layer fix applied
---

## Rule
Three layers ensure matches never show stale 'scheduled' status for hours:

**Layer 1 — Server-side time inference (app/api/matches/route.ts `getProcessedMatches`)**
After mapping matches, apply time-based status override for stale 'scheduled' matches:
- If kickoffMs > now: leave as 'scheduled' (hasn't started yet)
- If ageMs >= durationMs: promote to 'finished' (hides odds, shows FT badge, score shown when ESPN catches up)
- Do NOT promote to 'live' (risky — pollutes Live page with delayed/postponed matches)

**Layer 2 — Cache TTLs**
- `ALLMATCHES_STALE_TTL = 20min` (was 4h) — cap stale ESPN data at 20min, not 4 hours
- `ROUTE_CACHE_TTL = 30s` (was 90s) — faster propagation of updates

**Layer 3 — Route cache version invalidation**
`matchesCacheVersion` (exported from unified-sports-api.ts) is incremented whenever:
- `patchLiveScoresInMainCache()` detects a changed match
- `_fetchAllMatches()` writes new data to g_allMatchesCache

Route cache checks `g_routeCache.version === matchesCacheVersion` and bypasses TTL when version changes.

**Why:** ESPN circuit breaker (threshold=5, backoff=30s) can trip and cause background refreshes to fail. Without the server-side inference, matches stay 'scheduled' until ESPN recovers. The time-based inference is a safety net that ensures the UI always reflects reality regardless of ESPN availability.

**How to apply:** Whenever editing the matches cache TTL or stale-data handling, keep ALLMATCHES_STALE_TTL ≤ 20min and ensure `matchesCacheVersion` is bumped on every cache write.
