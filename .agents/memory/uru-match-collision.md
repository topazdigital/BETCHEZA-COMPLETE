---
name: Uruguayan Primera duplicate & stale match cache
description: ury.1 was a duplicate ESPN league key alongside uru.1, causing 2+ cache hits for the same event ID. ESPN also reuses event IDs across season phases; stale finished matches >7 days old now fall through to staged lookup.
---

## The rule
ESPN_LEAGUES had two entries for Uruguayan Primera: `uru.1` (leagueId 90) and `ury.1` (leagueId 355). Both are the same league under different ESPN codes. Having both meant:
- Matches cached under `espn_uru1_<id>` AND `espn_ury1_<id>`
- `getMatchById` cache scan found 2+ hits for the same numeric event ID → fell to slow staged lookup
- Staged lookup could return stale/wrong match if the 300ms collection window was missed

**Why fixed:** Removed `ury.1` duplicate. Only `uru.1` remains.

**Stale cache guard:** ESPN sometimes reuses event IDs for different matches in the same competition across season phases. If the cache holds a finished match with a given event ID and its kickoff was >7 days ago, `getMatchById` now falls through to the staged lookup instead of returning the stale hit. This ensures today's match beats an April fixture that shares the same ESPN event ID.

**How to apply:** Never add duplicate ESPN league keys for the same real-world competition. When debugging "wrong match loaded", check for duplicate `ESPN_LEAGUES` entries with different `league` keys but the same real league.
