---
name: isLikelyEnded logic in match-card-new.tsx
description: Time-based heuristic for showing Ended/FT on matches whose API status is stale
---

## Rule
`isLikelyEnded` must NOT include a `!(match.minute > 0)` guard.

The pure time-based check is the only reliable signal:
```js
const isLikelyEnded = !isLive && !isFinished && new Date(match.kickoffTime).getTime() + durationMs < Date.now();
```

**Why:** ESPN sometimes keeps `status='scheduled'` with `minute > 0` for matches that have genuinely finished (status update lag). The old guard `!(minute > 0)` was added to avoid showing "Ended" for a live match that ESPN hadn't updated yet — but it also blocked "Ended" for truly finished matches. The time-based check alone is sufficient: if kickoffTime + expected duration has passed, the match is over regardless of minute.

**How to apply:** Apply in `components/matches/match-card-new.tsx`. Sport durations in `SPORT_DURATION_MS` (soccer=115min, rugby=115min, basketball=150min, etc.). Default=130min for unknown sports.
