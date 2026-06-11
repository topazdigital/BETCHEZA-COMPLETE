---
name: Tipster ranking & stats integrity
description: Rules for sorting tipsters, preventing fake monthly stats, and fixing competition history loading
---

## Tipster ranking — 0-tip guard
In `app/api/tipsters/route.ts` `sortFn`, an `aNoTips/bNoTips` guard runs before the main sort switch. Any tipster with `totalTips === 0` is demoted to the bottom within its real/fake group. This prevents a brand-new tipster with 0 tips from ranking #1 purely on a fabricated win rate.

**Why:** Real (non-fake) tipsters with 0 tips had inflated stats (default 70% win rate from DB seed) that placed them above active tipsters.

**How to apply:** Keep the no-tips guard before the `switch (sortBy)` block. The guard is group-aware — it runs after the real/fake split, so fake tipsters still rank below real ones even if fake tipsters have tips.

## generateMonthlyStats — no fabrication for real 0-tip tipsters
`generateMonthlyStats` in `app/api/tipsters/[id]/route.ts` returns `[]` early when `!tipster.isFake && tipster.totalTips === 0`. This prevents the monthly performance chart from showing invented data for a real tipster who has never posted.

**Why:** Fake tipsters are expected to have synthetic stats, but real tipsters must show only what they've actually done.

## Competition history — single-query fix
`app/api/tipsters/[id]/competitions/route.ts` previously called `getJoinedUserIds(comp.id)` in a loop (N+1 DB queries). Now it runs one query upfront:
```sql
SELECT competition_id FROM competition_entries WHERE user_id = ?
```
and builds a `Set<number>` of joined comp IDs, then checks membership in the loop. Falls back to `{ competitions: [] }` on DB error — no more infinite spinner.

## Competition history UI — error state
SWR call for `/api/tipsters/[id]/competitions` now destructures `error: compsError`. The JSX renders an error state (`compsError ? <empty state>`) before the loading spinner check, so a failed or timed-out API call shows "No competition history yet." instead of spinning forever.
