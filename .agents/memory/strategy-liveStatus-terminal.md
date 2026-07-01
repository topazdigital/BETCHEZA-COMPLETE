---
name: Strategy pick liveStatus taxonomy
description: Which match status codes are in-progress (live) vs terminal (finished) for strategy pick settlement in live-scores cron.
---

In `app/api/cron/live-scores/route.ts → updateStrategyPickLiveScores()`, the `liveStatus` field controls whether a pick is settled with the current score.

**IN-PROGRESS (live) — do NOT settle yet:**
`live`, `inprogress`, `in_progress`, `halftime`, `ht`, `extra_time`, `et`, `penalties`, `break`, `pause`

**TERMINAL (finished) — settle with final score:**
Everything else, including: `finished`, `ft`, `full-time`, `aet` (after extra time), `pen` (won on penalties), `walkover`, `awarded`

**Why:** `aet` and `pen` are result codes meaning the match is over. `extra_time` and `penalties` (no `aet`/`pen` prefix) mean the match is *currently in* ET/shootout — still live. Conflating them caused premature settlement at halftime and prevented final settlement after ET/shootout.

**How to apply:** Any change to status taxonomy here must also be cross-checked against the live→finished transition logic (around lines 114–121 in the same file) which uses a separate FINISHED set — keep them consistent.
