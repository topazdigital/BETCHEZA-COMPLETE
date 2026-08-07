---
name: Daily strategy fixture selection
description: Rules for choosing daily strategy matches without repeating stale or early fixtures
---

Strategy picks must use only future scheduled football fixtures whose kickoff falls on the requested East Africa calendar date. The candidate pool should be distributed across morning, afternoon, and evening/night and regeneration should exclude the currently displayed fixtures when alternatives exist.

**Why:** Provider feeds are not reliably ordered and can retain stale events. Selecting the first same-day records caused regeneration to repeat finished matches and over-prefer early-morning kickoffs.

**How to apply:** Keep manual regeneration and scheduled daily generation on the shared selector. Never fall back to another calendar date to fill a strategy pool.