---
name: AllSports & The Odds API integration
description: Free sports data sources added to replace blocked SofaScore/FotMob; key limits and which endpoints actually work
---

## AllSports API (allsportsapi.com)
- Key: `ALLSPORTS_API_KEY` env var — 200 req/day free, no card needed
- Base URL: `https://apiv2.allsportsapi.com/{sport}/`
- **Working sports**: `football`, `basketball`, `tennis`, `cricket` (all return 200)
- **Broken/404**: rugby, volleyball, handball, baseball, hockey, AmericanFootball — do NOT call these
- Live football: `?met=Livescore` — returns `event_status` = minute number (e.g. "51"), "Half Time", "Finished"; `event_live:"1"`
- Cache: 30-min file + memory; live scores 2-min TTL
- Wired into: `lib/api/allsports.ts` → `lib/api/unified-sports-api.ts` (supplementarySources) + `app/api/cron/live-scores/route.ts`

## The Odds API (the-odds-api.com)
- Key: `THE_ODDS_API_KEY` env var — 500 req/month free
- **Pre-match odds only** on free tier (in-play/live requires paid plan)
- Already fully coded in `lib/api/unified-sports-api.ts` as `fetchTheOddsAPI()` + `buildRealOddsIndex()`
- Key resolves via `getApiKey('the_odds_api_key')` (admin DB first, then env var)
- Monthly quota exhausted Jun 2026 (500/500 used); resets ~Jul 1
- Quota state tracked in `theOddsApiOutOfCredits` + `theOddsApiMonthlyExhausted` — auto-backoff handles it

## SofaScore circuit-breaker
- After 5 consecutive 403s, flips `_ssBlockedUntil` for 60 min
- All three public functions (`fetchSofaScoreMatches`, `fetchSofaScoreLiveMatches`, `fetchSofaScoreTodaySchedule`) check `ssIsBlocked()` and return `[]` early
- Works on production VPS (not blocked there); only Replit IPs are blocked
- AllSports live football is the replacement source on Replit

**Why:** SofaScore and FotMob permanently block shared cloud IPs (Replit). AllSports works fine from Replit without a proxy.
