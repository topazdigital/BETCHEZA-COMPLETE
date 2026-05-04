# Betcheza

## Overview

Betcheza is a sports betting tipster community platform providing real-time sports data, AI-powered predictions, and a social environment for tip sharing and tracking. Its purpose is to empower users with tools for informed betting decisions and foster community engagement through leaderboards. The project aims to be a leading online destination for sports betting and tipster communities.

## User Preferences

- I want iterative development.
- I prefer detailed explanations.
- Ask before making major changes.
- I prefer simple language.
- I like functional programming.
- **🚨 CRITICAL — IMMUTABLE RULE: ALWAYS use MySQL only. NEVER use PostgreSQL, pg, $1/$2 placeholders, ON CONFLICT, or any PostgreSQL syntax — under ANY circumstances, in ANY new chat. The ONLY database driver allowed is `mysql2/promise`. All SQL placeholders must be `?`. All upserts must use `ON DUPLICATE KEY UPDATE`. All inserts must use `INSERT IGNORE`. Violating this rule is STRICTLY FORBIDDEN. The user will deploy to a live MySQL server (DirectAdmin hosting).**
- Sport icons in `ALL_SPORTS` (lib/sports-data.ts) and `mockSports` (lib/mock-data.ts) must use emoji characters directly (e.g. '⚽', '🏀') — not text keys like 'soccer'.

## System Architecture

The Betcheza platform is built with Next.js (App Router) and React, utilizing TypeScript. Styling uses Tailwind CSS v4, shadcn/ui, and Radix UI. State management and data fetching are handled by SWR. Authentication uses a custom JWT implementation with `jose` and `bcryptjs`, securing user sessions via HTTP-only cookies.

**Database: MySQL ONLY** — driver: `mysql2/promise` (env vars: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` or `MYSQL_HOST` etc.). All SQL placeholders use `?`. Upserts use `ON DUPLICATE KEY UPDATE x = VALUES(x)`. Conditional inserts use `INSERT IGNORE`. Tables use `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`. Never use pg, $1/$2, ON CONFLICT, RETURNING, or any PostgreSQL syntax.

Key architectural decisions and features include:

- **Modular Project Structure**: Designed for maintainability and scalability.
- **Data Fallback Strategy**: Ensures system stability when external data sources are unavailable (in-memory / file-based fallback when DB is unavailable).
- **AI Integration**: Features an AI copilot for match predictions and chat, powered by OpenAI, with a local rules-based fallback.
- **Dynamic Content**: Utilizes server-side rendering and API routes for real-time sports data, odds, and community content.
- **Admin Dashboard**: Provides comprehensive management for users, matches, news, platform settings, social logins, SEO, and URL rewrites.
- **User Personalization**: Includes sidebar league grouping, team and tipster following, and personalized dashboards.
- **Enhanced Security**: Implements Two-Factor Authentication (2FA), rate limiting, Captcha, and email verification.
- **Notification System**: Supports web push and email notifications, including admin broadcasts and real-time in-app notifications.
- **Content Management**: Features "My Bookmarks," a season selector, and an internal news reader.
- **Expanded Data Coverage**: Integrates multiple sports APIs for wide match coverage across various sports and leagues.
- **Tipster Community Features**: Tipster catalogue with comparison tools, role/permission system, auto-tip generation, persistent follows, and public tipster profiles.
- **Community Engagement**: Comments and likes per tip, joinable competitions with leaderboards, and a community feed.
- **Financial Features**: User wallet ledger with deposit/withdraw, prize payouts, and multi-provider payment gateway support.
- **Affiliate Management**: Tracks affiliate clicks, sign-ups, and deposits.
- **Persistence**: Critical settings and user data are persisted to local files for development and to MySQL for production.
- **3-Column Layout**: Main pages use a 3-column flex layout.
- **Match URL Slugs**: Match URLs use `team-a-vs-team-b-NUMERICID` format.
- **Sports Filter**: Displays 8 popular sports as pills plus a "More" dropdown.
- **Global Odds Format**: `contexts/user-settings-context.tsx` is the single source of truth for odds format.
- **Match Caching**: Uses an in-process 20s TTL cache with promise deduplication for match data.
- **Fake Votes System**: Seeds realistic, DB-persisted vote distributions for upcoming matches.
- **DB-First Auth**: All auth routes query MySQL first and fall back to in-memory mock only when no DB pool is configured.
- **Google OAuth**: OAuth callback saves Google users to DB; `/api/auth/google-client-id` exposes the client ID for frontend.
- **Real Bookmaker Odds Only**: matches without bookmaker odds return `undefined` odds instead of computer-generated estimates.
- **Jackpot Feature**: Scrapes Kenyan bookmakers (SportPesa, Betika, etc.) for jackpot games, AI predicts them (auto-triggered on sync), admin can edit. Each bookmaker has its own SEO page. Results section and recently-viewed widget included.
- **Push Notifications**: Full browser push notification system using `web-push` + VAPID. Service worker at `public/sw.js`, subscription API at `/api/notifications/subscribe` (POST/DELETE), VAPID public key exposed at `/api/notifications/vapid-public-key`. Jackpot notifications sent automatically when new rounds are published. Bell UI on `/jackpots` page. VAPID keys stored as `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` env vars.
- **GitHub Actions Deploy**: Configured for SSH-based auto-deployment on push to main.
- **Health Check API**: `/api/health` returns uptime and timestamp.

## Environment Variables (MySQL)

- `DB_HOST` or `MYSQL_HOST` — MySQL host
- `DB_USER` or `MYSQL_USER` — MySQL username
- `DB_PASSWORD` or `MYSQL_PASSWORD` — MySQL password
- `DB_NAME` or `MYSQL_DATABASE` — MySQL database name
- `JWT_SECRET` — Secret for JWT token signing
- `FOOTBALL_DATA_API_KEY` — football-data.org API key
- `SPORTSGAMEODDS_API_KEY` — SportsGameOdds API key

## External Dependencies

- **OpenAI**: For AI-powered match predictions and conversational AI.
- **ESPN Public API**: Primary source for real-time sports scores and match data.
- **The Odds API**: For multi-bookmaker odds comparisons.
- **TheSportsDB**: Supplemental data for events.
- **FotMob**: Additional match data and league coverage.
- **OpenLigaDB**: Additional match data.
- **football-data.org**: Additional match data.
- **flagcdn.com**: For dynamic flag icons.
- **SportsGameOdds**: For additional bookmaker lines and outrights.
- **Various Email-to-SMS Carrier Gateways**: For SMS notifications.

## Development

- App runs on port 5000 via the "Start application" workflow (`npm run dev`)
- Production: DirectAdmin hosting with MySQL database, GitHub Actions SSH deploy
- File-based fallback data stored in `.local/data/`
