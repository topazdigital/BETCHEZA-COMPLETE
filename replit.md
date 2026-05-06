# Betcheza

A sports betting tipster community platform providing real-time sports data, AI-powered predictions, and social tip sharing, leaderboards, and competitions — targeted at the Kenyan market but covering global sports.

## Run & Operate

- **Dev**: `npm run dev` (port 5000, bound to 0.0.0.0)
- **Build**: `npm run build`
- **Start**: `npm start` (port 5001)
- **Lint**: `npm run lint`
- **Required env vars**: `JWT_SECRET`, `FOOTBALL_DATA_API_KEY`, `SPORTSGAMEODDS_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- **Optional DB**: `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` (MySQL). App runs without DB using in-memory/file fallback.
- **OpenAI**: Uses Replit AI Integrations (`AI_INTEGRATIONS_OPENAI_API_KEY` + `AI_INTEGRATIONS_OPENAI_BASE_URL`) with `OPENAI_API_KEY` as fallback. Falls back to rules-based chat if neither is set.

## Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, Radix UI, shadcn/ui
- **Data fetching**: SWR
- **Database**: MySQL via `mysql2/promise` (custom `lib/db.ts` wrapper) — **MySQL ONLY, never PostgreSQL**
- **Auth**: Custom JWT (`jose` + `bcryptjs`) with Google OAuth support
- **AI**: OpenAI (via Replit AI Integrations or direct API key)
- **Notifications**: Web Push (VAPID) + Nodemailer

## Where things live

- `app/` — Next.js App Router (auth routes, main pages, admin, API routes)
- `lib/` — Business logic, DB abstraction, API integrations, utilities
- `lib/db.ts` — MySQL pool wrapper (source of truth for DB access)
- `lib/api/unified-sports-api.ts` — Unified multi-provider sports data
- `components/` — React UI components
- `public/sw.js` — Service worker for push notifications
- `.local/data/` — File-based fallback data store

## Architecture decisions

- **MySQL only**: App explicitly forbids PostgreSQL. All SQL uses `?` placeholders, `ON DUPLICATE KEY UPDATE`, `INSERT IGNORE`.
- **Graceful DB fallback**: `getPool()` returns `null` if DB env vars are absent; all queries return empty results rather than throwing, enabling the app to run without a database.
- **OpenAI fallback**: AI chat uses a rules-based local fallback if no OpenAI key is configured — chat always works.
- **File-based settings**: Site settings, email config, and API keys are persisted to `.local/data/` files and seeded from env vars at startup via `instrumentation.ts`.
- **Match URL slugs**: `/matches/team-a-vs-team-b-NUMERICID` format for SEO.

## Product

- Real-time match scores, odds, and lineups across 35+ sports
- AI match predictions and conversational betting copilot
- Tipster leaderboard, community feed, tip sharing with likes/comments
- Jackpot scraper for Kenyan bookmakers (SportPesa, Betika, etc.)
- User wallet with deposit/withdraw and prize payouts
- Admin dashboard for users, payments, settings, SEO, email, notifications
- Web push notifications, 2FA, email verification

## User preferences

- **CRITICAL — IMMUTABLE**: Always use MySQL only. NEVER PostgreSQL, `pg`, `$1/$2` placeholders, `ON CONFLICT`, or `RETURNING`.
- SQL placeholders: `?`. Upserts: `ON DUPLICATE KEY UPDATE`. Conditional inserts: `INSERT IGNORE`.
- Sport icons in `ALL_SPORTS` and `mockSports` must use emoji characters directly (e.g. `⚽`, `🏀`).
- Iterative development. Ask before major changes. Simple language.

## Gotchas

- No DB = app still runs (in-memory/file fallback), but user data won't persist.
- `next start` runs on port 5001 bound to 127.0.0.1 (production); dev runs on 5000 bound to 0.0.0.0.
- VAPID keys must be set for push notifications to work.
- OpenAI blueprint already installed — app checks `AI_INTEGRATIONS_OPENAI_API_KEY` first, then `OPENAI_API_KEY`.
- `instrumentation.ts` seeds env vars into the in-memory settings store at startup.

## Pointers

- Sports API integration: `lib/api/unified-sports-api.ts`
- Auth logic: `lib/auth.ts`
- DB wrapper: `lib/db.ts`
- Site settings: `lib/site-settings.ts`
- Deployment was originally DirectAdmin + PM2 + GitHub Actions SSH — now runs on Replit.
