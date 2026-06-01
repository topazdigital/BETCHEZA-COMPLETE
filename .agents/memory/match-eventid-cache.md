---
name: Match not found — espn_eventid_ cache skip
description: Why tennis/basketball/non-soccer match detail pages showed "Match not found" even for live matches, and how it was fixed.
---

## The rule
`getMatchById` in `lib/api/unified-sports-api.ts` must scan the in-memory cache for `espn_eventid_` format IDs, not skip it.

## Why it broke
`slugToMatchId` converts `/matches/team-a-vs-team-b-176200` → `espn_eventid_176200`.
The old code had a comment: "skip the cache scan entirely for espn_eventid_ — the suffix scan causes cross-sport collisions". This meant live tennis/basketball/cricket matches in the rolling cache were completely invisible to `getMatchById`, which went straight to a slow staged ESPN API lookup that often timed out.

## How to apply
The cache scan now runs for `espn_eventid_` too — it scans ALL sports by numeric suffix. The collision-prevention logic:
- Exactly 1 hit → return immediately (unambiguous match, covers all live/recent sports)
- 0 hits → fall through to staged ESPN API (match not yet in cache)
- 2+ hits → fall through to staged ESPN API (cross-sport collision, needs disambiguation)

**Why:** The original collision concern (soccer event 401862697 vs football event 401862697) is handled by the "exactly 1 hit" guard. Real collisions are rare; skipping the cache entirely was the wrong trade-off.

## Related bug fixed alongside
`app/api/matches/[id]/details/route.ts` line ~1018: `const sportType` was declared AFTER it was used in `extractEspnOdds()` on line ~1011, causing `ReferenceError: Cannot access 'sportType' before initialization` for all non-soccer match detail requests. Fix: move the `const sportType = cfg?.sportType || 'soccer'` declaration to before the `extractEspnOdds` call.
