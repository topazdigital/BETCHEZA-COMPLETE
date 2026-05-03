# Betcheza

## Overview

Betcheza is a sports betting tipster community platform providing real-time sports data, AI-powered predictions, and a social environment for tip sharing and tracking. Its purpose is to empower users with tools for informed betting decisions and foster community engagement through leaderboards. The project aims to be a leading online destination for sports betting and tipster communities, leveraging modern web technologies for a fast, responsive, and data-rich user experience.

## User Preferences

- I want iterative development.
- I prefer detailed explanations.
- Ask before making major changes.
- I prefer simple language.
- I like functional programming.
- **🚨 CRITICAL — IMMUTABLE RULE: ALWAYS use MySQL only. NEVER use PostgreSQL, pg, $1/$2 placeholders, ON CONFLICT, or any PostgreSQL syntax — under ANY circumstances, in ANY prompt, in ANY new chat. The ONLY database driver allowed is `mysql2/promise`. All SQL placeholders must be `?`. All upserts must use `ON DUPLICATE KEY UPDATE`. All inserts must use `INSERT IGNORE`. Violating this rule is STRICTLY FORBIDDEN. The user will deploy to a live MySQL server.**
- Sport icons in `ALL_SPORTS` (lib/sports-data.ts) and `mockSports` (lib/mock-data.ts) must use emoji characters directly (e.g. '⚽', '🏀') — not text keys like 'soccer'.

## System Architecture

The Betcheza platform is built with Next.js 16 (App Router) and React 19, utilizing TypeScript. Styling uses Tailwind CSS v4, shadcn/ui, and Radix UI. State management and data fetching are handled by SWR. Authentication uses a custom JWT implementation with `jose` and `bcryptjs`, securing user sessions via HTTP-only cookies. The backend primarily uses MySQL via the `mysql2/promise` driver, with graceful fallback to in-memory mock data for development.

Key architectural decisions and features include:

-   **Modular Project Structure**: Designed for maintainability and scalability.
-   **Data Fallback Strategy**: Ensures system stability when external data sources are unavailable.
-   **AI Integration**: Features an AI copilot for match predictions and chat, powered by OpenAI, with a local rules-based fallback.
-   **Dynamic Content**: Utilizes server-side rendering and API routes for real-time sports data, odds, and community content.
-   **Admin Dashboard**: Provides comprehensive management for users, matches, news, platform settings, social logins, SEO, and URL rewrites.
-   **User Personalization**: Includes sidebar league grouping, team and tipster following, and personalized dashboards.
-   **Enhanced Security**: Implements Two-Factor Authentication (2FA), rate limiting, Captcha, and email verification.
-   **Notification System**: Supports web push and email notifications, including admin broadcasts and real-time in-app notifications.
-   **Content Management**: Features "My Bookmarks," a season selector, and an internal news reader.
-   **Expanded Data Coverage**: Integrates multiple sports APIs for wide match coverage across various sports and leagues, including derived betting markets and deterministic outrights.
-   **Tipster Community Features**: Includes a tipster catalogue with comparison tools, a role and permission system, auto-tip generation, persistent follows, and public tipster profiles with real-time stats.
-   **Community Engagement**: Facilitates comments and likes per tip, joinable competitions with leaderboards, and a community feed.
-   **Financial Features**: Incorporates a user wallet ledger with deposit/withdraw functionality, prize payouts, and multi-provider M-Pesa integration.
-   **Affiliate Management**: Tracks affiliate clicks, sign-ups, and deposits.
-   **UI/UX Enhancements**: Features infinite scroll, sport-aware live timers, fuzzy logic for form sidebar logos, and a redesigned brand identity.
-   **Persistence**: Critical settings and user data are persisted to local files for development and to MySQL for production.
-   **3-Column Layout**: Main pages (Homepage, Matches, Live, Results, Match Detail) use a 3-column flex layout.
-   **Match URL Slugs**: Match URLs use `team-a-vs-team-b-NUMERICID` format.
-   **Sports Filter**: Displays 8 popular sports as pills plus a "More" dropdown.
-   **Global Odds Format**: `contexts/user-settings-context.tsx` is the single source of truth for odds format, syncing across tabs and local storage.
-   **Women's / Age-Group Badges**: Detects women's and youth/age-group leagues to render appropriate badges on match cards.
-   **Match Caching**: Uses an in-process 20s TTL cache with promise deduplication for match data.
-   **Fake Votes System**: Seeds realistic, DB-persisted vote distributions for upcoming matches, sport-aware and correlated with auto-tips.
-   **Match Detail Formation Sidebar**: Renders sport-specific field visualizations (pitch, court, rink) or a compact list.
-   **Match Detail Tab Reduction**: Reduced from 7 to 5 tabs (Tips, Match, Analysis, Table, News).
-   **Matches Page Left Sidebar**: Creative sidebar with live/today stats, date shortcuts, sport filter, popular leagues, and hot matches indicator.
-   **Loading States**: `loading.tsx` skeleton files added for main pages.
-   **GitHub Actions Deploy**: Configured for SSH-based auto-deployment on push to main.
-   **Health Check API**: `/api/health` returns uptime and timestamp.
-   **Match Hero Timeline**: Horizontal bar (0–90') with emoji event markers for live/finished matches.
-   **Settings**: Username read-only, password change form with verification.
-   **Notification Preferences**: Persisted to local files for server restart resilience.
-   **Popular Leagues Icons**: Uses Globe2 / 🌐 emoji.
-   **Add Tip Button**: Hidden for finished/FT matches.
-   **Team Logos**: ESPN CDN URL in `components/ui/team-logo.tsx` is now sport-aware.
-   **Duplicate Teams**: `getMatchKey()` strips common club suffixes for deduplication.
-   **AI Predictor**: Autofill from upcoming fixtures + W/L/D/push result badges.
-   **Payment Gateways**: `GET /api/wallet/methods` returns admin-enabled gateways; deposit form shows only active types.
-   **Comment Templates**: Rewritten with real apostrophes and 15 new templates.
-   **Winner Vote Draw Button**: Enlarged and visually aligned with team logos.
-   **MySQL-Only Compliance**: All remaining PostgreSQL syntax eliminated in various API routes and store files.
-   **Profile Photo Picker**: 16-avatar DiceBear grid for profile photos, instantly saved.
-   **Tip Result Badges**: WON, LOST, VOID badges displayed on tip cards.
-   **Form Logos Fallback**: Right sidebar standings FORM section falls back to team logos when missing.
-   **Live Flicker Fix**: `useLiveMatches` hook prevents "Nothing live" empty-state flash.
-   **Tennis Fallback Fetch**: `fetchESPNGlobalSport` falls back to `/all/scoreboard` for tennis/golf.
-   **Post-as-Tip Modal Auto-Open**: Match detail page auto-opens tip modal via `?action=tip` search param.
-   **Live Sounds**: Synthesized Web Audio API sounds for goals, cards, whistles, kickoff, with mute/unmute toggle.
-   **Clickable Scorer + Assister Names**: Player names in match detail hero are clickable links to player profiles or search.
-   **Player Follow System**: CRUD functions for followed players, follow button, player profile page with stats and follow CTA.
-   **Hot Streaks Leaderboard**: Tab for tipsters on win streaks with podium cards and progress bars.
-   **H2H Predictor**: Team search, matchup analysis, odds cards, goal averages, last-5-meetings.
-   **Tipster Challenges**: Live/upcoming/finished tabs with VS cards.
-   **Live Scoreboard Widget**: Floating bottom-right panel showing live matches.
-   **Challenges in Sidebar Nav**: "Challenges" link added to `NAV_ITEMS`.

## External Dependencies

-   **OpenAI**: For AI-powered match predictions and conversational AI.
-   **ESPN Public API**: Primary source for real-time sports scores and match data.
-   **The Odds API**: For multi-bookmaker odds comparisons.
-   **TheSportsDB**: Supplemental data for events.
-   **FotMob**: Additional match data and league coverage.
-   **OpenLigaDB**: Additional match data.
-   **football-data.org**: Additional match data.
-   **flagcdn.com**: For dynamic flag icons.
-   **SportsGameOdds**: For additional bookmaker lines and outrights.
-   **Various Email-to-SMS Carrier Gateways**: For SMS notifications.