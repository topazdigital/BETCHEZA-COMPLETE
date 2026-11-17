---
name: Apache PATCH method restriction
description: Production Apache rejects PATCH before Next.js; browser updates need POST-compatible handlers.
---

The production DirectAdmin/Apache/PM2 deployment responds to API PATCH requests with HTTP 406 before Next.js, while POST reaches the app. Browser updates therefore need POST-compatible route handlers. Use `X-HTTP-Method-Override: PATCH` to distinguish updates when a route already uses POST for creation, and keep the original PATCH handler for environments that permit it.

**Why:** The production web-server layer filters PATCH, so otherwise-correct Next.js routes are never invoked.

**How to apply:** Audit browser PATCH calls, add POST aliases that reuse the authenticated PATCH handler, preserve existing POST behavior, and verify authenticated flows locally. Local success does not confirm VPS behavior until the manual production deploy is applied.
