---
name: tipster_profiles schema gaps
description: The production tipster_profiles table is missing columns the code assumed exist; fixed via instrumentation migrations.
---

# tipster_profiles Schema Gaps

**The rule:** Never INSERT or SELECT `bio`, `created_at`, or `is_verified` on `tipster_profiles` unless the instrumentation migration has run first. The safe always-present columns are: `user_id`, `win_rate`, `total_tips`, `won_tips`, `lost_tips`, `pending_tips`, `avg_odds`, `roi`, `streak`, `rank_position`, `followers_count`, `is_pro`, `subscription_price`, `updated_at`.

**Why:** The base MariaDB dump (admin_betcheza schema) never included `bio`, `created_at`, or `is_verified` in `tipster_profiles`. The approval flow tried to INSERT with `is_verified` and `created_at`, which threw a silent "column not found" error. The admin tipsters query selected `tp.bio` which also didn't exist, making the main query fail (it fell back to `WHERE role='tipster'` on users table). This caused approved tipsters to show Real(0) in admin even after their role was correctly updated.

**How to apply:**
- Instrumentation.ts now runs `ALTER TABLE tipster_profiles ADD COLUMN IF NOT EXISTS ...` for all three missing columns on every server start.
- It also runs `INSERT IGNORE INTO tipster_profiles (user_id) SELECT id FROM users WHERE role='tipster'` to backfill any missing rows.
- The approval INSERT (`lib/tipster-applications-store.ts`) only uses `(user_id, updated_at)` — safe columns that always exist.
- `app/api/admin/tipsters/route.ts` uses LEFT JOIN (not INNER JOIN) + falls back gracefully if `tp.bio` still fails.
