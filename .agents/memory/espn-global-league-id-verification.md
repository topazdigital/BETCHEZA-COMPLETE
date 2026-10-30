---
name: ESPN global soccer league IDs — verification required
description: The 8297–8347 range in KNOWN_GLOBAL_LEAGUES was added by assumed sequential numbering, not verified. Known wrong entries documented here.
---

## Rule
Never assume ESPN global numeric league IDs follow a sequential pattern by competition type. Always verify against live ESPN API data (event UID format: `s:600~l:<id>~e:<eventId>`).

## Known verified mappings
- `700` = **Premier League** (global scoreboard ID); global IDs must be translated through the numeric-to-internal league map before resolving ESPN request config.
- `8301` = **NWSL** (US women's soccer) — NOT Copa del Rey. Confirmed from live scoreboard showing Boston Legacy FC, Washington Spirit, Utah Royals etc.
- `16980` = NWSL (alternate ESPN numeric ID)
- `20296` = **UEFA Conference League** on the 2026/27 scoreboard; confirmed by ESPN's league name, `uefa.europa.conf` slug, and matching event teams.
- Copa del Rey is fetched via `esp.copa_del_rey` LEAGUE_CONFIGS slug and does NOT appear on the global scoreboard with ID 8301.

## Risk
The entire 8297–8347 "cup IDs" block was hand-guessed. 8302–8340 entries (Coppa Italia, DFB Pokal, etc.) are unverified. If wrong league labels appear, check this range first.

**Why:** ESPN reuses numeric IDs across regions/competitions — sequential assumptions fail.

**How to apply:** Prefer current ESPN league metadata and event notes. For global match details, use a matching ESPN summary only after checking the event ID and both teams. If provider data cannot confirm a competition, display “Competition details unavailable”; never infer a league from the teams' country.
