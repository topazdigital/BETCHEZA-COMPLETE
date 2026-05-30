---
name: Match card date labels
description: How date labels are handled across match cards, headers, and home page components
---

## Rule
Never show "Today" as a date label on match cards or match details. "Today" is redundant — just show the time. Show "Tomorrow" in primary/70 colour. Show actual dates (e.g. "Fri, May 30") for all other dates.

**Why:** Users already know they're browsing today's matches. Showing "Today" under every time adds noise. "Yesterday"-style past dates appeared because some API matches slipped through with past kickoff times — showing the real date is better than a relative label.

**How to apply:**
- `components/matches/match-card-new.tsx` — compact variant: `{dateStr !== 'Today' && <div>{dateStr}</div>}`. Full variant FT row: use `formatDate()` directly.
- `components/matches/match-card.tsx` — sidebar card: `if (matchDay === today) return null`
- `components/matches/match-header.tsx` — detail page: use `formatDate()` not `getDayLabel()` (which returns "Today")
- `app/(main)/page.tsx` — "Up Next" mini-grid: `const day = isMatchToday ? null : formattedDate`
- `components/home/favorited-tips-panel.tsx` — marquee card: same null pattern, render as `{time}{day ? ` · ${day}` : ''}`

## Root cause of the isToday bug (now fixed)
`isToday` originally called `formatInTimezone(date, tz, { year, month, day })`. But `formatInTimezone` has default options `{ hour: '2-digit', minute: '2-digit' }` which the spread does NOT remove — so the final format included time. Two dates on the same day at different times produced different strings and never compared equal. `isToday` always returned `false`, so every match showed its actual date ("May 30") instead of "Today".

**Fix**: replaced `isToday` and `isTomorrow` with a private `dateOnlyString(date, tz)` helper that creates a FRESH `Intl.DateTimeFormat('en-CA', { year, month, day })` (no hour/minute at all). `en-CA` produces ISO-format "YYYY-MM-DD" strings that compare correctly.

## getDayLabel vs formatDate
`getDayLabel` (in `lib/utils/timezone.ts`) returns "Today" / "Tomorrow" / formatted date.
`formatDate` always returns the real date like "May 30".
Use `formatDate` in detail/header contexts. Use manual `dateStr !== 'Today'` guard in list/card contexts.
