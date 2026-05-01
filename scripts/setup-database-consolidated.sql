-- Betcheza Database Schema - Consolidated (MySQL 8.0+)
-- This is the single source of truth for all database tables
-- Run this script to set up the complete database

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
-- Sports & Leagues
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
  current_season VARCHAR(20),
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
  UNIQUE KEY unique_league_slug (slug),
  INDEX idx_league_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sport_id INT NOT NULL,
  country_id INT,
  league_id INT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  short_name VARCHAR(10),
  logo_url VARCHAR(500),
  api_id VARCHAR(50),
  venue_name VARCHAR(200),
  venue_city VARCHAR(100),
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL,
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE SET NULL,
  UNIQUE KEY unique_team_slug (slug),
  INDEX idx_team_api (api_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Players
-- ============================================

CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  api_id VARCHAR(50),
  api_source VARCHAR(50) DEFAULT 'api-football',
  team_id INT,
  name VARCHAR(100) NOT NULL,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  display_name VARCHAR(100),
  position VARCHAR(50),
  shirt_number INT,
  nationality VARCHAR(50),
  nationality_code VARCHAR(5),
  date_of_birth DATE,
  height INT,
  weight INT,
  photo_url VARCHAR(500),
  goals INT DEFAULT 0,
  assists INT DEFAULT 0,
  appearances INT DEFAULT 0,
  yellow_cards INT DEFAULT 0,
  red_cards INT DEFAULT 0,
  minutes_played INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  INDEX idx_player_team (team_id),
  INDEX idx_player_api (api_id, api_source),
  INDEX idx_player_goals (goals DESC),
  INDEX idx_player_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Matches
-- ============================================

CREATE TABLE IF NOT EXISTS matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  league_id INT NOT NULL,
  home_team_id INT NOT NULL,
  away_team_id INT NOT NULL,
  kickoff_time DATETIME NOT NULL,
  status ENUM('scheduled', 'live', 'halftime', 'finished', 'postponed', 'cancelled', 'extra_time', 'penalties') DEFAULT 'scheduled',
  home_score TINYINT,
  away_score TINYINT,
  ht_home_score TINYINT,
  ht_away_score TINYINT,
  ft_home_score TINYINT,
  ft_away_score TINYINT,
  et_home_score TINYINT,
  et_away_score TINYINT,
  pen_home_score TINYINT,
  pen_away_score TINYINT,
  minute INT,
  venue VARCHAR(200),
  referee VARCHAR(100),
  api_id VARCHAR(50),
  api_source VARCHAR(50) DEFAULT 'api-football',
  scraped_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE CASCADE,
  INDEX idx_match_kickoff (kickoff_time),
  INDEX idx_match_status (status),
  INDEX idx_match_league (league_id),
  INDEX idx_match_api (api_id, api_source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS match_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  minute INT NOT NULL,
  extra_minute INT,
  team_id INT,
  player_id INT,
  assist_player_id INT,
  event_type ENUM('goal', 'own_goal', 'penalty', 'missed_penalty', 'yellow_card', 'red_card', 'second_yellow', 'substitution', 'var') NOT NULL,
  detail TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
  INDEX idx_event_match (match_id),
  INDEX idx_event_type (event_type)
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

CREATE TABLE IF NOT EXISTS lineups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  team_id INT NOT NULL,
  player_id INT,
  player_name VARCHAR(100) NOT NULL,
  position VARCHAR(20),
  shirt_number TINYINT,
  grid_position VARCHAR(10),
  is_starter BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
  INDEX idx_lineup_match (match_id)
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
  api_fixture_id VARCHAR(50),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  INDEX idx_h2h_match (match_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- League Data (Standings, Top Scorers)
-- ============================================

CREATE TABLE IF NOT EXISTS league_standings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  league_id INT NOT NULL,
  season VARCHAR(10) NOT NULL,
  team_id INT NOT NULL,
  rank_position INT NOT NULL,
  played INT DEFAULT 0,
  won INT DEFAULT 0,
  drawn INT DEFAULT 0,
  lost INT DEFAULT 0,
  goals_for INT DEFAULT 0,
  goals_against INT DEFAULT 0,
  goal_difference INT DEFAULT 0,
  points INT DEFAULT 0,
  form VARCHAR(10),
  home_played INT DEFAULT 0,
  home_won INT DEFAULT 0,
  home_drawn INT DEFAULT 0,
  home_lost INT DEFAULT 0,
  away_played INT DEFAULT 0,
  away_won INT DEFAULT 0,
  away_drawn INT DEFAULT 0,
  away_lost INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  UNIQUE KEY unique_standing (league_id, season, team_id),
  INDEX idx_standing_league_season (league_id, season),
  INDEX idx_standing_rank (rank_position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS league_top_scorers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  league_id INT NOT NULL,
  season VARCHAR(10) NOT NULL,
  player_id INT NOT NULL,
  rank_position INT NOT NULL,
  goals INT DEFAULT 0,
  assists INT DEFAULT 0,
  penalty_goals INT DEFAULT 0,
  matches_played INT DEFAULT 0,
  minutes_played INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY unique_scorer (league_id, season, player_id),
  INDEX idx_scorer_league_season (league_id, season),
  INDEX idx_scorer_rank (rank_position)
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

CREATE TABLE IF NOT EXISTS outright_odds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  league_id INT NOT NULL,
  season VARCHAR(10) NOT NULL,
  team_id INT NOT NULL,
  bookmaker_id INT,
  bookmaker_name VARCHAR(100),
  odds_value DECIMAL(8, 2) NOT NULL,
  market_type VARCHAR(50) DEFAULT 'winner',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (bookmaker_id) REFERENCES bookmakers(id) ON DELETE SET NULL,
  INDEX idx_outright_league (league_id, season),
  INDEX idx_outright_team (team_id),
  INDEX idx_outright_odds (odds_value)
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
  analysis TEXT,
  ai_analysis TEXT,
  status ENUM('pending', 'won', 'lost', 'void', 'cashout') DEFAULT 'pending',
  result VARCHAR(50),
  likes_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE,
  INDEX idx_tip_user (user_id),
  INDEX idx_tip_match (match_id),
  INDEX idx_tip_status (status),
  INDEX idx_tip_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_predictions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL UNIQUE,
  prediction TEXT NOT NULL,
  confidence TINYINT NOT NULL,
  reasoning TEXT,
  result VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tip_id) REFERENCES tips(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_comment_tip (tip_id),
  INDEX idx_comment_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications: covers ALL site activity (likes, comments, replies, follows,
-- tipster posts, match starting, lineups, results, news, odds drops, broadcasts).
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200),
  content TEXT NOT NULL,
  link VARCHAR(500),
  channel ENUM('inapp','push','email') DEFAULT 'inapp',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notification_user (user_id),
  INDEX idx_notification_unread (user_id, is_read),
  INDEX idx_notification_type (type),
  INDEX idx_notification_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Follows / Notification prefs / Push & Email Subs
-- ============================================

CREATE TABLE IF NOT EXISTS team_follows (
  user_id INT NOT NULL,
  team_id VARCHAR(64) NOT NULL,
  team_name VARCHAR(200),
  team_logo VARCHAR(500),
  league_id INT,
  league_slug VARCHAR(100),
  league_name VARCHAR(200),
  sport_slug VARCHAR(40),
  country_code VARCHAR(8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, team_id),
  INDEX idx_team_follow_team (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INT NOT NULL PRIMARY KEY,
  inapp_team_updates BOOLEAN DEFAULT TRUE,
  inapp_tipster_updates BOOLEAN DEFAULT TRUE,
  email_team_updates BOOLEAN DEFAULT TRUE,
  email_tipster_updates BOOLEAN DEFAULT FALSE,
  email_daily_digest BOOLEAN DEFAULT FALSE,
  push_team_updates BOOLEAN DEFAULT FALSE,
  push_tipster_updates BOOLEAN DEFAULT FALSE,
  push_odds_alerts BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NULL,
  endpoint VARCHAR(500) NOT NULL UNIQUE,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  topics JSON,
  country_code VARCHAR(8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_push_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_subscribers (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  topics JSON,
  country_code VARCHAR(8),
  unsubscribe_token VARCHAR(64) NOT NULL UNIQUE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_sub_email (email),
  INDEX idx_email_sub_active (active)
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

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_metadata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  page_type ENUM('match', 'league', 'team', 'tipster', 'page', 'sport') NOT NULL,
  page_id VARCHAR(100),
  title VARCHAR(200),
  description TEXT,
  og_image VARCHAR(500),
  keywords TEXT,
  canonical_url VARCHAR(500),
  no_index BOOLEAN DEFAULT FALSE,
  structured_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_seo (page_type, page_id),
  INDEX idx_seo_page_type (page_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_presets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  page_type ENUM('match', 'league', 'team', 'tipster', 'page', 'sport') NOT NULL,
  title_template VARCHAR(200),
  description_template TEXT,
  keywords_template TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_preset_type (page_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
-- API Cache
-- ============================================

CREATE TABLE IF NOT EXISTS api_cache (
  cache_key VARCHAR(200) PRIMARY KEY,
  api_source VARCHAR(50) NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  data JSON NOT NULL,
  http_status INT DEFAULT 200,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cache_expires (expires_at),
  INDEX idx_cache_source (api_source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- Insert Default Data
-- ============================================

-- Default Sports
INSERT IGNORE INTO sports (id, name, slug, icon, sort_order) VALUES
(1, 'Football', 'football', 'soccer', 1),
(2, 'Basketball', 'basketball', 'basketball', 2),
(3, 'Tennis', 'tennis', 'tennis', 3),
(4, 'Cricket', 'cricket', 'cricket', 4),
(5, 'American Football', 'american-football', 'football', 5),
(6, 'Baseball', 'baseball', 'baseball', 6),
(7, 'Ice Hockey', 'ice-hockey', 'hockey', 7),
(8, 'Rugby', 'rugby', 'rugby', 8),
(27, 'MMA', 'mma', 'mma', 9),
(26, 'Boxing', 'boxing', 'boxing', 10);

-- Default Markets
INSERT IGNORE INTO markets (id, name, slug, description, sort_order) VALUES
(1, '1X2', '1x2', 'Match winner (Home/Draw/Away)', 1),
(2, 'Over/Under 2.5', 'over-under-2.5', 'Total goals over or under 2.5', 2),
(3, 'BTTS', 'btts', 'Both teams to score', 3),
(4, 'Double Chance', 'double-chance', 'Two outcomes combined', 4),
(5, 'Asian Handicap', 'asian-handicap', 'Handicap betting', 5),
(6, 'Correct Score', 'correct-score', 'Exact final score', 6),
(7, 'First Half Result', '1st-half-result', 'Result at halftime', 7),
(8, 'Draw No Bet', 'draw-no-bet', 'Winner only, stake returned on draw', 8);

-- Default Bookmakers
INSERT IGNORE INTO bookmakers (id, name, slug, affiliate_url, country_codes, sort_order) VALUES
(1, 'Bet365', 'bet365', 'https://bet365.com', 'GB,KE,NG', 1),
(2, 'Betway', 'betway', 'https://betway.com', 'GB,KE,NG,GH', 2),
(3, '1xBet', '1xbet', 'https://1xbet.com', 'KE,NG,GH', 3),
(4, 'Sportybet', 'sportybet', 'https://sportybet.com', 'KE,NG,GH', 4),
(5, 'Betika', 'betika', 'https://betika.com', 'KE', 5),
(6, 'Mozzartbet', 'mozzartbet', 'https://mozzartbet.com', 'KE,NG', 6),
(7, 'DraftKings', 'draftkings', 'https://draftkings.com', 'US', 7),
(8, 'FanDuel', 'fanduel', 'https://fanduel.com', 'US', 8);

-- Default Site Settings
INSERT IGNORE INTO site_settings (setting_key, setting_value, setting_type, description) VALUES
('site_name', 'Betcheza', 'string', 'The name of the website'),
('site_description', 'Your trusted betting tips community. Get expert predictions, track your performance, and compete with other tipsters.', 'string', 'Default meta description'),
('default_theme', 'light', 'string', 'Default theme (light/dark)'),
('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode'),
('registration_enabled', 'true', 'boolean', 'Allow new user registration'),
('email_verification', 'true', 'boolean', 'Require email verification'),
('tipsters_auto_approval', 'false', 'boolean', 'Auto-approve new tipster applications'),
('comments_moderation', 'true', 'boolean', 'Moderate comments before publishing'),
('max_predictions_per_day', '10', 'number', 'Maximum predictions per user per day'),
('min_odds_allowed', '1.2', 'number', 'Minimum odds allowed for tips'),
('max_odds_allowed', '50', 'number', 'Maximum odds allowed for tips'),
('primary_color', '#10B981', 'string', 'Primary brand color'),
('default_odds_format', 'decimal', 'string', 'Default odds format'),
('google_analytics_id', '', 'string', 'Google Analytics tracking ID'),
('facebook_pixel_id', '', 'string', 'Facebook Pixel ID'),
('api_football_key', '', 'string', 'API-Football API Key'),
('notify_new_user', 'true', 'boolean', 'Notify admin on new user registration'),
('notify_new_prediction', 'true', 'boolean', 'Notify on new predictions'),
('notify_new_comment', 'false', 'boolean', 'Notify on new comments');

-- Default SEO Presets
INSERT IGNORE INTO seo_presets (name, page_type, title_template, description_template, keywords_template, is_default) VALUES
('Match Page Default', 'match', '{homeTeam} vs {awayTeam} | {league} | Betcheza', 'Get betting tips, odds comparison, and expert predictions for {homeTeam} vs {awayTeam} in {league}. Live updates and analysis.', 'betting tips, {homeTeam}, {awayTeam}, {league}, odds, predictions', TRUE),
('League Page Default', 'league', '{leagueName} - Standings, Fixtures & Odds | Betcheza', 'View {leagueName} standings, upcoming fixtures, top scorers, and outright winner odds. Expert betting tips for {country} football.', '{leagueName}, standings, fixtures, betting tips, {country} football, odds', TRUE),
('Team Page Default', 'team', '{teamName} - Fixtures, Results & Stats | Betcheza', 'Follow {teamName} with live scores, fixtures, results, and betting tips. Get the latest odds and expert predictions.', '{teamName}, fixtures, results, betting tips, odds, predictions', TRUE),
('Sport Page Default', 'sport', '{sportName} Betting Tips & Predictions | Betcheza', 'Expert {sportName} betting tips, predictions, and odds comparison. Find the best tips from verified tipsters.', '{sportName}, betting tips, predictions, odds, tipsters', TRUE);

-- Default Admin User (password: admin123)
INSERT IGNORE INTO users (id, email, username, display_name, password_hash, role, is_verified, timezone) VALUES
(1, 'admin@betcheza.co.ke', 'admin', 'Admin', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4Ydse/BxnXMVNaQW', 'admin', TRUE, 'Africa/Nairobi');

-- ─── Community Feed ─────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_posts (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  author_name VARCHAR(120) NOT NULL,
  author_avatar VARCHAR(255),
  content TEXT NOT NULL,
  match_id VARCHAR(64),
  match_title VARCHAR(255),
  pick VARCHAR(120),
  odds DECIMAL(8,2),
  image_url VARCHAR(255),
  likes INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feed_posts_created (created_at),
  INDEX idx_feed_posts_user (user_id)
);

CREATE TABLE IF NOT EXISTS feed_comments (
  id VARCHAR(64) PRIMARY KEY,
  post_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  author_name VARCHAR(120) NOT NULL,
  author_avatar VARCHAR(255),
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feed_comments_post (post_id, created_at)
);

CREATE TABLE IF NOT EXISTS feed_post_likes (
  post_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)
);

-- ─── Auth Security: rate limiting, captcha, audit ───
CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  user_agent VARCHAR(255),
  succeeded BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason VARCHAR(120),
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_attempts_email_time (email, attempted_at),
  INDEX idx_login_attempts_ip_time (ip_address, attempted_at)
);

CREATE TABLE IF NOT EXISTS account_lockouts (
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  failure_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMP NULL,
  captcha_required BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (email, ip_address)
);

CREATE TABLE IF NOT EXISTS captcha_challenges (
  id VARCHAR(64) PRIMARY KEY,
  provider ENUM('turnstile','recaptcha','math') NOT NULL,
  expected_answer VARCHAR(120),
  ip_address VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP NULL,
  INDEX idx_captcha_expires (expires_at)
);

-- ─── Bookmarks: matches & teams a user wants to follow ───
CREATE TABLE IF NOT EXISTS user_bookmarks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  entity_type ENUM('match','team','league','tipster','player') NOT NULL,
  entity_id VARCHAR(80) NOT NULL,
  metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_entity (user_id, entity_type, entity_id),
  INDEX idx_bookmarks_user (user_id, entity_type)
);

-- ─── Match votes: "Who Will Win?" poll on each match ───
CREATE TABLE IF NOT EXISTS match_votes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  match_id VARCHAR(191) NOT NULL,
  voter_id VARCHAR(191) NOT NULL,
  pick ENUM('home','draw','away') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_match_voter (match_id, voter_id),
  KEY idx_match (match_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- End of schema
