-- ============================================================
-- Betcheza — Missing Tables for phpMyAdmin
-- Run this SQL in phpMyAdmin on your production database
-- (admin_betcheza) to add the tables the app needs.
-- ============================================================

-- ------------------------------------------------------------
-- 1. admin_settings
--    General key-value store used for:
--      • Payment gateway configuration (PayHero credentials, etc.)
--      • Email server settings
--      • Payout configuration
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_settings` (
  `name`        VARCHAR(100) NOT NULL,
  `value`       LONGTEXT,
  `type`        VARCHAR(50)  NOT NULL DEFAULT 'string'
                COMMENT 'string | json | boolean | number',
  `description` TEXT,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Admin key-value config store — payments, email, etc.';

-- Seed PayHero credentials if your server has them in .env
-- Replace the values below with your real credentials, then run:
-- INSERT INTO admin_settings (name, value, type, description)
-- VALUES ('payhero_token', 'Basic YOUR_TOKEN_HERE', 'string', 'PayHero Basic auth token')
-- ON DUPLICATE KEY UPDATE value = VALUES(value);

-- ------------------------------------------------------------
-- 2. daily_strategy
--    Powers the "3 Daily Odds Winning Strategy" feature.
--    Each row = one day in a 7-day compounding bet plan.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `daily_strategy` (
  `id`            INT(11)      NOT NULL AUTO_INCREMENT,
  `date`          DATE         NOT NULL COMMENT 'Calendar date for this strategy day',
  `week_id`       VARCHAR(10)  NOT NULL COMMENT 'Monday ISO date that identifies the week (YYYY-MM-DD)',
  `day_number`    TINYINT(4)   NOT NULL COMMENT '1–7 within the week',
  `stake`         INT(11)      NOT NULL COMMENT 'Amount to bet (KES)',
  `save_amount`   INT(11)      NOT NULL DEFAULT 0 COMMENT 'Amount to save from previous winnings',
  `target_win`    INT(11)      NOT NULL COMMENT 'Target payout if all 3 picks win',
  `combined_odds` DECIMAL(8,2) NOT NULL DEFAULT 0.00 COMMENT 'Product of all 3 pick odds',
  `status`        ENUM('upcoming','active','completed') NOT NULL DEFAULT 'upcoming',
  `result`        ENUM('win','loss') DEFAULT NULL COMMENT 'Settled outcome (NULL = not yet settled)',
  `actual_return` DECIMAL(12,2) DEFAULT NULL COMMENT 'Actual return after settlement',
  `picks`         LONGTEXT     DEFAULT NULL COMMENT 'JSON array of 3 StrategyPick objects',
  `generated_at`  TIMESTAMP    NULL DEFAULT NULL,
  `posted_at`     TIMESTAMP    NULL DEFAULT NULL,
  `settled_at`    TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_date` (`date`),
  KEY `idx_week_id` (`week_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='3 Daily Odds Winning Strategy — one row per day';

-- ============================================================
-- Done. Both tables are now created (IF NOT EXISTS is safe to
-- re-run — it will skip tables that already exist).
-- ============================================================
