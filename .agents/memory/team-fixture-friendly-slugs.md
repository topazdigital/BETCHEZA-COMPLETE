---
name: Team fixture friendly ESPN slugs
description: Correct ESPN league slugs for club and international friendlies on team pages.
---

## Rule
ESPN's scoreboard endpoint for pre-season/friendly matches uses:
- `club.friendly` (leagueId 280) — for club vs club pre-season tours
- `fifa.friendly` (leagueId 106) — for international friendlies

**NOT** `friendly.club` or `friendly.intl` — those return 404.

**Why:** The SOCCER_CONTINENTAL_LEAGUES array in `app/api/teams/[id]/route.ts` originally had wrong reversed slugs (`friendly.club`, `friendly.intl`), causing zero pre-season fixtures to load for any team.

**How to apply:** Any time club friendly or international friendly fixtures are missing from team pages, check SOCCER_CONTINENTAL_LEAGUES uses `club.friendly` and `fifa.friendly`.
