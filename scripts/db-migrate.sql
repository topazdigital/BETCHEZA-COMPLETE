-- Betcheza DB Migration Script
-- Run this against the production MySQL database to add missing columns/tables.
-- All statements use IF NOT EXISTS / IGNORE so they are safe to run multiple times.

-- ─── Add missing columns to `users` table for non-Google OAuth providers ───────
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `oauth_provider` varchar(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `oauth_provider_id` varchar(255) DEFAULT NULL;

-- ─── Add missing columns to `player_follows` table ────────────────────────────
-- The DB dump only has: user_id, entity_type, entity_id, followed_at
-- The application code expects richer columns. We add them if missing.
ALTER TABLE `player_follows`
  ADD COLUMN IF NOT EXISTS `player_id` varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `player_name` varchar(200) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `player_headshot` varchar(500) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `team_id` varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `team_name` varchar(200) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `team_logo` varchar(500) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `sport_slug` varchar(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `created_at` timestamp NOT NULL DEFAULT current_timestamp();

-- Add unique key for player follows if not present
ALTER TABLE `player_follows`
  ADD UNIQUE KEY IF NOT EXISTS `unique_user_player` (`user_id`, `player_id`);

-- ─── Ensure team_follows has unique key ─────────────────────────────────────
ALTER TABLE `team_follows`
  ADD UNIQUE KEY IF NOT EXISTS `unique_user_team` (`user_id`, `team_id`);

-- ─── Index for oauth lookup ──────────────────────────────────────────────────
ALTER TABLE `users`
  ADD INDEX IF NOT EXISTS `idx_users_google_id` (`google_id`),
  ADD INDEX IF NOT EXISTS `idx_users_oauth` (`oauth_provider`, `oauth_provider_id`(50));
