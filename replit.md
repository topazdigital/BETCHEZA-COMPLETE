# Betcheza

## Overview

Betcheza is a sports betting tipster community platform designed to offer real-time sports data, AI-powered predictions, and a social environment for tip sharing and tracking. Its core purpose is to empower users with tools for informed betting decisions, foster community engagement through leaderboards, and provide a robust platform for sports enthusiasts. The project aims to be a leading online destination for sports betting and tipster communities, leveraging modern web technologies for a fast, responsive, and data-rich user experience.

## User Preferences

- I want iterative development.
- I prefer detailed explanations.
- Ask before making major changes.
- I prefer simple language.
- I like functional programming.
- **CRITICAL: Always use MySQL. NEVER switch to PostgreSQL or any other database without explicit user permission. The user will deploy to a live MySQL server.**
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
-   **3-Column Homepage Layout**: Homepage uses a 3-column flex layout — left sidebar (lg+) shows Live Now/Up Next + Favorited Tips, center shows hero/matches, right panel (xl+) shows Featured Matches + Today's Best Bets.
-   **Dark Menu Removed**: `SidebarNew` (dark secondary sidebar) has been removed from all pages (bookmakers, competitions, leagues, leaderboard, live, predictor, results, stats, tipsters, tipsters/compare). All pages now use the full content width.
-   **Match Caching**: `getAllMatches()` in `lib/api/unified-sports-api.ts` uses an in-process 20s TTL cache with promise deduplication to avoid duplicate API calls. A 5-day date window prevents the 2616-match bloat.
-   **Fake Votes System**: `/api/cron/fake-votes` endpoint seeds realistic vote distributions (home/draw/away) for upcoming matches. Votes are stored in `globalThis.__matchVotes`.
-   **Loading States**: `loading.tsx` skeleton files added for main, matches, feed, live, tipsters, and leaderboard pages to eliminate blank-screen navigation lag.
-   **GitHub Actions Deploy**: `.github/workflows/deploy.yml` configured for SSH-based auto-deployment on push to main.
-   **Health Check API**: `/api/health` returns uptime and timestamp for deployment health checks.

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