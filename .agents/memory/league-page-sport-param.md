---
name: League page sport param & slug resolution
description: How unknown league pages get the right sport-specific match data, and how all league links must be generated.
---

## Rule
League links for **unknown leagues** (not in ALL_LEAGUES) must always include `?sport=<sport.slug>` in the URL.

**Why:** `useMatches(undefined)` on the league page creates a different SWR cache key from `useMatches({ sportId: N })` used on sport-filtered pages. Without the sport hint, the league page fetches all-sports data which may not include tomorrow's tennis/cricket/etc matches.

## How to apply
- `_matches-client.tsx` — when `_knownL` is null, generate `/leagues/${leagueSlug}?sport=${sport.slug}`
- `matches/[id]/page.tsx` — when league is unknown, use `/leagues/${nameSlug}?sport=${match.sport?.slug}`
- `leagues/[slug]/page.tsx` — reads `searchParams.get('sport')`, finds sport from `ALL_SPORTS`, passes `{ sportId }` to `useMatches` for unknown leagues

## ESPN numeric ID slugs
URLs like `/leagues/espn-900` are raw ESPN IDs. League page extracts the numeric part via regex `/^(?:espn-)?(\d{2,})$/` and calls `useMatches({ leagueId: rawEspnLeagueId })` directly.

## Slug generation (always name-based for unknowns)
All league link generators must use this priority:
1. `ALL_LEAGUES.find(l => l.id === league.id)?.slug` (known league)
2. `resolveLeagueSlug(league.slug)` (alias table)
3. `slugify(league.name)` (name-based, ALWAYS for unknowns)

Never use raw `match.league.slug` directly — it may be an ESPN internal ID like `espn_900`.

## Status filter context-awareness
The status filter dropdown in `_matches-client.tsx` is a `useMemo` computed from `dateTab` + `calendarDate`:
- Today tab: "All (Live & Today)", "Live Now", "Today Scheduled"
- Upcoming tab: "All Upcoming", "Show Live Too"
- Calendar + future date: "Scheduled Only" (auto-selected via useEffect)
- Calendar + past date: "All Results" (auto-selected via useEffect)
