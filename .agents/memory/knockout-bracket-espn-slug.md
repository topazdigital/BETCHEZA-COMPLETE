---
name: Knockout bracket ESPN season slug
description: FIFA World Cup and FIFA tournaments don't use notes.headline for round labels — they use ev.season.slug instead. The bracket route must check both.
---

## Rule
`app/api/leagues/[id]/bracket/route.ts` — `parseRound()` must accept an optional `seasonSlug` parameter and fall back to it when `competitions[0].notes[0].headline` is absent.

## Why
ESPN delivers round information two ways:
- **UEFA CL / FA Cup / Copa**: `competitions[0].notes[0].headline` = `"1st Leg"`, `"Round of 16"`, etc.
- **FIFA World Cup 2026 + other FIFA tournaments**: `notes = []` (empty), round in `ev.season.slug` = `"round-of-32"`, `"quarterfinals"`, `"semifinals"`, `"final"`, `"3rd-place-match"`.

Before the fix, FIFA knockouts always returned `isKnockout: false` → "Knockout stage not yet available" message.

## How to apply
In `parseRound(headline, seasonSlug?)`:
1. Try headline regex first (preserves leg detection for UEFA).
2. Fall back to exact slug list match, then normalized (no-separator) match, then slug-as-text against regex.

`ROUND_ORDER` entries carry a `slugs: string[]` array. Verified ESPN slugs for WC2026:
- `round-of-32`, `round-of-16`, `quarterfinals`, `semifinals`, `3rd-place-match`, `final`

Also pass `ev.season?.slug` to the inner `parseRound` call inside the leg loop.

`ESPNEvent.season.slug` must be typed as `string | undefined` (not nested in `type`).
