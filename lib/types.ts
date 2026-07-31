// ============================================
// Betcheza - TypeScript Types
// ============================================

// User & Auth Types
export type UserRole = 'user' | 'tipster' | 'admin';
export type OddsFormat = 'decimal' | 'fractional' | 'american';

export interface User {
  id: number;
  email: string;
  phone: string | null;
  country_code: string | null;
  password_hash: string;
  google_id: string | null;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  balance: number;
  timezone: string;
  odds_format: OddsFormat;
  is_verified: boolean;
  created_at: Date;
}

export interface TipsterProfile {
  user_id: number;
  win_rate: number;
  total_tips: number;
  won_tips: number;
  lost_tips: number;
  pending_tips: number;
  avg_odds: number;
  roi: number;
  streak: number;
  rank: number;
  followers_count: number;
  is_pro: boolean;
  subscription_price: number | null;
}

export interface UserWithProfile extends User {
  tipster_profile?: TipsterProfile;
}

// Match & Sports Types
export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed' | 'cancelled';

export interface Sport {
  id: number;
  name: string;
  slug: string;
  icon: string;
}

export interface Country {
  id: number;
  name: string;
  code: string;
  flag_url: string | null;
}

export interface League {
  id: number;
  sport_id: number;
  country_id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  priority: number;
}

export interface Team {
  id: number;
  sport_id: number;
  country_id: number;
  name: string;
  slug: string;
  logo_url: string | null;
}

export interface Match {
  id: number;
  league_id: number;
  home_team_id: number;
  away_team_id: number;
  kickoff_time: Date;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  ht_score: string | null;
  api_id: string | null;
  scraped_at: Date | null;
}

export interface MatchWithDetails extends Match {
  league: League;
  home_team: Team;
  away_team: Team;
  country?: Country;
  tips_count?: number;
  minute?: number;
  period?: string;
}

// Odds & Markets Types
export interface Bookmaker {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  affiliate_url: string | null;
  country_codes: string | null;
}

export interface Market {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

export interface Odds {
  id: number;
  match_id: number;
  bookmaker_id: number;
  market_id: number;
  selection: string;
  value: number;
  is_best: boolean;
}

export interface OddsWithBookmaker extends Odds {
  bookmaker: Bookmaker;
  market: Market;
}

// Lineup & Stats Types
export interface Lineup {
  id: number;
  match_id: number;
  team_id: number;
  player_name: string;
  position: string;
  is_starter: boolean;
}

export interface MatchStats {
  id: number;
  match_id: number;
  stat_type: string;
  home_value: string;
  away_value: string;
}

export interface H2HMatch {
  id: number;
  match_id: number;
  related_match_id: number;
  result: string;
}

// Tips & Predictions Types
export type TipStatus = 'pending' | 'won' | 'lost' | 'void' | 'cashout';

export interface Tip {
  id: number;
  user_id: number;
  match_id: number;
  market_id: number;
  selection: string;
  odds_value: number;
  stake: number;
  analysis: string | null;
  ai_analysis: string | null;
  status: TipStatus;
  result: string | null;
  created_at: Date;
}

export interface TipWithDetails extends Tip {
  user: Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  match: MatchWithDetails;
  market: Market;
  tipster_profile?: Pick<TipsterProfile, 'win_rate' | 'roi' | 'rank'>;
}

export interface AIPrediction {
  id: number;
  match_id: number;
  prediction: string;
  confidence: number;
  reasoning: string;
  result: string | null;
  created_at: Date;
}

// Social Types
export interface Follow {
  follower_id: number;
  following_id: number;
  created_at: Date;
}

export interface TipLike {
  user_id: number;
  tip_id: number;
  created_at: Date;
}

export interface Comment {
  id: number;
  tip_id: number;
  user_id: number;
  content: string;
  created_at: Date;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  content: string;
  is_read: boolean;
  created_at: Date;
}

// Competition Types
export type CompetitionStatus = 'upcoming' | 'active' | 'finished';

export interface Competition {
  id: number;
  name: string;
  description: string | null;
  start_date: Date;
  end_date: Date;
  prize_pool: number;
  entry_fee: number;
  max_participants: number;
  status: CompetitionStatus;
}

export interface CompetitionEntry {
  id: number;
  competition_id: number;
  user_id: number;
  score: number;
  rank: number;
  joined_at: Date;
}

export interface LeaderboardSnapshot {
  id: number;
  period: string;
  user_id: number;
  score: number;
  rank: number;
  created_at: Date;
}

// Payment Types
export type TransactionType = 'deposit' | 'withdrawal' | 'tip_donation' | 'subscription' | 'competition_entry' | 'prize';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'mpesa' | 'paypal' | 'stripe' | 'crypto' | 'airtel';

export interface Transaction {
  id: number;
  user_id: number;
  type: TransactionType;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: TransactionStatus;
  reference: string | null;
  metadata: string | null;
  created_at: Date;
}

export interface TipDonation {
  id: number;
  from_user_id: number;
  to_user_id: number;
  amount: number;
  currency: string;
  message: string | null;
  created_at: Date;
}

export interface Withdrawal {
  id: number;
  user_id: number;
  amount: number;
  method: PaymentMethod;
  account_details: string;
  status: TransactionStatus;
  created_at: Date;
}

export interface Subscription {
  id: number;
  subscriber_id: number;
  tipster_id: number;
  plan: string;
  amount: number;
  status: 'active' | 'expired' | 'cancelled';
  expires_at: Date;
}

// Admin Types
export interface AdminLog {
  id: number;
  admin_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string | null;
  created_at: Date;
}

export interface SiteSetting {
  key: string;
  value: string;
  updated_at: Date;
}

export interface FeaturedMatch {
  id: number;
  match_id: number;
  position: number;
  expires_at: Date;
}

export interface Banner {
  id: number;
  title: string;
  image_url: string;
  link: string | null;
  position: string;
  is_active: boolean;
  created_at: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Auth Types
export interface AuthPayload {
  userId: number;
  email: string;
  role: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  phone?: string;
  country_code?: string;
  password: string;
  username: string;
  display_name: string;
}

// Leaderboard Types
export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'alltime';

export interface LeaderboardEntry {
  rank: number;
  user: Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  tipster_profile: Pick<TipsterProfile, 'win_rate' | 'roi' | 'total_tips' | 'won_tips' | 'streak'>;
  score: number;
}

// Form Types
export interface TipFormData {
  match_id: number;
  market_id: number;
  selection: string;
  odds_value: number;
  stake: number;
  analysis?: string;
}

// Filter Types
export interface MatchFilters {
  sport_id?: number;
  league_id?: number;
  country_id?: number;
  status?: MatchStatus | MatchStatus[];
  date?: string;
  from_date?: string;
  to_date?: string;
}

export interface TipFilters {
  user_id?: number;
  match_id?: number;
  status?: TipStatus;
  from_date?: string;
  to_date?: string;
}
