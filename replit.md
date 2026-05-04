# Betcheza

## Overview

Betcheza is a sports betting tipster community platform providing real-time sports data, AI-powered predictions, and a social environment for tip sharing and tracking. Its purpose is to empower users with tools for informed betting decisions and foster community engagement through leaderboards.

## System Architecture

The Betcheza platform is built with Next.js (App Router) and React, utilizing TypeScript. Styling uses Tailwind CSS v4, shadcn/ui, and Radix UI. State management and data fetching are handled by SWR. Authentication uses a custom JWT implementation with `jose` and `bcryptjs`, securing user sessions via HTTP-only cookies.

**Database**: PostgreSQL via the `pg` driver (`DATABASE_URL` env var). All SQL uses `$1/$2` placeholders (converted automatically by `lib/db.ts`'s `convertPlaceholders()` from `?` syntax). Upserts use `ON CONFLICT ... DO UPDATE`. The schema is initialized by `scripts/setup-database-pg.sql`.

Key architectural decisions and features include:

- **Modular Project Structure**: Designed for maintainability and scalability.
- **Data Fallback Strategy**: Ensures system stability when external data sources are unavailable (in-memory / file-based fallback when DB is unavailable).
- **AI Integration**: Features an AI copilot for match predictions and chat, powered by OpenAI (`AI_INTEGRATIONS_OPENAI_API_KEY` or `OPENAI_API_KEY`), with a local rules-based fallback.
- **Dynamic Content**: Utilizes server-side rendering and API routes for real-time sports data, odds, and community content.
- **Admin Dashboard**: Provides comprehensive management for users, matches, news, platform settings, social logins, SEO, and URL rewrites.
- **User Personalization**: Includes sidebar league grouping, team and tipster following, and personalized dashboards.
- **Enhanced Security**: Implements Two-Factor Authentication (2FA), rate limiting, Captcha, and email verification.
- **Notification System**: Supports web push and email notifications, including admin broadcasts and real-time in-app notifications.
- **Content Management**: Features "My Bookmarks," a season selector, and an internal news reader.
- **Expanded Data Coverage**: Integrates multiple sports APIs (ESPN, The Odds API, TheSportsDB, FotMob, football-data.org) for wide match coverage.
- **Tipster Community Features**: Tipster catalogue with comparison tools, role/permission system, auto-tip generation, persistent follows, and public tipster profiles.
- **Community Engagement**: Comments and likes per tip, joinable competitions with leaderboards, and a community feed.
- **Financial Features**: User wallet ledger with deposit/withdraw, prize payouts, and multi-provider payment gateway support.
- **Persistence**: Critical settings and user data are persisted to local files for dev and to PostgreSQL for production.
- **3-Column Layout**: Main pages use a 3-column flex layout.
- **Match URL Slugs**: Match URLs use `team-a-vs-team-b-NUMERICID` format.
- **Sports Filter**: Displays 8 popular sports as pills plus a "More" dropdown.
- **Global Odds Format**: `contexts/user-settings-context.tsx` is the single source of truth for odds format.
- **Match Caching**: Uses an in-process 20s TTL cache with promise deduplication for match data.
- **DB-First Auth**: All auth routes query PostgreSQL first and fall back to in-memory mock only when no DB pool is configured.
- **Google OAuth**: OAuth callback saves Google users to DB; `/api/auth/google-client-id` exposes the client ID for frontend.

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (set by Replit)
- `JWT_SECRET` — Secret for JWT token signing
- `FOOTBALL_DATA_API_KEY` — football-data.org API key
- `SPORTSGAMEODDS_API_KEY` — SportsGameOdds API key
- `DISABLE_MOCK_MATCHES` — Set to disable mock match data
- `AI_INTEGRATIONS_OPENAI_API_KEY` or `OPENAI_API_KEY` — OpenAI API key

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

- App runs on port 5000 via the "Start application" workflow (`npm run dev -- -p 5000`)
- Database schema: `scripts/setup-database-pg.sql`
- File-based fallback data stored in `.local/data/`
