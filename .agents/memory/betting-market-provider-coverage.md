---
name: Betting market provider coverage
description: Rules for expanding match markets without inventing prices or over-requesting unsupported odds.
---

Only display actual bookmaker-backed outcomes. ESPN match summaries often provide the core result, spread, and total markets rather than a complete bookmaker board; specialty-market coverage varies by provider and league.

**Why:** An unsupported optional market key can fail a provider request, and inferring prices from a page label would create misleading odds. Broad event-odds requests also consume quota per market.

**How to apply:** Keep core markets independent from specialty-market requests, use documented keys supported for the event's sport, preserve outcome descriptions and line points, and do not promise markets that the provider does not return.
