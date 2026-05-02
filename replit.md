# Betcheza

## Overview

Betcheza is a sports betting tipster community platform designed to offer real-time sports data, AI-powered predictions, and a social environment for tip sharing and tracking. Its core purpose is to empower users with tools for informed betting decisions, foster community engagement through leaderboards, and provide a robust platform for sports enthusiasts. The project aims to be a leading online destination for sports betting and tipster communities, leveraging modern web technologies for a fast, responsive, and data-rich user experience.

## User Preferences

- I want iterative development.
- I prefer detailed explanations.
- Ask before making major changes.
- I prefer simple language.
- I like functional programming.
- **🚨 CRITICAL — IMMUTABLE RULE: ALWAYS use MySQL only. NEVER use PostgreSQL, pg, $1/$2 placeholders, ON CONFLICT, or any PostgreSQL syntax — under ANY circumstances, in ANY prompt, in ANY new chat. The ONLY database driver allowed is `mysql2/promise`. All SQL placeholders must be `?`. All upserts must use `ON DUPLICATE KEY UPDATE`. All inserts must use `INSERT IGNORE`. Violating this rule is STRICTLY FORBIDDEN. The user will deploy to a live MySQL server.**
- Sport icons in `ALL_SPORTS` (lib/sports-data.ts) and `mockSports` (lib/mock-data.ts) must use emoji characters directly (e.g. '⚽', '🏀') — not text keys like 'soccer'.

## System Architecture

The Betcheza platform is built with Next.js 16 (App Router) and React 19, utilizing TypeScript. Styling is managed with Tailwind CSS v4, shadcn/ui, and Radix UI to deliver a modern and responsive UI/UX, incorporating dynamic flag icons and clear visual hierarchies. State management and data fetching are handled by SWR. Authentication uses a custom JWT implementation with `jose` and `bcryptjs`, securing user sessions via HTTP-only cookies. The backend primarily uses **MySQL** via the `mysql2/promise` driver, with a graceful fallback to in-memory mock data for development environments. All SQL queries use `?` placeholders.

Key architectural decisions and features include:

-   **Modular Project Structure**: Designed for maintainability and scalability.
-   **Data Fallback Strategy**: Ensures system stability when external data sources are unavailable.
-   **AI Integration**: Features an AI copilot for match predictions and chat, powered by OpenAI, with a local rules-based fallback.
-   **Dynamic Content**: Utilizes server-side rendering and API routes for real-time sports data, odds, and community content.
-   **Admin Dashboard**: Provides comprehensive management for users, matches, news, platform settings, social logins, SEO, and URL rewrites.
-   **User Personalization**: Includes sidebar league grouping based on user's home country, team and tipster following, and personalized dashboards.
-   **Enhanced Security**: Implements Two-Factor Authentication (2FA), rate limiting, and Captcha for login and registration. Email verification is enforced on signup.
-   **Notification System**: Supports web push and email notifications, including admin broadcasts and real-time in-app notifications.
-   **Content Management**: Features a "My Bookmarks" page, a season selector for league pages, and an internal news reader for ESPN articles.
-   **Expanded Data Coverage**: Integrates multiple sports APIs to provide wide match coverage across various sports and leagues, including derived betting markets and deterministic outrights.
-   **Tipster Community Features**: Includes a comprehensive tipster catalogue with comparison tools, a role and permission system (`admin`, `moderator`, `editor`, `tipster`, `user`), auto-tip generation, persistent follows, and a public tipster profile with real-time stats and engagement.
-   **Community Engagement**: Facilitates real comments and likes per tip, joinable competitions with leaderboards, and a community feed seeded from real matches.
-   **Financial Features**: Incorporates a user wallet ledger with deposit/withdraw functionality, prize payout mechanisms for competitions, and multi-provider M-Pesa integration.
-   **Affiliate Management**: Tracks affiliate clicks, sign-ups, and deposits through a conversion funnel, with a dedicated admin dashboard for monitoring.
-   **UI/UX Enhancements**: Features infinite scroll for match listings, sport-aware live timers, fuzzy logic for form sidebar logos, and a redesigned brand identity.
-   **Persistence**: Critical settings and user data (e.g., wallet, tipster applications, email templates, user profiles, admin settings) are persisted to local files (`.local/state/`) for development resilience and to MySQL for production.
-   **3-Column Layout on All Main Pages**: Homepage, Matches, Live, Results, and Match Detail pages all use a 3-column flex layout — left sidebar (lg+) shows Favorited Tips, center shows main content, right panel (xl+) shows Best Bets/Featured Matches.
-   **Dark Menu Removed**: `SidebarNew` (dark secondary sidebar) has been removed from all pages (bookmakers, competitions, leagues, leaderboard, live, predictor, results, stats, tipsters, tipsters/compare). All pages now use the full content width.
-   **Match URL Slugs**: Match URLs use `team-a-vs-team-b-NUMERICID` format (e.g. `/matches/leeds-vs-burnley-740942`). `matchToSlug()` in `lib/utils/match-url.ts` generates them; `slugToMatchId()` handles both old and new formats.
-   **Sports Filter**: `components/sports/sports-filter.tsx` shows 8 popular sports as pills + a "More" dropdown for the rest. 
-   **Kenya Premier League**: leagueId corrected to 9022 in `lib/api/unified-sports-api.ts`. Kenyan/African teams now resolve to correct country via `SOCCER_COUNTRY_TO_LEAGUE` in `app/api/teams/[id]/route.ts`.
-   **Live Flicker Fix**: `useLiveMatches` hook returns `isLoading: true` while SWR is validating with zero results, preventing "Nothing live" empty-state flash.
-   **SQL Changes**: User runs own live MySQL server. SQL changes are always provided as code snippets only, never modifying schema files directly.
-   **Sidebar Live/Up Next Logic**: `LiveSidePanel` in `app/(main)/page.tsx` shows ONLY "Live Now" when live matches exist (link → `/matches?status=live`); shows ONLY "Up Next" (sorted ascending by kickoff time) when no live matches (link → `/matches?status=scheduled`). Never mixes both.
-   **Global Odds Format**: `contexts/user-settings-context.tsx` is the single source of truth for odds format. It merges `betcheza_settings` + legacy `bz_prefs` localStorage keys on init, fires `StorageEvent` on change for cross-tab sync, and keeps both keys in sync. Settings page (`app/(main)/settings/page.tsx`) uses `useUserSettings()` — changing format there immediately updates all match cards site-wide.
-   **Women's / Age-Group Badges**: `lib/utils/team-category.ts` detects women's leagues (WSL, NWSL, Frauen, féminin, `.w.` ESPN slugs, etc.) and youth/age-group fixtures (U21, U19, etc.) from league name + ESPN slug. `components/matches/match-card-new.tsx` renders a small `CategoryBadge` ("W", "U21", etc.) after team names only when not already obvious from the team name itself (e.g. "Arsenal Women" gets no badge; "Arsenal" in Women's Super League does).
-   **Match Caching**: `getAllMatches()` in `lib/api/unified-sports-api.ts` uses an in-process 20s TTL cache with promise deduplication to avoid duplicate API calls. A 5-day date window prevents the 2616-match bloat.
-   **Fake Votes System**: `/api/cron/fake-votes` endpoint seeds realistic vote distributions (home/draw/away) for upcoming matches. Votes are DB-persisted via `lib/votes-store.ts` (`match_votes` table). Smart seeding: popularity-weighted pools, sport-aware (no draws for basketball/tennis), correlated with auto-tips direction via `castVote()`. Fake tipster votes use deterministic voter IDs to prevent double-voting across cron runs.
-   **Match Detail Formation Sidebar**: The match detail left sidebar (`SidebarLineupsPanel`) now renders a sport-specific field visualization: football/rugby shows a real pitch (`SidebarPitch`) with players in formation positions, basketball shows a `BasketballCourtSVG`, ice hockey shows a `HockeyRinkSVG`, other sports fall back to a compact list. The pitch is always vertical (ignores md: breakpoints) so it fits correctly in the 256px sidebar.
-   **Match Detail Tab Reduction**: Match detail page reduced from 7 tabs (Tips/Overview/Events/Stats/H2H/Table/News) to 5 (Tips/Match/Analysis/Table/News). Events timeline merged into Match tab. H2H merged into Analysis tab.
-   **Matches Page Left Sidebar**: Creative left sidebar added to `/matches` with: live/today stats strip, date shortcuts (Today/Tomorrow/This Week/Upcoming/date picker), sport filter with counts, popular leagues quick-filter, hot matches indicator. Hidden on mobile (lg+ only).
-   **League Country Assignments Fixed**: Removed ESPN `uga.1` endpoint (was returning Polish Ekstraklasa data for Uganda), removed TheSportsDB `tsdbId: '4422'` (labeled Uganda, returned Korona Kielce/Polish data). Added `KNOWN_GLOBAL_LEAGUES['11053']` → PKO BP Ekstraklasa (Poland) for ESPN global scoreboard.
-   **Loading States**: `loading.tsx` skeleton files added for main, matches, feed, live, tipsters, and leaderboard pages to eliminate blank-screen navigation lag.
-   **GitHub Actions Deploy**: `.github/workflows/deploy.yml` configured for SSH-based auto-deployment on push to main.
-   **Health Check API**: `/api/health` returns uptime and timestamp for deployment health checks.
-   **Match Hero Timeline (T001)**: `HeroTimeline` component added inside the match score hero card — a horizontal bar (0–90') with emoji event markers (⚽ goals, 🟨 cards, 🟥 red cards) positioned by minute, shown for live/finished matches only.
-   **Settings (T002)**: Username is now read-only. Password change form with currentPassword/newPassword/confirmPassword + eye-toggle visibility connects to `app/api/auth/change-password/route.ts` which verifies bcrypt hash before updating.
-   **Notification Preferences (T004)**: `lib/notification-store.ts` persists preferences to `.local/state/` via `fileStoreGet`/`fileStoreSet` so they survive server restarts.
-   **Popular Leagues Icons (T005)**: Globe2 / 🌐 emoji replaces Trophy icon in the Popular Leagues sidebar section.
-   **Add Tip Button (T006)**: Hidden for finished/FT matches in the hero CTA and the Tips tab; replaced by an info note.
-   **Team Logos (T007)**: ESPN CDN URL in `components/ui/team-logo.tsx` is now sport-aware (`/nba/`, `/nfl/`, `/mlb/`, `/nhl/` sub-paths) based on `sportSlug` prop.
-   **Duplicate Teams (T008)**: `getMatchKey()` in `lib/api/unified-sports-api.ts` now strips common club suffixes (FC, AFC, SC, City, United, Town, Rovers, etc.) so "Derby County" and "Derby County FC" deduplicate to the same key.
-   **AI Predictor (T009)**: Autofill from upcoming fixtures + W/L/D/push result badges already complete.
-   **Payment Gateways (T010)**: New `GET /api/wallet/methods` endpoint returns admin-enabled gateways. `DepositForm` in wallet page fetches this and shows only active gateway types; falls back to the default M-Pesa/Card/Bank/Crypto list when none are configured.
-   **Comment Templates (T011/T012)**: `lib/tip-engagement-store.ts` COMMENT_TEMPLATES rewritten — all HTML entities (`&apos;`) replaced with real apostrophes, 15 new comment templates added (analyst/hype/sceptic/stake voices).
-   **Winner Vote Draw Button (T013)**: Draw "X" button in `components/matches/winner-vote.tsx` enlarged to h-8 w-8, border-2, bold font — same visual size as team logos. Highlights in primary colour when selected.
-   **MySQL-Only Compliance**: ALL remaining PostgreSQL syntax eliminated — `lib/static-pages-store.ts`, `lib/email-config-store.ts`, `lib/oauth-config-store.ts`, `app/api/admin/settings/route.ts`, `app/api/admin/seo/route.ts`, `app/api/admin/payment-gateways/route.ts`, `app/api/admin/matches/route.ts` all converted to `ON DUPLICATE KEY UPDATE`, `?` placeholders, `insertId`.
-   **Profile Photo Picker**: `app/(main)/settings/page.tsx` has a 16-avatar DiceBear grid (seeds betz1–betz16). Clicking an avatar saves it instantly via `PATCH /api/users/me` (`avatarUrl` field). Live preview above the grid. Avatar shown on tipster cards and profile.
-   **Tip Result Badges**: `TipCard` in `app/(main)/matches/[id]/page.tsx` shows WON (emerald), LOST (rose), VOID (muted) badges in the footer based on `tip.status`. Tipster avatar (`tip.tipster.avatar`) is displayed with `AvatarImage`.
-   **Form Logos Fallback**: Right sidebar standings FORM section now falls back to `match.homeTeam.logo` / `match.awayTeam.logo` when `standingRow.teamLogo` is missing (`homeStandingRaw/awayStandingRaw` pattern).
-   **League ID Alignment**: Ghana (9026→252), Tanzania (9028→256) in `lib/sports-data.ts` now match ESPN config `leagueId` values — league pages for these now correctly show matches.
-   **Missing Exports Fixed**: `listFollowedTeams` alias added to `lib/follows-store.ts`; `setBaselineLikes()` and `getCommentCount()` added to `lib/tip-engagement-store.ts`; `process.env.DATABASE_URL` guard in cron route replaced with `getPool()` check.
-   **Tennis Fallback Fetch**: `fetchESPNGlobalSport` in `lib/api/unified-sports-api.ts` now falls back to the date-less `/all/scoreboard` endpoint when the date-range request returns 0 events (common for tennis/golf between majors).
-   **Post-as-Tip Modal Auto-Open**: Match detail page (`app/(main)/matches/[id]/page.tsx`) now reads `?action=tip` via `useSearchParams` and auto-opens the tip modal. Bet slip "Post as Tip" navigates to `/matches/[slug]?action=tip`.
-   **Live Sounds**: `components/live/use-live-sounds.ts` provides synthesized Web Audio API sounds — goal roar, follow-team goal (louder), yellow card, whistle, kickoff. `LiveSoundWatcher` in `app/(main)/live/page.tsx` detects score changes each SWR poll and plays the appropriate tone. A mute/unmute toggle appears in the Live page header.
-   **Clickable Scorer + Assister Names**: `ScorersList` in match detail hero section now renders `PlayerLink` components — clicking a scorer/assister name navigates to `/players/[espnId]` (or `/search?q=name` fallback). Own-goal emoji changed to 🔴. Assist names shown below scorer with ↪ arrow. Player IDs (`playerId`, `assistId`, `playerOutId`) now extracted from ESPN participants in `app/api/matches/[id]/details/route.ts`.

## External Dependencies

-   **OpenAI**: For AI-powered match predictions and conversational AI.
-   **ESPN Public API**: Primary source for real-time sports scores and match data.
-   **The Odds API**: For multi-bookmaker odds comparisons.
-   **TheSportsDB**: Supplemental data for events, especially smaller leagues.
-   **FotMob**: Additional match data and league coverage.
-   **OpenLigaDB**: Additional match data.
-   **football-data.org**: Additional match data.
-   **flagcdn.com**: For dynamic flag icons.
-   **SportsGameOdds**: For additional bookmaker lines and outrights.
-   **Various Email-to-SMS Carrier Gateways**: For SMS notifications.