---
name: SEO canonical & robots fixes
description: Root causes of Google Search Console issues (1,211 duplicates, 56×403, etc.) and how they were fixed.
---

## robots.txt was broken
The original `public/robots.txt` had `Disallow` rules in an orphaned block (blank line separated them from all `User-agent:` groups). Per robots.txt spec, directives without an owning user-agent are ignored. Result: Googlebot was crawling /api/, /admin/, /dashboard/ freely → 56 × 403 errors in Search Console.

**Fix:** Each `User-agent:` group now contains its own `Disallow` lines. Only one `Sitemap:` entry (non-www).

**Why:** In robots.txt, a blank line ends a group. Rules after a blank line with no new `User-agent:` header are invalid/ignored.

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

## Default canonical in root layout
Added `alternates: { canonical: siteUrl + pathnameSansQuery }` to the root `generateMetadata` as a fallback for pages without their own canonical. Nested layout canonicals still override this per Next.js metadata merging rules.

## www redirect
Added `next.config.mjs` redirect: `www.betcheza.co.ke/:path*` → `betcheza.co.ke/:path*` (permanent). Only fires on the production host, safe for Replit dev.
