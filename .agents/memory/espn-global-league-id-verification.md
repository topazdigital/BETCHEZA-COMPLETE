---
name: ESPN global soccer league IDs — verification required
description: The 8297–8347 range in KNOWN_GLOBAL_LEAGUES was added by assumed sequential numbering, not verified. Known wrong entries documented here.
---

## Rule
Never assume ESPN global numeric league IDs follow a sequential pattern by competition type. Always verify against live ESPN API data (event UID format: `s:600~l:<id>~e:<eventId>`).

## Known verified mappings
- `8301` = **NWSL** (US women's soccer) — NOT Copa del Rey. Confirmed from live scoreboard showing Boston Legacy FC, Washington Spirit, Utah Royals etc.
- `16980` = NWSL (alternate ESPN numeric ID)
- Copa del Rey is fetched via `esp.copa_del_rey` LEAGUE_CONFIGS slug and does NOT appear on the global scoreboard with ID 8301.

## Risk
The entire 8297–8347 "cup IDs" block was hand-guessed. 8302–8340 entries (Coppa Italia, DFB Pokal, etc.) are unverified. If wrong league labels appear, check this range first.

**Why:** ESPN reuses numeric IDs across regions/competitions — sequential assumptions fail.

**How to apply:** When a league label mismatch is reported, grep KNOWN_GLOBAL_LEAGUES for the ID shown in the match UID, then verify against ESPN API before trusting the existing mapping.
