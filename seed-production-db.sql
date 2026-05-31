-- =============================================================
-- Betcheza Production DB Migration Script
-- Run this in phpMyAdmin on the admin_betcheza database
-- =============================================================

-- Step 1: Add missing columns to competitions table
-- (safe to run even if columns already exist — uses IF NOT EXISTS)

ALTER TABLE `competitions`
  ADD COLUMN IF NOT EXISTS `slug` varchar(200) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `currency` varchar(10) DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS `prize_breakdown` longtext DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `match_kickoff_from` datetime DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `match_kickoff_to` datetime DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `round_based` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `rule_config` longtext DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `kicked_users` longtext DEFAULT NULL;

-- Step 2: Add sport_type if missing (some versions have it)
ALTER TABLE `competitions`
  ADD COLUMN IF NOT EXISTS `sport_type` varchar(100) DEFAULT NULL;

-- Step 3: Insert the FIFA World Cup 2026 Tipster Challenge
-- Uses INSERT IGNORE so it won't fail if a competition with this slug already exists

INSERT INTO `competitions`
  (`name`, `description`, `start_date`, `end_date`, `prize_pool`, `entry_fee`,
   `max_participants`, `status`, `rules`, `type`, `sport_focus`, `league_id`,
   `league_name`, `currency`, `prize_breakdown`, `slug`,
   `match_kickoff_from`, `match_kickoff_to`, `round_based`, `rule_config`, `kicked_users`)
SELECT
  'FIFA World Cup 2026 — Tipster Challenge',
  'The ultimate tipster competition for the biggest football event on the planet. Predict every World Cup match from group stage to the final and top the leaderboard for a massive prize pool. Open to all Betcheza members — free to enter, tips locked at kickoff.',
  '2026-06-11',
  '2026-07-19',
  50000,
  0,
  10000,
  'upcoming',
  '[\"Free entry — no deposit required. All registered Betcheza members are eligible.\",\"Competition covers the full FIFA World Cup 2026 tournament: Group Stage (Jun 11–Jul 2), Round of 32 (Jul 4–7), Quarter-Finals (Jul 9–10), Semi-Finals (Jul 14–15), Third Place Play-Off (Jul 18), and Final (Jul 19).\",\"Submit a 1X2 tip for each match before its kickoff time. Tips submitted after kickoff are not counted.\",\"Correct result tips earn 3 points. Tips on matches with no submission score 0 points.\",\"Bonus: correctly predicting a draw earns +1 extra point (4 total). Correctly predicting the winning team in a knockout match earns +1 extra point (4 total).\",\"Tie-breaker 1: Total number of correct tips. Tie-breaker 2: Highest tip streak. Tie-breaker 3: Earliest registration date.\",\"Group Stage: 48 matches. Round of 32: 8 matches. Quarter-Finals: 4 matches. Semi-Finals: 2 matches. Third-Place Play-Off: 1 match. Final: 1 match. Total: 64 matches.\",\"Minimum 10 tips must be submitted across the tournament to qualify for prize payouts.\",\"Prizes are credited to Betcheza wallet within 48 hours of the Final (July 19, 2026).\",\"One account per participant. Multi-accounting or use of bots results in immediate disqualification.\",\"Betcheza reserves the right to amend rules in case of match postponements, cancellations, or schedule changes by FIFA.\",\"By entering, you agree to Betcheza terms and conditions and responsible gambling policy.\"]',
  'special',
  'football',
  NULL,
  'FIFA World Cup 2026',
  'KES',
  '[{\"place\":\"🥇 1st\",\"amount\":20000},{\"place\":\"🥈 2nd\",\"amount\":10000},{\"place\":\"🥉 3rd\",\"amount\":5000},{\"place\":\"4th–10th\",\"amount\":1500},{\"place\":\"11th–50th\",\"amount\":250}]',
  'world-cup-2026-tipster-challenge',
  '2026-06-11 00:00:00',
  '2026-07-19 23:59:59',
  1,
  '[{\"type\":\"min_tips\",\"value\":10,\"label\":\"Minimum 10 tips required to qualify for prizes\",\"enforceable\":true},{\"type\":\"score_formula\",\"value\":\"3 pts correct, +1 for draw/knockout correct pick\",\"label\":\"Scoring: 3 pts per correct result; +1 bonus for correct draw or knockout winner\",\"enforceable\":false},{\"type\":\"tiebreaker\",\"value\":\"tips_count,streak,registration_date\",\"label\":\"Tie-breakers: correct tip count → longest streak → earliest registration\",\"enforceable\":false},{\"type\":\"kickoff_only\",\"label\":\"Tips must be placed before match kickoff\",\"enforceable\":true}]',
  NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `competitions` WHERE `slug` = 'world-cup-2026-tipster-challenge'
);

-- Verify the insert worked:
SELECT id, name, status, start_date, end_date, prize_pool, slug
FROM competitions
ORDER BY id DESC
LIMIT 5;
