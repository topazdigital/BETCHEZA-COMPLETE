-- Betcheza Database Schema - PostgreSQL Version
-- Converted from MySQL 8.0 schema

-- ============================================
-- Users & Authentication
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  country_code VARCHAR(5),
  password_hash VARCHAR(255) NOT NULL,
  google_id VARCHAR(255) UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500),
  bio TEXT,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'tipster', 'admin')),
  balance DECIMAL(12, 2) DEFAULT 0.00,
  timezone VARCHAR(50) DEFAULT 'UTC',
  odds_format VARCHAR(20) DEFAULT 'decimal' CHECK (odds_format IN ('decimal', 'fractional', 'american')),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tipster_rank ON tipster_profiles(rank_position);
CREATE INDEX IF NOT EXISTS idx_tipster_roi ON tipster_profiles(roi);

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_session_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_session_expires ON sessions(expires_at);

-- ============================================
-- Sports & Leagues
-- ============================================

CREATE TABLE IF NOT EXISTS sports (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS countries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) NOT NULL UNIQUE,
  flag_url VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS leagues (
  id SERIAL PRIMARY KEY,
  sport_id INT NOT NULL,
  country_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  logo_url VARCHAR(500),
  priority INT DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  api_id VARCHAR(50),
  current_season VARCHAR(20),
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_league_priority ON leagues(priority);

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  sport_id INT NOT NULL,
  country_id INT,
  league_id INT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  short_name VARCHAR(10),
  logo_url VARCHAR(500),
  api_id VARCHAR(50),
  venue_name VARCHAR(200),
  venue_city VARCHAR(100),
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL,
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_team_api ON teams(api_id);

-- ============================================
-- Players
-- ============================================

CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_player_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_player_api ON players(api_id, api_source);
CREATE INDEX IF NOT EXISTS idx_player_goals ON players(goals DESC);
CREATE INDEX IF NOT EXISTS idx_player_name ON players(name);

-- ============================================
-- Matches
-- ============================================

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  league_id INT NOT NULL,
  home_team_id INT NOT NULL,
  away_team_id INT NOT NULL,
  kickoff_time TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'halftime', 'finished', 'postponed', 'cancelled', 'extra_time', 'penalties')),
  home_score SMALLINT,
  away_score SMALLINT,
  ht_home_score SMALLINT,
  ht_away_score SMALLINT,
  ft_home_score SMALLINT,
  ft_away_score SMALLINT,
  et_home_score SMALLINT,
  et_away_score SMALLINT,
  pen_home_score SMALLINT,
  pen_away_score SMALLINT,
  minute INT,
  venue VARCHAR(200),
  referee VARCHAR(100),
  api_id VARCHAR(50),
  api_source VARCHAR(50) DEFAULT 'api-football',
  scraped_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_match_kickoff ON matches(kickoff_time);
CREATE INDEX IF NOT EXISTS idx_match_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_match_league ON matches(league_id);
CREATE INDEX IF NOT EXISTS idx_match_api ON matches(api_id, api_source);

CREATE TABLE IF NOT EXISTS match_events (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL,
  minute INT NOT NULL,
  extra_minute INT,
  team_id INT,
  player_id INT,
  assist_player_id INT,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('goal', 'own_goal', 'penalty', 'missed_penalty', 'yellow_card', 'red_card', 'second_yellow', 'substitution', 'var')),
  detail TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_event_match ON match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_event_type ON match_events(event_type);

CREATE TABLE IF NOT EXISTS match_stats (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL,
  stat_type VARCHAR(50) NOT NULL,
  home_value VARCHAR(20),
  away_value VARCHAR(20),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_stats_match ON match_stats(match_id);

CREATE TABLE IF NOT EXISTS lineups (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL,
  team_id INT NOT NULL,
  player_id INT,
  player_name VARCHAR(100) NOT NULL,
  position VARCHAR(20),
  shirt_number SMALLINT,
  grid_position VARCHAR(10),
  is_starter BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_lineup_match ON lineups(match_id);

CREATE TABLE IF NOT EXISTS h2h_matches (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL,
  h2h_date DATE NOT NULL,
  home_team_id INT NOT NULL,
  away_team_id INT NOT NULL,
  home_score SMALLINT,
  away_score SMALLINT,
  competition VARCHAR(100),
  api_fixture_id VARCHAR(50),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_h2h_match ON h2h_matches(match_id);

-- ============================================
-- League Data (Standings, Top Scorers)
-- ============================================

CREATE TABLE IF NOT EXISTS league_standings (
  id SERIAL PRIMARY KEY,
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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  UNIQUE (league_id, season, team_id)
);
CREATE INDEX IF NOT EXISTS idx_standing_league_season ON league_standings(league_id, season);
CREATE INDEX IF NOT EXISTS idx_standing_rank ON league_standings(rank_position);

CREATE TABLE IF NOT EXISTS league_top_scorers (
  id SERIAL PRIMARY KEY,
  league_id INT NOT NULL,
  season VARCHAR(10) NOT NULL,
  player_id INT NOT NULL,
  rank_position INT NOT NULL,
  goals INT DEFAULT 0,
  assists INT DEFAULT 0,
  penalty_goals INT DEFAULT 0,
  matches_played INT DEFAULT 0,
  minutes_played INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE (league_id, season, player_id)
);
CREATE INDEX IF NOT EXISTS idx_scorer_league_season ON league_top_scorers(league_id, season);
CREATE INDEX IF NOT EXISTS idx_scorer_rank ON league_top_scorers(rank_position);

-- ============================================
-- Odds & Bookmakers
-- ============================================

CREATE TABLE IF NOT EXISTS bookmakers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  logo_url VARCHAR(500),
  affiliate_url VARCHAR(500),
  country_codes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS markets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS odds (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL,
  bookmaker_id INT NOT NULL,
  market_id INT NOT NULL,
  selection VARCHAR(50) NOT NULL,
  value DECIMAL(6, 2) NOT NULL,
  is_best BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (bookmaker_id) REFERENCES bookmakers(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_odds_match ON odds(match_id);
CREATE INDEX IF NOT EXISTS idx_odds_best ON odds(is_best);

CREATE TABLE IF NOT EXISTS outright_odds (
  id SERIAL PRIMARY KEY,
  league_id INT NOT NULL,
  season VARCHAR(10) NOT NULL,
  team_id INT NOT NULL,
  bookmaker_id INT,
  bookmaker_name VARCHAR(100),
  odds_value DECIMAL(8, 2) NOT NULL,
  market_type VARCHAR(50) DEFAULT 'winner',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (bookmaker_id) REFERENCES bookmakers(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_outright_league ON outright_odds(league_id, season);
CREATE INDEX IF NOT EXISTS idx_outright_team ON outright_odds(team_id);
CREATE INDEX IF NOT EXISTS idx_outright_odds ON outright_odds(odds_value);

-- ============================================
-- Tips & Predictions
-- ============================================

CREATE TABLE IF NOT EXISTS tips (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  match_id INT NOT NULL,
  market_id INT NOT NULL,
  selection VARCHAR(50) NOT NULL,
  odds_value DECIMAL(6, 2) NOT NULL,
  stake SMALLINT DEFAULT 1,
  analysis TEXT,
  ai_analysis TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'void', 'cashout')),
  result VARCHAR(50),
  likes_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tip_user ON tips(user_id);
CREATE INDEX IF NOT EXISTS idx_tip_match ON tips(match_id);
CREATE INDEX IF NOT EXISTS idx_tip_status ON tips(status);
CREATE INDEX IF NOT EXISTS idx_tip_created ON tips(created_at);

CREATE TABLE IF NOT EXISTS ai_predictions (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL UNIQUE,
  prediction TEXT NOT NULL,
  confidence SMALLINT NOT NULL,
  reasoning TEXT,
  result VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

-- ============================================
-- Social Features
-- ============================================

CREATE TABLE IF NOT EXISTS follows (
  follower_id INT NOT NULL,
  following_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_follow_following ON follows(following_id);

CREATE TABLE IF NOT EXISTS tip_likes (
  user_id INT NOT NULL,
  tip_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, tip_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tip_id) REFERENCES tips(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  tip_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tip_id) REFERENCES tips(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_comment_tip ON comments(tip_id);
CREATE INDEX IF NOT EXISTS idx_comment_status ON comments(status);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200),
  content TEXT NOT NULL,
  link VARCHAR(500),
  channel VARCHAR(10) DEFAULT 'inapp' CHECK (channel IN ('inapp','push','email')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notification_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notification_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notification_created ON notifications(created_at);

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
  PRIMARY KEY (user_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_team_follow_team ON team_follows(team_id);

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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NULL,
  endpoint VARCHAR(500) NOT NULL UNIQUE,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  topics JSONB,
  country_code VARCHAR(8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS email_subscribers (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  topics JSONB,
  country_code VARCHAR(8),
  unsubscribe_token VARCHAR(64) NOT NULL UNIQUE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_email_sub_email ON email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_email_sub_active ON email_subscribers(active);

-- ============================================
-- Competitions & Leaderboards
-- ============================================

CREATE TABLE IF NOT EXISTS competitions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  prize_pool DECIMAL(12, 2) DEFAULT 0.00,
  entry_fee DECIMAL(10, 2) DEFAULT 0.00,
  max_participants INT,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'finished')),
  rules TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_competition_status ON competitions(status);
CREATE INDEX IF NOT EXISTS idx_competition_dates ON competitions(start_date, end_date);

CREATE TABLE IF NOT EXISTS competition_entries (
  id SERIAL PRIMARY KEY,
  competition_id INT NOT NULL,
  user_id INT NOT NULL,
  score DECIMAL(10, 2) DEFAULT 0.00,
  rank_position INT DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (competition_id, user_id),
  FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_entry_rank ON competition_entries(rank_position);

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id SERIAL PRIMARY KEY,
  period VARCHAR(10) NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'alltime')),
  user_id INT NOT NULL,
  score DECIMAL(10, 2) NOT NULL,
  rank_position INT NOT NULL,
  stats JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON leaderboard_snapshots(period);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard_snapshots(rank_position);

-- ============================================
-- Payments & Transactions
-- ============================================

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'tip_donation', 'subscription', 'competition_entry', 'prize', 'refund')),
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'KES',
  method VARCHAR(20) NOT NULL CHECK (method IN ('mpesa', 'paypal', 'stripe', 'crypto', 'airtel', 'system')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
  reference VARCHAR(100),
  external_id VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_transaction_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transaction_ref ON transactions(reference);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  subscriber_id INT NOT NULL,
  tipster_id INT NOT NULL,
  plan VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'KES',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  auto_renew BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (subscriber_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tipster_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_subscription_tipster ON subscriptions(tipster_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status ON subscriptions(status);

-- ============================================
-- Admin & Settings
-- ============================================

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  setting_type VARCHAR(10) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seo_metadata (
  id SERIAL PRIMARY KEY,
  page_type VARCHAR(20) NOT NULL CHECK (page_type IN ('match', 'league', 'team', 'tipster', 'page', 'sport')),
  page_id VARCHAR(100),
  title VARCHAR(200),
  description TEXT,
  og_image VARCHAR(500),
  keywords TEXT,
  canonical_url VARCHAR(500),
  no_index BOOLEAN DEFAULT FALSE,
  structured_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (page_type, page_id)
);
CREATE INDEX IF NOT EXISTS idx_seo_page_type ON seo_metadata(page_type);

CREATE TABLE IF NOT EXISTS seo_presets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  page_type VARCHAR(20) NOT NULL CHECK (page_type IN ('match', 'league', 'team', 'tipster', 'page', 'sport')),
  title_template VARCHAR(200),
  description_template TEXT,
  keywords_template TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_preset_type ON seo_presets(page_type);

CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_adminlog_admin ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_adminlog_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_adminlog_created ON admin_logs(created_at);

CREATE TABLE IF NOT EXISTS featured_matches (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL,
  position INT DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_featured_expires ON featured_matches(expires_at);

CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  link VARCHAR(500),
  position VARCHAR(50) DEFAULT 'home',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_banner_active ON banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banner_position ON banners(position);

-- ============================================
-- API Cache
-- ============================================

CREATE TABLE IF NOT EXISTS api_cache (
  cache_key VARCHAR(200) PRIMARY KEY,
  api_source VARCHAR(50) NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  data JSONB NOT NULL,
  http_status INT DEFAULT 200,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON api_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_source ON api_cache(api_source);

-- ============================================
-- Community Feed
-- ============================================

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
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created ON feed_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_feed_posts_user ON feed_posts(user_id);

CREATE TABLE IF NOT EXISTS feed_comments (
  id VARCHAR(64) PRIMARY KEY,
  post_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  author_name VARCHAR(120) NOT NULL,
  author_avatar VARCHAR(255),
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_feed_comments_post ON feed_comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS feed_post_likes (
  post_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)
);

-- ============================================
-- Auth Security
-- ============================================

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  user_agent VARCHAR(255),
  succeeded BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason VARCHAR(120),
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempted_at);

CREATE TABLE IF NOT EXISTS account_lockouts (
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  failure_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMP NULL,
  captcha_required BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email, ip_address)
);

CREATE TABLE IF NOT EXISTS captcha_challenges (
  id VARCHAR(64) PRIMARY KEY,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('turnstile','recaptcha','math')),
  expected_answer VARCHAR(120),
  ip_address VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS idx_captcha_expires ON captcha_challenges(expires_at);

-- ============================================
-- Bookmarks
-- ============================================

CREATE TABLE IF NOT EXISTS user_bookmarks (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('match','team','league','tipster','player')),
  entity_id VARCHAR(80) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON user_bookmarks(user_id, entity_type);

-- ============================================
-- Insert Default Data
-- ============================================

INSERT INTO sports (id, name, slug, icon, sort_order) VALUES
(1, 'Football', 'football', 'soccer', 1),
(2, 'Basketball', 'basketball', 'basketball', 2),
(3, 'Tennis', 'tennis', 'tennis', 3),
(4, 'Cricket', 'cricket', 'cricket', 4),
(5, 'American Football', 'american-football', 'football', 5),
(6, 'Baseball', 'baseball', 'baseball', 6),
(7, 'Ice Hockey', 'ice-hockey', 'hockey', 7),
(8, 'Rugby', 'rugby', 'rugby', 8),
(27, 'MMA', 'mma', 'mma', 9),
(26, 'Boxing', 'boxing', 'boxing', 10)
ON CONFLICT (id) DO NOTHING;

SELECT setval('sports_id_seq', (SELECT MAX(id) FROM sports));

INSERT INTO markets (id, name, slug, description, sort_order) VALUES
(1, '1X2', '1x2', 'Match winner (Home/Draw/Away)', 1),
(2, 'Over/Under 2.5', 'over-under-2.5', 'Total goals over or under 2.5', 2),
(3, 'BTTS', 'btts', 'Both teams to score', 3),
(4, 'Double Chance', 'double-chance', 'Two outcomes combined', 4),
(5, 'Asian Handicap', 'asian-handicap', 'Handicap betting', 5),
(6, 'Correct Score', 'correct-score', 'Exact final score', 6),
(7, 'First Half Result', '1st-half-result', 'Result at halftime', 7),
(8, 'Draw No Bet', 'draw-no-bet', 'Winner only, stake returned on draw', 8)
ON CONFLICT (id) DO NOTHING;

SELECT setval('markets_id_seq', (SELECT MAX(id) FROM markets));

INSERT INTO bookmakers (id, name, slug, affiliate_url, country_codes, sort_order) VALUES
(1, 'Bet365', 'bet365', 'https://bet365.com', 'GB,KE,NG', 1),
(2, 'Betway', 'betway', 'https://betway.com', 'GB,KE,NG,GH', 2),
(3, '1xBet', '1xbet', 'https://1xbet.com', 'KE,NG,GH', 3),
(4, 'Sportybet', 'sportybet', 'https://sportybet.com', 'KE,NG,GH', 4),
(5, 'Betika', 'betika', 'https://betika.com', 'KE', 5),
(6, 'Mozzartbet', 'mozzartbet', 'https://mozzartbet.com', 'KE,NG', 6),
(7, 'DraftKings', 'draftkings', 'https://draftkings.com', 'US', 7),
(8, 'FanDuel', 'fanduel', 'https://fanduel.com', 'US', 8)
ON CONFLICT (id) DO NOTHING;

SELECT setval('bookmakers_id_seq', (SELECT MAX(id) FROM bookmakers));

INSERT INTO site_settings (setting_key, setting_value, setting_type, description) VALUES
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
('notify_new_comment', 'false', 'boolean', 'Notify on new comments')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO seo_presets (name, page_type, title_template, description_template, keywords_template, is_default) VALUES
('Match Page Default', 'match', '{homeTeam} vs {awayTeam} | {league} | Betcheza', 'Get betting tips, odds comparison, and expert predictions for {homeTeam} vs {awayTeam} in {league}. Live updates and analysis.', 'betting tips, {homeTeam}, {awayTeam}, {league}, odds, predictions', TRUE),
('League Page Default', 'league', '{leagueName} - Standings, Fixtures & Odds | Betcheza', 'View {leagueName} standings, upcoming fixtures, top scorers, and outright winner odds. Expert betting tips for {country} football.', '{leagueName}, standings, fixtures, betting tips, {country} football, odds', TRUE),
('Team Page Default', 'team', '{teamName} - Fixtures, Results & Stats | Betcheza', 'Follow {teamName} with live scores, fixtures, results, and betting tips. Get the latest odds and expert predictions.', '{teamName}, fixtures, results, betting tips, odds, predictions', TRUE),
('Sport Page Default', 'sport', '{sportName} Betting Tips & Predictions | Betcheza', 'Expert {sportName} betting tips, predictions, and odds comparison. Find the best tips from verified tipsters.', '{sportName}, betting tips, predictions, odds, tipsters', TRUE)
ON CONFLICT DO NOTHING;

-- Default Admin User (password: admin123)
INSERT INTO users (id, email, username, display_name, password_hash, role, is_verified, timezone) VALUES
(1, 'admin@betcheza.co.ke', 'admin', 'Admin', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4Ydse/BxnXMVNaQW', 'admin', TRUE, 'Africa/Nairobi')
ON CONFLICT (id) DO NOTHING;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
