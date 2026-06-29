---
name: CF Worker proxy — API routing rules
description: Which APIs must use proxyFetch vs directFetch, and why; root cause of 157k daily quota overrun
---

## Rule
Only APIs that actively block Replit/cloud IPs must use `proxyFetch`. Everything else MUST use `directFetch`.

## proxyFetch (CF Worker required — blocks cloud IPs)
- **SofaScore** (`lib/api/sofascore.ts`, `lib/api/sofascore-odds.ts`) — aggressively blocks cloud IPs, circuit-breaker after 5× 403s
- **FotMob** (`lib/api/fotmob.ts`) — returns 404s from cloud IPs
- **Pinnacle** (`lib/api/pinnacle.ts`) — guest API blocks Replit IPs; all calls now go through proxyFetch

## directFetch (no proxy — these work fine from Replit)
- **ESPN** (`lib/api/unified-sports-api.ts`) — public API, no IP block; use `directFetch`
- **api-sports** (`lib/api/api-sports.ts`) — paid API with key header, no IP block; use `directFetch`

## What NOT to do
Never import `proxyFetch` into `unified-sports-api.ts` or `api-sports.ts`. ESPN is the highest-volume caller (~400+ cricket serial IDs + multiple sport leagues × cron every 5 min). Routing ESPN through the proxy burned 157k/100k daily CF Worker quota in a single day.

**Why:** CF Worker free tier = 100k req/day. ESPN alone can generate 5,000–20,000 requests/day due to multi-league fetches + cricket ID scanning + 5-min cron cadence. SofaScore + FotMob + Pinnacle together use ~1,000–5,000/day — comfortably under 100k.

## Quota reset
CF Worker daily limit resets at 00:00 UTC. If overrun, all proxyFetch calls fail until reset. Monitor at dash.cloudflare.com → Workers & Pages → betcheza-proxy.
