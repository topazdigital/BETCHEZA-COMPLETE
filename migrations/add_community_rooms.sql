-- Community Rooms: topic channels for the feed
CREATE TABLE IF NOT EXISTS community_rooms (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,
  slug        VARCHAR(80) NOT NULL,
  description TEXT DEFAULT NULL,
  icon        VARCHAR(10) DEFAULT NULL,
  color       VARCHAR(40) DEFAULT NULL,
  post_count  INT NOT NULL DEFAULT 0,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_room_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default rooms
INSERT IGNORE INTO community_rooms (name, slug, description, icon, color, sort_order) VALUES
  ('General',       'general',       'General betting chat',                 '💬', 'bg-blue-500/15 text-blue-500 border-blue-500/30',    1),
  ('Football Tips', 'football',      'Football predictions & analysis',      '⚽', 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', 2),
  ('Value Bets',    'value-bets',    'High value picks & odds hunting',      '🎯', 'bg-amber-500/15 text-amber-600 border-amber-500/30',  3),
  ('Live Chat',     'live-chat',     'Chat during live matches',             '🔴', 'bg-rose-500/15 text-rose-500 border-rose-500/30',    4),
  ('Analysis',      'analysis',      'Deep dives, stats and breakdowns',     '📊', 'bg-purple-500/15 text-purple-600 border-purple-500/30', 5),
  ('Basketball',    'basketball',    'NBA, EuroLeague & more',               '🏀', 'bg-orange-500/15 text-orange-600 border-orange-500/30', 6),
  ('Premium Picks', 'premium',       'Top tipster premium predictions',      '👑', 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30', 7);

-- Add room_id column to feed_posts (safe — ignores if already exists via a stored procedure trick)
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS room_id INT DEFAULT NULL;
ALTER TABLE feed_posts ADD INDEX IF NOT EXISTS idx_fp_room_id (room_id);
