---
name: SEO canonical & robots fixes
description: Root causes of Google Search Console issues (1,211 duplicates, 56×403, etc.) and how they were fixed.
---

## Robots source and rendering assets
**Rule:** Keep one robots source in production. When the public robots file is authoritative, do not also define an App Router robots route. Point its sitemap entries at the verified primary host and do not block `/_next/` assets from search crawlers.

**Why:** A public robots file and an App Router robots route conflict in Next.js. Blocking `/_next/` can prevent Google from loading the JavaScript and CSS needed to render client-heavy match and news pages.

**How to apply:** Check the live robots response and the app's route files together. Keep private/admin/API paths blocked, but allow public assets required for rendering.

## Match canonical was wrong
`app/(main)/matches/[id]/layout.tsx` used `encodeURIComponent(id)` for the canonical URL, where `id` is whatever URL slug the visitor accessed. Both the legacy slug (`ken1-401867459`) and canonical slug (`gor-mahia-vs-nairobi-united-401867459`) claimed different canonicals → Google saw them as 1,211 duplicate pages.

**Fix:**
1. Import `matchToSlug` and use it to always build the canonical from team names + numeric ID.
2. In the Layout server component, redirect any URL that doesn't contain `-vs-` (legacy format) to the canonical slug.

**How to apply:** Always call `matchToSlug(id, home, away)` — never `encodeURIComponent(id)` — for match page canonicals.

## matchToSlug must handle URL slug inputs
`matchToSlug` only matched internal ID formats (espn_, fd_, camel1_) using underscores. URL slugs like `ken1-401867459` and `gor-mahia-vs-nairobi-united-401867459` fell through to the `encodeURIComponent` fallback, producing wrong canonicals.

**Fix:** Added a hyphen-based numeric suffix pattern before the final fallback:
```ts
const hyphenNumeric = matchId.match(/-(\d{4,})$/)
if (hyphenNumeric) return `${homeSlug}-vs-${awaySlug}-${hyphenNumeric[1]}`
```

## Canonical host
**Rule:** Verify the live production redirect before choosing the canonical host. Production currently redirects `betcheza.co.ke` to `www.betcheza.co.ke`; canonical tags, structured-data URLs, sitemaps, and robots sitemap declarations should all use the final www host.

**Why:** The previous code emitted non-www canonicals while the sitemap listed www URLs and the live server redirected non-www to www. That sends conflicting host signals and makes Google reconcile a canonical that redirects.

**How to apply:** Recheck the live redirect when deployment infrastructure changes. Nested page metadata can override the root canonical, so audit route-level canonicals as well as root metadata.
