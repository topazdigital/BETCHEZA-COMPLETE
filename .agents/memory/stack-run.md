---
name: Stack & run config
description: Tech stack, build steps, and how to restart the app on Replit
---

- Stack: Next.js 16.2.6 (App Router), TypeScript, Tailwind CSS v4, MySQL2, custom JWT auth
- Run workflow: "Start application" → `next start -p 5000 -H 0.0.0.0`
- After any code change: `rm -rf .next && npm run build`, then restart workflow
- Build uses `NODE_OPTIONS="--max-old-space-size=4096"` to avoid OOM
- 96 routes build cleanly; 401s in browser console are expected for unauthenticated API calls

**Why:** next start serves the production build from .next; stale builds silently serve old code.
