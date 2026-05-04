-- ============================================================
-- Betcheza — Missing tables migration
-- Run this on your admin_betcheza MySQL database via phpMyAdmin
-- or: mysql -u <user> -p admin_betcheza < migrate-missing-tables.sql
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- --------------------------------------------------------
-- jackpots
-- Stores one row per bookmaker jackpot (SportPesa, Betika, etc.)
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
  `result`          longtext      CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
                    CHECK (json_valid(`result`)),
  `created_at`      timestamp     NOT NULL DEFAULT current_timestamp(),
  `updated_at`      timestamp     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `jackpots`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_jackpots_status` (`status`),
  ADD KEY `idx_jackpots_bookmaker` (`bookmaker_slug`),
  ADD KEY `idx_jackpots_deadline` (`deadline`);

-- --------------------------------------------------------
-- jackpot_games
-- One row per match within a jackpot (up to 17 games)
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
  `created_at`     timestamp     NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `jackpot_games`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_jackpot_games_jackpot` (`jackpot_id`),
  ADD KEY `idx_jackpot_games_index` (`jackpot_id`, `game_index`);

ALTER TABLE `jackpot_games`
  ADD CONSTRAINT `fk_jackpot_games_jackpot`
    FOREIGN KEY (`jackpot_id`) REFERENCES `jackpots` (`id`) ON DELETE CASCADE;

-- --------------------------------------------------------
-- push_subscriptions
-- Web push endpoints for browser push notifications
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id`          bigint(20)    NOT NULL AUTO_INCREMENT,
  `user_id`     int(11)       DEFAULT NULL,
  `endpoint`    text          NOT NULL,
  `p256dh`      varchar(512)  NOT NULL,
  `auth`        varchar(256)  NOT NULL,
  `user_agent`  varchar(500)  DEFAULT NULL,
  `created_at`  timestamp     NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `push_subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_push_endpoint` (endpoint(191)),
  ADD KEY `idx_push_user` (`user_id`);

-- --------------------------------------------------------
-- user_preferences
-- Server-side storage for timezone, odds format etc.
-- Keeps settings in sync across devices.
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_preferences` (
  `user_id`      int(11)       NOT NULL,
  `timezone`     varchar(60)   NOT NULL DEFAULT 'UTC',
  `odds_format`  enum('decimal','fractional','american','malay','indonesian') NOT NULL DEFAULT 'decimal',
  `theme`        enum('light','dark','system') NOT NULL DEFAULT 'system',
  `language`     varchar(8)    NOT NULL DEFAULT 'en',
  `updated_at`   timestamp     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `user_preferences`
  ADD PRIMARY KEY (`user_id`);

-- --------------------------------------------------------
-- notifications
-- Per-user notification inbox
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`          bigint(20)    NOT NULL AUTO_INCREMENT,
  `user_id`     int(11)       NOT NULL,
  `type`        varchar(50)   NOT NULL,
  `title`       varchar(200)  NOT NULL,
  `body`        text          DEFAULT NULL,
  `url`         varchar(500)  DEFAULT NULL,
  `is_read`     tinyint(1)    NOT NULL DEFAULT 0,
  `data`        longtext      CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
                CHECK (json_valid(`data`)),
  `created_at`  timestamp     NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notifications_user` (`user_id`),
  ADD KEY `idx_notifications_unread` (`user_id`, `is_read`);

-- --------------------------------------------------------
-- challenges
-- Tipster vs tipster challenge system
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
  `updated_at`      timestamp     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `challenges`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_challenges_challenger` (`challenger_id`),
  ADD KEY `idx_challenges_challenged` (`challenged_id`),
  ADD KEY `idx_challenges_status` (`status`);
