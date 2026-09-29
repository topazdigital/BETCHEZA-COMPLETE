---
name: ESPN request identity
description: ESPN's Akamai edge can reject the default Node request identity while accepting an explicit curl-compatible user agent.
---

Use an explicit `User-Agent: curl/8.0` together with `Accept: application/json` for server-side ESPN requests.

**Why:** In this environment, the same ESPN scoreboard URL returned 403 for default, blank, and browser-style user agents but 200 for the curl-compatible identity. Without it, the app fell back to a sparse non-odds feed.

**How to apply:** Keep the header on every ESPN scoreboard and summary request, including global, single-day, tennis, cricket, and league-specific fetches. Do not route ESPN through the Cloudflare proxy unless the provider-routing policy changes.