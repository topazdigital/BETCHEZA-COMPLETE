---
name: Challenges system architecture
description: Real-match tipster challenge system — key patterns and gotchas
---

## Key architecture decisions

### Client-safe pick options
`pickOptionsForSport()` and `evaluatePick()` live in `lib/challenge-picks.ts` (no server imports).
`lib/challenges-store.ts` re-exports them from there. Client pages import from `lib/challenge-picks.ts` directly, NOT from `lib/challenges-store.ts` — the store imports mysql2/fs which breaks client bundles.

**Why:** challenges/page.tsx is `'use client'` but needs pick options. Importing from challenges-store pulled in mysql2/fs which fail in browser bundling.

### isFakeUserId location
Lives in `lib/fake-tipsters.ts` (not challenges-store). All fake tipster IDs are >= 1000.

### Background seeding (non-blocking)
`GET /api/challenges` seeds fake challenges from real upcoming matches using a module-level `_seedDone` flag and a fire-and-forget async IIFE. Never `await` the seed in the GET handler — getAllMatches() takes 2-5s and would block every page load.

**Why:** Blocking the GET on seedFakeChallengesFromMatches caused the page spinner to never resolve.

### File fallback
DB-less: challenges stored in `.local/state/challenges.json` via `loadFile()`/`saveFile()` in challenges-store.ts. In-memory global `gf.__challengesFile` acts as write-through cache.

### Settlement
Auto-settle via `GET /api/challenges/settle` (cron) — calls `settlePendingChallenges()` which calls `getMatchById()` for each active challenge. Real money moves only for non-fake users (`!isFakeUserId()`). Fake challenge settlement is display-only.

### Pick evaluation rule
Both-right AND both-wrong = draw (full refund, no platform fee). Only one correct = winner gets 90% of pot.
