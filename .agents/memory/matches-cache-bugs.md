---
name: Matches cache — bugs, root causes, and fixes
description: Root causes of "0 matches" + slow loading on production; all fixes applied
---

## Root causes of persistent "0 matches" on production after deploys

### 1. Cache poisoning guard — FIXED
The guard in `_fetchAllMatches()` (lib/api/unified-sports-api.ts) had a fatal flaw:
```
if (sorted.length >= MIN_MATCHES_TO_PERSIST || previousCount === 0)
```
The `|| previousCount === 0` meant: on cold start, if ESPN returned 0 matches, it wrote
0 to g_allMatchesCache.data, DB cache, AND file cache — poisoning all three stores.
All subsequent requests served 0 matches until ESPN returned good data again.

**Fix:** Removed `|| previousCount === 0`. Never write to cache if sorted.length < 5.
On cold start with bad ESPN response, leave `g_allMatchesCache.ts = 0` (don't update it)
so the next `getAllMatches()` call triggers a retry immediately instead of waiting 90s.

### 1b. Persistent cache reads must use the same floor — FIXED
Write-side protection alone is insufficient: a previously poisoned small file or DB
snapshot can be loaded again after a restart and reintroduce the outage.

**Fix:** Apply the same meaningful-result floor to every DB/file cache read as well as
every write. A partial provider response must be rejected consistently at both sides
of the persistence boundary.

**Why:** ESPN/FotMob/SofaScore can be simultaneously rate-limited or blocked; a
five-match snapshot is not a trustworthy replacement for a multi-sport cache.

### 1c. Total-count checks are not enough — FIXED
A cache can contain hundreds or thousands of future fixtures while omitting most of
today's fixtures. The VPS showed 1,007 cached matches but only 9 for the current EAT
date, all from a no-odds supplementary source.

**Fix:** Cache reads, writes, and deploy preservation now require both a meaningful
total count and a current-day coverage floor. The global soccer fetch also always
requests the single-day ESPN scoreboard independently of the multi-day request.

**Why:** The multi-day/global request can fail or return a future-heavy snapshot while
the single-day endpoint is healthy; preserving the larger snapshot made the homepage
look populated but hid the actual day's fixtures.

### 1d. Cold-start ESPN request storms — FIXED
After the invalid cache was removed, the VPS cold start launched per-league ESPN
requests and global multi-day requests together. The shared circuit opened after five
timeouts, so warmup completed with zero matches even though individual ESPN requests
could work.

**Fix:** All ESPN requests share a six-request queue; current-day soccer is fetched
directly outside that queue, and the per-league launch cap is six. The soccer global
feed resolves before slow secondary-sport scans, while wider windows remain best-effort.

**Why:** Limiting only the per-league promise pool did not limit global `/all/scoreboard`
and single-day requests, so the combined refresh could still overwhelm the VPS/provider.

### 1e. Global ESPN payload shape — FIXED
ESPN's global scoreboard can include placeholder or broadcast-only competition records
without a `competitors` array. Calling `.find()` on that field rejected the entire
global sport transformation, turning a valid 91-event response into zero matches.

**Fix:** Skip global competition records with fewer than two competitors; never reject the
whole sport feed because one record is incomplete.

**Why:** Provider payloads are not uniform across leagues and event states. A malformed
or non-match record must be isolated so the remaining current-day fixtures survive.

### 2. deploy.sh cleared match_cache on every deploy — FIXED
Step 4e ran `DELETE FROM match_cache WHERE cache_key='all_matches'` on every deploy.
Combined with bug #1, this guaranteed every deploy ended with empty caches:
deploy → clear DB → PM2 restart → ESPN returns 0 → write 0 to DB + file → 0 matches forever.

**Fix:** Replaced step 4e with a no-op comment. Never clear match_cache on deploy.
The app has code-level protection (MIN_MATCHES_TO_PERSIST) and 4-hour stale TTL.

### 3. Warmup returned stale file-cache data — FIXED
The old warmup endpoint called `getAllMatches()` which returned yesterday's file-cache
data immediately (file cache loaded in `_initPromise`, stamped with NOW, served for 90s).
So warmup reported "N matches" but those were yesterday's matches. Users saw "0 Today".

**Fix:** Added `forceRefreshMatches()` export that expires ts=0, triggers fresh ESPN fetch,
and awaits completion. Warmup now always calls forceRefreshMatches() for a live fetch.

### 4. ALLMATCHES_STALE_TTL was only 30 minutes — FIXED
After 30 min with ESPN returning < 5 matches (rate limit / flakiness), users got 0 matches.
**Fix:** Increased to 4 hours.

### 5. Apache proxy timeout too short — FIXED
Cold-start ESPN fetches take 10-30s. Default Apache ProxyTimeout of 60s was marginal.
deploy.sh now writes `ProxyTimeout 120` and `keepalive=On` to the VirtualHost config.

### 6. PM2 post_start warmup was too fast — FIXED
`sleep 8` delay was not enough for Next.js to fully start before warmup curl ran.
Changed to `sleep 15` and increased curl `--max-time` from 90 to 180s.

## Layer 5 (true cold start) behavior
When all caches are empty (rare in production because file cache survives deploys):
`getAllMatches()` now blocks on `g_allMatchesCache.promise` in Layer 5 instead of
returning [] immediately. This is correct: there's no other data to serve.

## File cache survival
`.local/state/matches-cache.json` is gitignored. It survives:
- `git reset --hard origin/main` (gitignored files unaffected)
- `git stash --include-untracked` (only stashes non-ignored untracked files, not ignored)
- PM2 restarts (file on disk)
File cache is only lost if someone manually deletes it or the VPS is wiped.

## Warm performance (after cache populated)
- `/api/matches` responds in 11-60ms (memory cache hit)
- `/api/home` responds in < 100ms
- All match API endpoints < 100ms after first fetch
