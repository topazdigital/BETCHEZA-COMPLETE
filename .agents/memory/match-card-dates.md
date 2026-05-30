---
name: Match card date labels
description: How Today/Tomorrow labels work in match cards and where the suppression bug was
---

- `components/matches/match-card.tsx` — basic card; fixed to show Today/Tomorrow
- `components/matches/match-card-new.tsx` — main card used on /matches page; compact variant at line ~234 previously hid "Today" with `dateStr === 'Today' ? '' : dateStr`
- Fixed to always show dateStr; "Today"/"Tomorrow" get `font-medium text-primary/70` styling
- `isToday` / `isTomorrow` in `lib/utils/timezone.ts` use user's timezone from `UserSettingsProvider`; renders as UTC during SSR before mount

**Why:** The empty-string suppression was intentional design but conflicted with user requirement to see "Today" label.
