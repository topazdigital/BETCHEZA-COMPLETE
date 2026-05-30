---
name: DB & fallback stores
description: Remote MySQL connection and in-memory/file fallback when secrets are absent
---

- Remote MySQL at `157.250.205.180:3306`; secrets `DB_USER` / `DB_PASSWORD` stored in Replit env
- When DB secrets are missing, app silently falls back to in-memory + file stores
- File-store subscribers have no `createdAt` field (added recently) → show `—` in admin "Joined" column; this is expected until real DB is connected
- `lib/db.ts` manages the connection pool

**Why:** The fallback lets the UI run without DB, but data is ephemeral and some columns may be empty.
