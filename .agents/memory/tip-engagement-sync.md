---
name: Tip likes/comments sync
description: setBaselineLikes() was being called but getBaseline() ignored OVERRIDE_BASELINE — causing tips page and match-detail to show different like counts
---

## Rule
`setBaselineLikes(tipId, count)` in `lib/tip-engagement-store.ts` must be called before any `getLikeCount()` call to ensure the seeded `auto_tips.likes` value is used as the baseline instead of the small hash-computed value.

Both the tips feed route (`/api/tips/feed`) and the match detail route (`/api/matches/[id]/tips`) must call `setBaselineLikes()` for every auto-tip before returning data, otherwise the two pages will show different counts.

## Why
`getBaseline()` used `FAKE_LIKE_SEED` (hash-based, returns 3–30) and completely ignored `OVERRIDE_BASELINE` (where `setBaselineLikes()` stored values). The match detail called `setBaselineLikes(t.id, t.likes)` but `getBaseline()` never read from `OVERRIDE_BASELINE`, so `getLikeCount()` still returned the small hash-based number (~10) instead of the seeded value (35–70).

## Fix applied
1. `getBaseline()` now checks `OVERRIDE_BASELINE[tipId]` first before falling back to hash.
2. `setBaselineLikes()` also writes to `FAKE_LIKE_SEED[tipId]` as a belt-and-suspenders guard.
3. Tips feed route now calls `setBaselineLikes(tip.id, tip.likes)` for all filtered tips.

## Comment double-count
Match detail used `commentCount + (tip.comments || 0)`, which doubled when in-memory seeded count equals `auto_tips.comments`. Fixed to `Math.max(commentCount, tip.comments || 0)`. Same formula now used in tips feed route.
