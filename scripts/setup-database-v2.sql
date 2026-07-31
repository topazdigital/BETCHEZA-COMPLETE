-- Betcheza Database Schema v2 - Additional Tables
-- Run this AFTER setup-database.sql
-- Adds: SEO metadata, Players, API cache, League logos

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- SEO Metadata for All Pages
-- ============================================

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

-- ============================================
-- Players (for Top Scorers, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  api_id VARCHAR(50),
  api_source VARCHAR(50) DEFAULT 'manual',
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
-- League Top Scorers Cache (per season)
-- ============================================

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
-- League Standings Cache (per season)
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

-- ============================================
-- Outright Winner Odds
-- ============================================

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
-- API Response Cache
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

-- ============================================
-- Team Logo Cache (for teams without logos)
-- ============================================

CREATE TABLE IF NOT EXISTS team_logos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT UNIQUE,
  team_name VARCHAR(100) NOT NULL,
  logo_url VARCHAR(500),
  api_source VARCHAR(50),
  api_id VARCHAR(100),
  fetch_status ENUM('pending', 'found', 'not_found', 'error') DEFAULT 'pending',
  last_fetched_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  INDEX idx_team_logo_name (team_name),
  INDEX idx_team_logo_status (fetch_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Admin SEO Presets
-- ============================================

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

-- ============================================
-- Insert Default SEO Presets
-- ============================================

INSERT IGNORE INTO seo_presets (name, page_type, title_template, description_template, keywords_template, is_default) VALUES
('Match Page Default', 'match', '{homeTeam} vs {awayTeam} | {league} | Betcheza', 'Get betting tips, odds comparison, and expert predictions for {homeTeam} vs {awayTeam} in {league}. Live updates and analysis.', 'betting tips, {homeTeam}, {awayTeam}, {league}, odds, predictions', TRUE),
('League Page Default', 'league', '{leagueName} - Standings, Fixtures & Odds | Betcheza', 'View {leagueName} standings, upcoming fixtures, top scorers, and outright winner odds. Expert betting tips for {country} football.', '{leagueName}, standings, fixtures, betting tips, {country} football, odds', TRUE),
('Team Page Default', 'team', '{teamName} - Fixtures, Results & Stats | Betcheza', 'Follow {teamName} with live scores, fixtures, results, and betting tips. Get the latest odds and expert predictions.', '{teamName}, fixtures, results, betting tips, odds, predictions', TRUE),
('Sport Page Default', 'sport', '{sportName} Betting Tips & Predictions | Betcheza', 'Expert {sportName} betting tips, predictions, and odds comparison. Find the best tips from verified tipsters.', '{sportName}, betting tips, predictions, odds, tipsters', TRUE);

-- ============================================
-- Insert Default Site Settings
-- ============================================

INSERT IGNORE INTO site_settings (setting_key, setting_value, description) VALUES
('site_name', 'Betcheza', 'The name of the website'),
('site_description', 'Your trusted betting tips community. Get expert predictions, track your performance, and compete with other tipsters.', 'Default meta description'),
('default_theme', 'light', 'Default theme (light/dark)'),
('maintenance_mode', 'false', 'Enable maintenance mode'),
('registration_enabled', 'true', 'Allow new user registration'),
('email_verification', 'true', 'Require email verification'),
('tipsters_auto_approval', 'false', 'Auto-approve new tipster applications'),
('comments_moderation', 'true', 'Moderate comments before publishing'),
('max_predictions_per_day', '10', 'Maximum predictions per user per day'),
('min_odds_allowed', '1.2', 'Minimum odds allowed for tips'),
('max_odds_allowed', '50', 'Maximum odds allowed for tips'),
('primary_color', '#10B981', 'Primary brand color'),
('default_odds_format', 'decimal', 'Default odds format (decimal/fractional/american)'),
('google_analytics_id', '', 'Google Analytics tracking ID'),
('facebook_pixel_id', '', 'Facebook Pixel ID');

-- ============================================
-- Add logo_url to leagues if not exists
-- ============================================

-- Check if column exists before adding (wrapped in procedure for MySQL compatibility)
DELIMITER //
CREATE PROCEDURE AddLogoUrlToLeagues()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM information_schema.columns 
        WHERE table_name = 'leagues' AND column_name = 'logo_url'
    ) THEN
        ALTER TABLE leagues ADD COLUMN logo_url VARCHAR(500) AFTER slug;
    END IF;
END //
DELIMITER ;

CALL AddLogoUrlToLeagues();
DROP PROCEDURE IF EXISTS AddLogoUrlToLeagues;

-- ============================================
-- Add logo_url to teams if not exists
-- ============================================

DELIMITER //
CREATE PROCEDURE AddLogoUrlToTeams()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM information_schema.columns 
        WHERE table_name = 'teams' AND column_name = 'logo_url'
    ) THEN
        ALTER TABLE teams ADD COLUMN logo_url VARCHAR(500) AFTER slug;
    END IF;
END //
DELIMITER ;

CALL AddLogoUrlToTeams();
DROP PROCEDURE IF EXISTS AddLogoUrlToTeams;

SET FOREIGN_KEY_CHECKS = 1;

-- End of v2 schema
