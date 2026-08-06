---
name: News crawl discovery
description: How ESPN-sourced news articles become crawlable without manual URL submissions.
---

Article URLs are query-string reader pages, so crawl discovery must be driven by a persisted article index rather than fabricated match-page entries.

**Why:** Google News sitemap entries must point to the actual article URL and only cover recent stories; older articles still need regular sitemap coverage.

**How to apply:** When changing news ingestion or article URL construction, update the shared article index and verify both `/news-sitemap.xml` and `/sitemap.xml` contain self-canonical Betcheza article URLs.