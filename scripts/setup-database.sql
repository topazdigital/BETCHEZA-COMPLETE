-- Betcheza Database Schema for MySQL 8.0+
-- Run this script to set up all tables

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- Users & Authentication
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  country_code VARCHAR(5),
  password_hash VARCHAR(255) NOT NULL,
  google_id VARCHAR(255) UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500),
  bio TEXT,
  role ENUM('user', 'tipster', 'admin') DEFAULT 'user',
  balance DECIMAL(12, 2) DEFAULT 0.00,
  timezone VARCHAR(50) DEFAULT 'UTC',
  odds_format ENUM('decimal', 'fractional', 'american') DEFAULT 'decimal',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_username (username),
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tipster_profiles (
  user_id INT PRIMARY KEY,
  win_rate DECIMAL(5, 2) DEFAULT 0.00,
  total_tips INT DEFAULT 0,
  won_tips INT DEFAULT 0,
  lost_tips INT DEFAULT 0,
  pending_tips INT DEFAULT 0,
  avg_odds DECIMAL(5, 2) DEFAULT 0.00,
  roi DECIMAL(6, 2) DEFAULT 0.00,
  streak INT DEFAULT 0,
  rank_position INT DEFAULT 0,
  followers_count INT DEFAULT 0,
  is_pro BOOLEAN DEFAULT FALSE,
  subscription_price DECIMAL(10, 2),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tipster_rank (rank_position),
  INDEX idx_tipster_roi (roi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Sports & Matches
-- ============================================

CREATE TABLE IF NOT EXISTS sports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS countries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) NOT NULL UNIQUE,
  flag_url VARCHAR(500)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leagues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sport_id INT NOT NULL,
  country_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  logo_url VARCHAR(500),
  priority INT DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  api_id VARCHAR(50),
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
  UNIQUE KEY unique_league_slug (slug),
  INDEX idx_league_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sport_id INT NOT NULL,
  country_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  logo_url VARCHAR(500),
  api_id VARCHAR(50),
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
  UNIQUE KEY unique_team_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  league_id INT NOT NULL,
  home_team_id INT NOT NULL,
  away_team_id INT NOT NULL,
  kickoff_time DATETIME NOT NULL,
  status ENUM('scheduled', 'live', 'halftime', 'finished', 'postponed', 'cancelled') DEFAULT 'scheduled',
  home_score TINYINT,
  away_score TINYINT,
  ht_score VARCHAR(10),
  minute INT,
  api_id VARCHAR(50),
  scraped_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE CASCADE,
  INDEX idx_match_kickoff (kickoff_time),
  INDEX idx_match_status (status),
  INDEX idx_match_league (league_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Odds & Bookmakers
-- ============================================

CREATE TABLE IF NOT EXISTS bookmakers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  logo_url VARCHAR(500),
  affiliate_url VARCHAR(500),
  country_codes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS markets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  sort_order INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS odds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  bookmaker_id INT NOT NULL,
  market_id INT NOT NULL,
  selection VARCHAR(50) NOT NULL,
  value DECIMAL(6, 2) NOT NULL,
  is_best BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (bookmaker_id) REFERENCES bookmakers(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE,
  INDEX idx_odds_match (match_id),
  INDEX idx_odds_best (is_best)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Match Stats & Lineups
-- ============================================

CREATE TABLE IF NOT EXISTS lineups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  team_id INT NOT NULL,
  player_name VARCHAR(100) NOT NULL,
  position VARCHAR(20),
  shirt_number TINYINT,
  is_starter BOOLEAN DEFAULT TRUE,
  lineup_type ENUM('confirmed', 'possible', 'predicted') DEFAULT 'possible',
  player_headshot VARCHAR(500),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  INDEX idx_lineup_match (match_id),
  INDEX idx_lineup_type (lineup_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS match_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  stat_type VARCHAR(50) NOT NULL,
  home_value VARCHAR(20),
  away_value VARCHAR(20),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  INDEX idx_stats_match (match_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS h2h_matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  h2h_date DATE NOT NULL,
  home_team_id INT NOT NULL,
  away_team_id INT NOT NULL,
  home_score TINYINT,
  away_score TINYINT,
  competition VARCHAR(100),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  INDEX idx_h2h_match (match_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tips & Predictions
-- ============================================

CREATE TABLE IF NOT EXISTS tips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  match_id INT NOT NULL,
  market_id INT NOT NULL,
  selection VARCHAR(50) NOT NULL,
  odds_value DECIMAL(6, 2) NOT NULL,
  stake TINYINT DEFAULT 1,
  confidence TINYINT DEFAULT 50,
  analysis TEXT,
  ai_analysis TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  status ENUM('pending', 'won', 'lost', 'void', 'cashout') DEFAULT 'pending',
  result VARCHAR(50),
  likes_count INT DEFAULT 0,
  dislikes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE,
  INDEX idx_tip_user (user_id),
  INDEX idx_tip_match (match_id),
  INDEX idx_tip_status (status),
  INDEX idx_tip_created (created_at),
  INDEX idx_tip_premium (is_premium)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NOTE: ai_predictions is defined later (richer schema) — see bottom of file.

-- ============================================
-- Social Features
-- ============================================

CREATE TABLE IF NOT EXISTS follows (
  follower_id INT NOT NULL,
  following_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_follow_following (following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tip_likes (
  user_id INT NOT NULL,
  tip_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, tip_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tip_id) REFERENCES tips(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tip_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tip_id) REFERENCES tips(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_comment_tip (tip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200),
  content TEXT NOT NULL,
  link VARCHAR(500),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notification_user (user_id),
  INDEX idx_notification_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Competitions & Leaderboards
-- ============================================

CREATE TABLE IF NOT EXISTS competitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  prize_pool DECIMAL(12, 2) DEFAULT 0.00,
  entry_fee DECIMAL(10, 2) DEFAULT 0.00,
  max_participants INT,
  status ENUM('upcoming', 'active', 'finished') DEFAULT 'upcoming',
  rules TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_competition_status (status),
  INDEX idx_competition_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS competition_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  competition_id INT NOT NULL,
  user_id INT NOT NULL,
  score DECIMAL(10, 2) DEFAULT 0.00,
  rank_position INT DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_entry (competition_id, user_id),
  FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_entry_rank (rank_position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  period ENUM('daily', 'weekly', 'monthly', 'alltime') NOT NULL,
  user_id INT NOT NULL,
  score DECIMAL(10, 2) NOT NULL,
  rank_position INT NOT NULL,
  stats JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_leaderboard_period (period),
  INDEX idx_leaderboard_rank (rank_position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Payments & Transactions
-- ============================================

CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('deposit', 'withdrawal', 'tip_donation', 'subscription', 'competition_entry', 'prize', 'refund') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'KES',
  method ENUM('mpesa', 'paypal', 'stripe', 'crypto', 'airtel', 'system') NOT NULL,
  status ENUM('pending', 'completed', 'failed', 'refunded', 'cancelled') DEFAULT 'pending',
  reference VARCHAR(100),
  external_id VARCHAR(100),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_transaction_user (user_id),
  INDEX idx_transaction_status (status),
  INDEX idx_transaction_ref (reference)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tip_donations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_user_id INT NOT NULL,
  to_user_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'KES',
  message TEXT,
  transaction_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
  INDEX idx_donation_to (to_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS withdrawals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  method ENUM('mpesa', 'paypal', 'crypto', 'bank') NOT NULL,
  account_details TEXT NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'rejected') DEFAULT 'pending',
  admin_notes TEXT,
  transaction_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
  INDEX idx_withdrawal_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscriber_id INT NOT NULL,
  tipster_id INT NOT NULL,
  plan VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'KES',
  status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  auto_renew BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (subscriber_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tipster_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_subscription_tipster (tipster_id),
  INDEX idx_subscription_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Admin & Settings
-- ============================================

CREATE TABLE IF NOT EXISTS admin_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_adminlog_admin (admin_id),
  INDEX idx_adminlog_action (action),
  INDEX idx_adminlog_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS featured_matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  position INT DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  INDEX idx_featured_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  link VARCHAR(500),
  position VARCHAR(50) DEFAULT 'home',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_banner_active (is_active),
  INDEX idx_banner_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Sessions (for custom auth)
-- ============================================

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_session_user (user_id),
  INDEX idx_session_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- AI Predictions, Chat & PWA Install Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS ai_predictions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_external_id VARCHAR(120) NOT NULL,
  sport_slug VARCHAR(50),
  home_team VARCHAR(150),
  away_team VARCHAR(150),
  prediction VARCHAR(255) NOT NULL,
  sub_prediction VARCHAR(255),
  confidence TINYINT UNSIGNED NOT NULL,
  reasoning JSON,
  source ENUM('rules', 'groq', 'openai', 'manual') DEFAULT 'rules',
  model VARCHAR(80),
  outcome ENUM('pending', 'won', 'lost', 'void') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  UNIQUE KEY ux_ai_pred_match (match_external_id, source),
  INDEX idx_ai_pred_match (match_external_id),
  INDEX idx_ai_pred_outcome (outcome),
  INDEX idx_ai_pred_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NULL,
  context_type VARCHAR(40),
  context_id VARCHAR(120),
  message_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_chat_session_user (user_id),
  INDEX idx_chat_session_active (last_active_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  role ENUM('user', 'assistant', 'system') NOT NULL,
  content TEXT NOT NULL,
  source ENUM('rules', 'groq', 'openai') DEFAULT 'rules',
  tokens_in INT,
  tokens_out INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  INDEX idx_chat_msg_session (session_id),
  INDEX idx_chat_msg_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_install_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  event ENUM('prompt_shown', 'prompt_accepted', 'prompt_dismissed', 'installed', 'opened_pwa') NOT NULL,
  platform ENUM('android', 'ios', 'desktop', 'unknown') DEFAULT 'unknown',
  user_agent TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_install_event (event),
  INDEX idx_install_user (user_id),
  INDEX idx_install_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Push Notifications & Live Activity
-- ============================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint VARCHAR(500) NOT NULL UNIQUE,
  p256dh_key VARCHAR(255) NOT NULL,
  auth_key VARCHAR(255) NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_push_user (user_id),
  INDEX idx_push_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS match_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  match_external_id VARCHAR(120) NOT NULL,
  alert_type ENUM('kickoff', 'goal', 'red_card', 'final', 'odds_drop') NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY ux_alert_user_match (user_id, match_external_id, alert_type),
  INDEX idx_alert_match (match_external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- End of schema
