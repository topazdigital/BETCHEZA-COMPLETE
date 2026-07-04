---
name: tryLeagues name-hint validation
description: How wrong-league collision in getMatchById was fixed and what to watch for when editing tryLeagues.
---

# tryLeagues name-hint validation

## The rule
`getMatchById` accepts an optional second parameter `nameHints?: [string, string]` (home, away team name extracted from the URL slug). When present, `tryLeagues` validates each ESPN summary response's team names against these hints before accepting the candidate. Leagues whose team names don't match are silently skipped.

**Why:** ESPN reuses numeric event IDs across sports and seasons. Without validation, the collision guard (which picked by most-recent kickoff date) could select Serie A (or any other league) when the actual match was a Club Friendly — causing wrong league labels, wrong data, and "Match not found" errors.

## How to apply
- `hintMatchesName(teamName, hint)` slugifies both sides the same way as `teamNameToSlug` (`replace(/[^a-z0-9]/g, '')`) so diacritic names like Mönchengladbach / Fenerbahçe normalize identically on both sides.
- The validation uses a majority-word rule: ≥ ceil(words/2) significant words (≥3 chars) must match.
- The details route (`app/api/matches/[id]/details/route.ts`) extracts `teamHints` once at the top of GET and passes them to BOTH getMatchById calls (initial + cold-cache retry).
- `club.friendly` was added to `PRIORITY_LEAGUE_KEYS` so it fetches 60 days back + 30 days forward like other major leagues.

## Key files
- `lib/api/unified-sports-api.ts` — `getMatchById`, `hintMatchesName`, `tryLeagues` (all inside the `espn_eventid_` resolution block)
- `app/api/matches/[id]/details/route.ts` — `teamHints` extraction + both getMatchById calls
