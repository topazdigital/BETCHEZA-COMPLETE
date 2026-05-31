---
name: Strategy pick settlement
description: How 3 Daily Odds Strategy picks get marked win/loss, including retroactive settlement
---

## Settlement paths

1. **Live cron** (`app/api/cron/live-scores/route.ts`, every ~5 min):
   - `updateStrategyPickLiveScores(liveMatches)` — settles TODAY's picks in real-time using live match scores (mid-game mathematical certainty: BTTS Yes once 1-1, Under blown once 3+, etc.)
   - `settleRecentPendingStrategyPicks()` — new function added; fetches last 3 days' picks, then uses `getAllMatches()` cache to settle any pending picks whose kickoff was >2h ago. Handles "game finished but no longer live" gap.

2. **Admin resettle** (`app/api/admin/strategy/resettle`, POST):
   - Pass 1: re-runs `checkPickResult` on all picks with stored `actualScore` (corrects wrong results)
   - Pass 2: fetches `getAllMatches()`, fuzzy-matches team names, settles pending picks >2h past kickoff
   - Updates both DB (`daily_strategy` table) and file store (`strategy-week-*`)

3. **Admin UI button** on `/strategy` page (admin-only):
   - Visible only when `user.role === 'admin'`
   - Calls POST `/api/admin/strategy/resettle`, then SWR mutate to refresh display

## Key DB schema
- Table: `daily_strategy` — columns: `id, date, picks (JSON), result, status, settled_at`
- Pick JSON fields: `result` (pending/win/loss), `actualScore` (e.g. "2-1"), `liveScore`, `liveStatus`

**Why:** The live-scores cron only processes currently-live matches; once a match finishes it leaves the live list. Added `settleRecentPendingStrategyPicks` to bridge this gap automatically.
