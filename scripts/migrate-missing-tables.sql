-- ============================================================
-- Betcheza — Missing tables migration
-- Run this on your admin_betcheza MySQL database via phpMyAdmin
-- or: mysql -u <user> -p admin_betcheza < scripts/migrate-missing-tables.sql
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS)
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- --------------------------------------------------------
-- jackpots
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `jackpots` (
  `id`              varchar(64)   NOT NULL,
  `bookmaker_slug`  varchar(50)   NOT NULL,
  `bookmaker_name`  varchar(100)  NOT NULL,
  `title`           varchar(200)  NOT NULL,
  `jackpot_amount`  varchar(30)   NOT NULL,
  `currency`        varchar(8)    NOT NULL DEFAULT 'KES',
  `deadline`        datetime      NOT NULL,
  `status`          enum('active','closed','settled') NOT NULL DEFAULT 'active',
  `result`          longtext      CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at`      timestamp     NOT NULL DEFAULT current_timestamp(),
  `updated_at`      timestamp     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_jackpots_status` (`status`),
  KEY `idx_jackpots_bookmaker` (`bookmaker_slug`),
  KEY `idx_jackpots_deadline` (`deadline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- jackpot_games
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `jackpot_games` (
  `id`             varchar(64)   NOT NULL,
  `jackpot_id`     varchar(64)   NOT NULL,
  `game_index`     tinyint(3)    NOT NULL DEFAULT 0,
  `home`           varchar(100)  NOT NULL,
  `away`           varchar(100)  NOT NULL,
  `league`         varchar(100)  DEFAULT NULL,
  `kickoff_time`   datetime      DEFAULT NULL,
  `prediction`     varchar(4)    DEFAULT NULL COMMENT '1 / X / 2 / 1X / X2 / 12',
  `ai_prediction`  varchar(4)    DEFAULT NULL,
  `result`         varchar(4)    DEFAULT NULL COMMENT 'actual result after settlement',
  `created_at`     timestamp     NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_jackpot_games_jackpot` (`jackpot_id`),
  KEY `idx_jackpot_games_index` (`jackpot_id`, `game_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key only if it doesn't exist yet
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'jackpot_games'
    AND CONSTRAINT_NAME = 'fk_jackpot_games_jackpot'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE `jackpot_games` ADD CONSTRAINT `fk_jackpot_games_jackpot` FOREIGN KEY (`jackpot_id`) REFERENCES `jackpots` (`id`) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- --------------------------------------------------------
-- push_subscriptions
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id`          bigint(20)    NOT NULL AUTO_INCREMENT,
  `user_id`     int(11)       DEFAULT NULL,
  `endpoint`    text          NOT NULL,
  `p256dh`      varchar(512)  NOT NULL,
  `auth`        varchar(256)  NOT NULL,
  `user_agent`  varchar(500)  DEFAULT NULL,
  `created_at`  timestamp     NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_push_endpoint` (endpoint(191)),
  KEY `idx_push_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- user_preferences
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_preferences` (
  `user_id`      int(11)       NOT NULL,
  `timezone`     varchar(60)   NOT NULL DEFAULT 'UTC',
  `odds_format`  enum('decimal','fractional','american','malay','indonesian') NOT NULL DEFAULT 'decimal',
  `theme`        enum('light','dark','system') NOT NULL DEFAULT 'system',
  `language`     varchar(8)    NOT NULL DEFAULT 'en',
  `updated_at`   timestamp     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- notifications
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`          bigint(20)    NOT NULL AUTO_INCREMENT,
  `user_id`     int(11)       NOT NULL,
  `type`        varchar(50)   NOT NULL,
  `title`       varchar(200)  NOT NULL,
  `body`        text          DEFAULT NULL,
  `url`         varchar(500)  DEFAULT NULL,
  `is_read`     tinyint(1)    NOT NULL DEFAULT 0,
  `data`        longtext      CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at`  timestamp     NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user` (`user_id`),
  KEY `idx_notifications_unread` (`user_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- challenges
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `challenges` (
  `id`              bigint(20)    NOT NULL AUTO_INCREMENT,
  `challenger_id`   int(11)       NOT NULL,
  `challenged_id`   int(11)       NOT NULL,
  `match_id`        varchar(64)   DEFAULT NULL,
  `challenger_pick` varchar(4)    DEFAULT NULL,
  `challenged_pick` varchar(4)    DEFAULT NULL,
  `stake`           decimal(10,2) DEFAULT 0.00,
  `currency`        varchar(8)    NOT NULL DEFAULT 'KES',
  `status`          enum('pending','accepted','declined','active','settled') NOT NULL DEFAULT 'pending',
  `winner_id`       int(11)       DEFAULT NULL,
  `expires_at`      datetime      DEFAULT NULL,
  `created_at`      timestamp     NOT NULL DEFAULT current_timestamp(),
  `updated_at`      timestamp     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_challenges_challenger` (`challenger_id`),
  KEY `idx_challenges_challenged` (`challenged_id`),
  KEY `idx_challenges_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
