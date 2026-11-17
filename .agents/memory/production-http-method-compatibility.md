---
name: Apache PATCH method restriction
description: Production Apache rejects PATCH before Next.js; browser updates need POST-compatible handlers.
---

The production DirectAdmin/Apache/PM2 deployment responds to PATCH requests with HTTP 406 before Next.js. It also rejects POST requests that carry `X-HTTP-Method-Override: PATCH`, while plain POST reaches the app. Browser updates therefore need POST-compatible route handlers without that header.

**Why:** Apache's security layer filters PATCH and the method-override header, so otherwise-correct Next.js routes are never invoked.

**How to apply:** Audit browser PATCH calls, add plain POST aliases that reuse the authenticated PATCH handler, and use a route-specific query parameter on endpoints that already accept POST for creation. Preserve existing POST behavior and verify authenticated flows locally; local success does not confirm VPS behavior until the manual production deploy is applied.
