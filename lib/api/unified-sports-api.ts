// ============================================
// Unified Sports API Service - EXPANDED
// Combines ESPN (FREE), The Odds API, and more
// ============================================

import { ALL_SPORTS, ALL_LEAGUES, type LeagueConfig } from '@/lib/sports-data';
import { fetchTSDBMatches } from './the-sports-db';
import { fetchOpenLigaDBMatches } from './openligadb';
import { fetchFootballDataOrgMatches } from './football-data-org';
import { fetchFotMobMatches } from './fotmob';

// ============================================
// Types
// ============================================

export interface UnifiedMatch {
  id: string;
  externalId?: string;
  source: 'espn' | 'the-odds-api' | 'sportsdata-io' | 'odds-api-io' | 'fallback';
  sportId: number;
  sportKey: string;
  leagueId: number;
  leagueKey: string;
  homeTeam: {
    id: string;
    name: string;
    shortName: string;
    logo?: string;
    form?: string;
    record?: string;
  };
  awayTeam: {
    id: string;
    name: string;
    shortName: string;
    logo?: string;
    form?: string;
    record?: string;
  };
  kickoffTime: Date;
  status: 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed' | 'cancelled';
  homeScore: number | null;
  awayScore: number | null;
  minute?: number;
  period?: string;
  league: {
    id: number;
    name: string;
    slug: string;
    country: string;
    countryCode: string;
    tier: number;
  };
  sport: {
    id: number;
    name: string;
    slug: string;
    icon: string;
  };
  odds?: MatchOdds;
  markets?: Market[];
  tipsCount: number;
  venue?: string;
  // Sport-specific statistics
  sportSpecificData?: SportSpecificData;
}

// Sport-specific statistics types
export interface SportSpecificData {
  // Soccer
  possession?: { home: number; away: number };
  shots?: { home: number; away: number };
  shotsOnTarget?: { home: number; away: number };
  corners?: { home: number; away: number };
  fouls?: { home: number; away: number };
  yellowCards?: { home: number; away: number };
  redCards?: { home: number; away: number };
  
  // Basketball
  quarters?: { home: number[]; away: number[] };
  rebounds?: { home: number; away: number };
  assists?: { home: number; away: number };
  steals?: { home: number; away: number };
  blocks?: { home: number; away: number };
  turnovers?: { home: number; away: number };
  fieldGoalPct?: { home: number; away: number };
  threePointPct?: { home: number; away: number };
  freeThrowPct?: { home: number; away: number };
  
  // American Football
  passingYards?: { home: number; away: number };
  rushingYards?: { home: number; away: number };
  totalYards?: { home: number; away: number };
  firstDowns?: { home: number; away: number };
  thirdDownConv?: { home: string; away: string };
  timeOfPossession?: { home: string; away: string };
  sacks?: { home: number; away: number };
  interceptions?: { home: number; away: number };
  fumbles?: { home: number; away: number };
  
  // Tennis
  sets?: { home: number[]; away: number[] };
  aces?: { home: number; away: number };
  doubleFaults?: { home: number; away: number };
  firstServePct?: { home: number; away: number };
  breakPoints?: { home: string; away: string };
  winners?: { home: number; away: number };
  unforcedErrors?: { home: number; away: number };
  
  // MMA/Boxing
  round?: number;
  totalRounds?: number;
  method?: string; // KO, Submission, Decision
  strikes?: { home: number; away: number };
  takedowns?: { home: number; away: number };
  significantStrikes?: { home: number; away: number };
  
  // Ice Hockey
  powerPlayGoals?: { home: number; away: number };
  penaltyMinutes?: { home: number; away: number };
  faceoffWins?: { home: number; away: number };
  hitsCount?: { home: number; away: number };
  blockedShots?: { home: number; away: number };
  
  // Baseball
  hits?: { home: number; away: number };
  errors?: { home: number; away: number };
  innings?: { home: number[]; away: number[] };
  strikeouts?: { home: number; away: number };
  walks?: { home: number; away: number };
  homeRuns?: { home: number; away: number };
  
  // Cricket
  overs?: { home: string; away: string };
  wickets?: { home: number; away: number };
  runRate?: { home: number; away: number };
  extras?: { home: number; away: number };
  
  // F1/Racing
  lapTimes?: string[];
  positions?: { driver: string; position: number; gap: string }[];
  pitStops?: number;
  fastestLap?: string;
  
  // Golf
  scores?: { player: string; total: number; today: number; thru: string }[];
  leaderboard?: boolean;
}

export interface MatchOdds {
  home: number;
  draw?: number;
  away: number;
  bookmaker?: string;
  lastUpdate?: Date;
}

export interface Market {
  key: string;
  name: string;
  outcomes: Outcome[];
}

export interface Outcome {
  name: string;
  price: number;
  point?: number;
}

export interface Standing {
  position: number;
  team: {
    id: string;
    name: string;
    logo?: string;
  };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form?: string[];
}

export interface Outright {
  id: string;
  name: string;
  outcomes: {
    name: string;
    price: number;
    /** Optional deeplink to the bookmaker's bet slip (SGO only). */
    link?: string;
  }[];
}

// ============================================
// ESPN League Configuration - COMPREHENSIVE
// ============================================

interface ESPNLeagueConfig {
  sport: string;
  league: string;
  sportId: number;
  leagueId: number;
  leagueName: string;
  country: string;
  countryCode: string;
  sportType: 'soccer' | 'basketball' | 'football' | 'baseball' | 'hockey' | 'mma' | 'tennis' | 'cricket' | 'rugby' | 'golf' | 'racing';
}

// ESPN supports these leagues - all FREE, no API key needed
const ESPN_LEAGUES: ESPNLeagueConfig[] = [
  // SOCCER - European Top Leagues
  { sport: 'soccer', league: 'eng.1', sportId: 1, leagueId: 1, leagueName: 'Premier League', country: 'England', countryCode: 'GB-ENG', sportType: 'soccer' },
  { sport: 'soccer', league: 'esp.1', sportId: 1, leagueId: 2, leagueName: 'La Liga', country: 'Spain', countryCode: 'ES', sportType: 'soccer' },
  { sport: 'soccer', league: 'ger.1', sportId: 1, leagueId: 3, leagueName: 'Bundesliga', country: 'Germany', countryCode: 'DE', sportType: 'soccer' },
  { sport: 'soccer', league: 'ita.1', sportId: 1, leagueId: 4, leagueName: 'Serie A', country: 'Italy', countryCode: 'IT', sportType: 'soccer' },
  { sport: 'soccer', league: 'fra.1', sportId: 1, leagueId: 5, leagueName: 'Ligue 1', country: 'France', countryCode: 'FR', sportType: 'soccer' },
  { sport: 'soccer', league: 'ned.1', sportId: 1, leagueId: 6, leagueName: 'Eredivisie', country: 'Netherlands', countryCode: 'NL', sportType: 'soccer' },
  { sport: 'soccer', league: 'por.1', sportId: 1, leagueId: 7, leagueName: 'Primeira Liga', country: 'Portugal', countryCode: 'PT', sportType: 'soccer' },
  { sport: 'soccer', league: 'sco.1', sportId: 1, leagueId: 8, leagueName: 'Scottish Premiership', country: 'Scotland', countryCode: 'GB-SCT', sportType: 'soccer' },
  { sport: 'soccer', league: 'bel.1', sportId: 1, leagueId: 16, leagueName: 'Belgian Pro League', country: 'Belgium', countryCode: 'BE', sportType: 'soccer' },
  { sport: 'soccer', league: 'tur.1', sportId: 1, leagueId: 15, leagueName: 'Turkish Super Lig', country: 'Turkey', countryCode: 'TR', sportType: 'soccer' },
  
  // SOCCER - European Competitions
  { sport: 'soccer', league: 'uefa.champions', sportId: 1, leagueId: 9, leagueName: 'Champions League', country: 'Europe', countryCode: 'EU', sportType: 'soccer' },
  { sport: 'soccer', league: 'uefa.europa', sportId: 1, leagueId: 10, leagueName: 'Europa League', country: 'Europe', countryCode: 'EU', sportType: 'soccer' },
  { sport: 'soccer', league: 'uefa.europa.conf', sportId: 1, leagueId: 26, leagueName: 'Conference League', country: 'Europe', countryCode: 'EU', sportType: 'soccer' },
  
  // SOCCER - Americas
  { sport: 'soccer', league: 'usa.1', sportId: 1, leagueId: 11, leagueName: 'MLS', country: 'USA', countryCode: 'US', sportType: 'soccer' },
  { sport: 'soccer', league: 'bra.1', sportId: 1, leagueId: 12, leagueName: 'Brazilian Serie A', country: 'Brazil', countryCode: 'BR', sportType: 'soccer' },
  { sport: 'soccer', league: 'arg.1', sportId: 1, leagueId: 13, leagueName: 'Argentine Primera', country: 'Argentina', countryCode: 'AR', sportType: 'soccer' },
  { sport: 'soccer', league: 'mex.1', sportId: 1, leagueId: 27, leagueName: 'Liga MX', country: 'Mexico', countryCode: 'MX', sportType: 'soccer' },
  { sport: 'soccer', league: 'conmebol.libertadores', sportId: 1, leagueId: 25, leagueName: 'Copa Libertadores', country: 'South America', countryCode: 'SA', sportType: 'soccer' },
  
  // SOCCER - Asia & Others
  { sport: 'soccer', league: 'aus.1', sportId: 1, leagueId: 20, leagueName: 'A-League', country: 'Australia', countryCode: 'AU', sportType: 'soccer' },
  { sport: 'soccer', league: 'jpn.1', sportId: 1, leagueId: 18, leagueName: 'J League', country: 'Japan', countryCode: 'JP', sportType: 'soccer' },
  { sport: 'soccer', league: 'chn.1', sportId: 1, leagueId: 28, leagueName: 'Chinese Super League', country: 'China', countryCode: 'CN', sportType: 'soccer' },
  { sport: 'soccer', league: 'sau.1', sportId: 1, leagueId: 14, leagueName: 'Saudi Pro League', country: 'Saudi Arabia', countryCode: 'SA', sportType: 'soccer' },
  { sport: 'soccer', league: 'kor.1', sportId: 1, leagueId: 32, leagueName: 'K League 1', country: 'South Korea', countryCode: 'KR', sportType: 'soccer' },
  { sport: 'soccer', league: 'idn.1', sportId: 1, leagueId: 33, leagueName: 'Liga 1 Indonesia', country: 'Indonesia', countryCode: 'ID', sportType: 'soccer' },
  { sport: 'soccer', league: 'tha.1', sportId: 1, leagueId: 34, leagueName: 'Thai League 1', country: 'Thailand', countryCode: 'TH', sportType: 'soccer' },
  { sport: 'soccer', league: 'mys.1', sportId: 1, leagueId: 35, leagueName: 'Malaysia Super League', country: 'Malaysia', countryCode: 'MY', sportType: 'soccer' },
  { sport: 'soccer', league: 'are.1', sportId: 1, leagueId: 36, leagueName: 'UAE Pro League', country: 'UAE', countryCode: 'AE', sportType: 'soccer' },
  { sport: 'soccer', league: 'qat.1', sportId: 1, leagueId: 37, leagueName: 'Qatar Stars League', country: 'Qatar', countryCode: 'QA', sportType: 'soccer' },
  { sport: 'soccer', league: 'irn.1', sportId: 1, leagueId: 38, leagueName: 'Persian Gulf Pro League', country: 'Iran', countryCode: 'IR', sportType: 'soccer' },
  { sport: 'soccer', league: 'isr.1', sportId: 1, leagueId: 39, leagueName: 'Israeli Premier League', country: 'Israel', countryCode: 'IL', sportType: 'soccer' },
  { sport: 'soccer', league: 'ind.1', sportId: 1, leagueId: 40, leagueName: 'Indian Super League', country: 'India', countryCode: 'IN', sportType: 'soccer' },

  // SOCCER - Lower European Divisions
  { sport: 'soccer', league: 'eng.2', sportId: 1, leagueId: 41, leagueName: 'EFL Championship', country: 'England', countryCode: 'GB-ENG', sportType: 'soccer' },
  { sport: 'soccer', league: 'eng.3', sportId: 1, leagueId: 42, leagueName: 'EFL League One', country: 'England', countryCode: 'GB-ENG', sportType: 'soccer' },
  { sport: 'soccer', league: 'eng.4', sportId: 1, leagueId: 43, leagueName: 'EFL League Two', country: 'England', countryCode: 'GB-ENG', sportType: 'soccer' },
  { sport: 'soccer', league: 'eng.fa', sportId: 1, leagueId: 44, leagueName: 'FA Cup', country: 'England', countryCode: 'GB-ENG', sportType: 'soccer' },
  { sport: 'soccer', league: 'eng.league_cup', sportId: 1, leagueId: 45, leagueName: 'EFL Cup', country: 'England', countryCode: 'GB-ENG', sportType: 'soccer' },
  { sport: 'soccer', league: 'esp.2', sportId: 1, leagueId: 46, leagueName: 'La Liga 2', country: 'Spain', countryCode: 'ES', sportType: 'soccer' },
  { sport: 'soccer', league: 'esp.copa_del_rey', sportId: 1, leagueId: 47, leagueName: 'Copa del Rey', country: 'Spain', countryCode: 'ES', sportType: 'soccer' },
  { sport: 'soccer', league: 'ger.2', sportId: 1, leagueId: 48, leagueName: '2. Bundesliga', country: 'Germany', countryCode: 'DE', sportType: 'soccer' },
  { sport: 'soccer', league: 'ger.dfb_pokal', sportId: 1, leagueId: 49, leagueName: 'DFB Pokal', country: 'Germany', countryCode: 'DE', sportType: 'soccer' },
  { sport: 'soccer', league: 'ita.2', sportId: 1, leagueId: 50, leagueName: 'Serie B', country: 'Italy', countryCode: 'IT', sportType: 'soccer' },
  { sport: 'soccer', league: 'ita.coppa_italia', sportId: 1, leagueId: 51, leagueName: 'Coppa Italia', country: 'Italy', countryCode: 'IT', sportType: 'soccer' },
  { sport: 'soccer', league: 'fra.2', sportId: 1, leagueId: 52, leagueName: 'Ligue 2', country: 'France', countryCode: 'FR', sportType: 'soccer' },
  { sport: 'soccer', league: 'fra.coupe_de_france', sportId: 1, leagueId: 53, leagueName: 'Coupe de France', country: 'France', countryCode: 'FR', sportType: 'soccer' },
  { sport: 'soccer', league: 'ned.2', sportId: 1, leagueId: 54, leagueName: 'Eerste Divisie', country: 'Netherlands', countryCode: 'NL', sportType: 'soccer' },
  { sport: 'soccer', league: 'por.2', sportId: 1, leagueId: 55, leagueName: 'Liga Portugal 2', country: 'Portugal', countryCode: 'PT', sportType: 'soccer' },
  { sport: 'soccer', league: 'sui.1', sportId: 1, leagueId: 56, leagueName: 'Swiss Super League', country: 'Switzerland', countryCode: 'CH', sportType: 'soccer' },
  { sport: 'soccer', league: 'aut.1', sportId: 1, leagueId: 57, leagueName: 'Austrian Bundesliga', country: 'Austria', countryCode: 'AT', sportType: 'soccer' },
  { sport: 'soccer', league: 'gre.1', sportId: 1, leagueId: 58, leagueName: 'Greek Super League', country: 'Greece', countryCode: 'GR', sportType: 'soccer' },
  { sport: 'soccer', league: 'rou.1', sportId: 1, leagueId: 59, leagueName: 'Romanian Liga I', country: 'Romania', countryCode: 'RO', sportType: 'soccer' },
  { sport: 'soccer', league: 'cze.1', sportId: 1, leagueId: 60, leagueName: 'Czech First League', country: 'Czech Republic', countryCode: 'CZ', sportType: 'soccer' },
  { sport: 'soccer', league: 'pol.1', sportId: 1, leagueId: 61, leagueName: 'Ekstraklasa', country: 'Poland', countryCode: 'PL', sportType: 'soccer' },
  { sport: 'soccer', league: 'ukr.1', sportId: 1, leagueId: 62, leagueName: 'Ukrainian Premier League', country: 'Ukraine', countryCode: 'UA', sportType: 'soccer' },
  { sport: 'soccer', league: 'rus.1', sportId: 1, leagueId: 63, leagueName: 'Russian Premier League', country: 'Russia', countryCode: 'RU', sportType: 'soccer' },
  { sport: 'soccer', league: 'den.1', sportId: 1, leagueId: 64, leagueName: 'Danish Superliga', country: 'Denmark', countryCode: 'DK', sportType: 'soccer' },
  { sport: 'soccer', league: 'swe.1', sportId: 1, leagueId: 65, leagueName: 'Allsvenskan', country: 'Sweden', countryCode: 'SE', sportType: 'soccer' },
  { sport: 'soccer', league: 'nor.1', sportId: 1, leagueId: 66, leagueName: 'Eliteserien', country: 'Norway', countryCode: 'NO', sportType: 'soccer' },
  { sport: 'soccer', league: 'fin.1', sportId: 1, leagueId: 67, leagueName: 'Veikkausliiga', country: 'Finland', countryCode: 'FI', sportType: 'soccer' },
  { sport: 'soccer', league: 'isl.1', sportId: 1, leagueId: 68, leagueName: 'Úrvalsdeild', country: 'Iceland', countryCode: 'IS', sportType: 'soccer' },
  { sport: 'soccer', league: 'irl.1', sportId: 1, leagueId: 69, leagueName: 'League of Ireland', country: 'Ireland', countryCode: 'IE', sportType: 'soccer' },
  { sport: 'soccer', league: 'wal.1', sportId: 1, leagueId: 70, leagueName: 'Cymru Premier', country: 'Wales', countryCode: 'GB-WLS', sportType: 'soccer' },
  { sport: 'soccer', league: 'srb.1', sportId: 1, leagueId: 71, leagueName: 'Serbian SuperLiga', country: 'Serbia', countryCode: 'RS', sportType: 'soccer' },
  { sport: 'soccer', league: 'hrv.1', sportId: 1, leagueId: 72, leagueName: 'HNL', country: 'Croatia', countryCode: 'HR', sportType: 'soccer' },
  { sport: 'soccer', league: 'hun.1', sportId: 1, leagueId: 73, leagueName: 'Nemzeti Bajnokság I', country: 'Hungary', countryCode: 'HU', sportType: 'soccer' },
  { sport: 'soccer', league: 'bgr.1', sportId: 1, leagueId: 74, leagueName: 'First Professional League', country: 'Bulgaria', countryCode: 'BG', sportType: 'soccer' },
  { sport: 'soccer', league: 'svk.1', sportId: 1, leagueId: 75, leagueName: 'Slovak Super Liga', country: 'Slovakia', countryCode: 'SK', sportType: 'soccer' },
  { sport: 'soccer', league: 'svn.1', sportId: 1, leagueId: 76, leagueName: 'Slovenian PrvaLiga', country: 'Slovenia', countryCode: 'SI', sportType: 'soccer' },

  // SOCCER - Americas (lower & cup)
  { sport: 'soccer', league: 'usa.open', sportId: 1, leagueId: 77, leagueName: 'US Open Cup', country: 'USA', countryCode: 'US', sportType: 'soccer' },
  { sport: 'soccer', league: 'usa.2', sportId: 1, leagueId: 78, leagueName: 'USL Championship', country: 'USA', countryCode: 'US', sportType: 'soccer' },
  { sport: 'soccer', league: 'usa.nwsl', sportId: 1, leagueId: 79, leagueName: 'NWSL', country: 'USA', countryCode: 'US', sportType: 'soccer' },
  { sport: 'soccer', league: 'usa.usl.1', sportId: 1, leagueId: 178, leagueName: 'USL League One', country: 'USA', countryCode: 'US', sportType: 'soccer' },
  { sport: 'soccer', league: 'usa.usl.cup', sportId: 1, leagueId: 179, leagueName: 'USL Jägermeister Cup', country: 'USA', countryCode: 'US', sportType: 'soccer' },
  // Women's leagues — added after users called out missing coverage.
  { sport: 'soccer', league: 'eng.w.1', sportId: 1, leagueId: 180, leagueName: 'Women\'s Super League', country: 'England', countryCode: 'GB-ENG', sportType: 'soccer' },
  { sport: 'soccer', league: 'fra.w.1', sportId: 1, leagueId: 181, leagueName: 'Première Ligue (Women)', country: 'France', countryCode: 'FR', sportType: 'soccer' },
  { sport: 'soccer', league: 'esp.w.1', sportId: 1, leagueId: 182, leagueName: 'Liga F', country: 'Spain', countryCode: 'ES', sportType: 'soccer' },
  { sport: 'soccer', league: 'ger.w.1', sportId: 1, leagueId: 183, leagueName: 'Frauen-Bundesliga', country: 'Germany', countryCode: 'DE', sportType: 'soccer' },
  { sport: 'soccer', league: 'ita.w.1', sportId: 1, leagueId: 184, leagueName: 'Serie A Women', country: 'Italy', countryCode: 'IT', sportType: 'soccer' },
  { sport: 'soccer', league: 'uefa.wchampions', sportId: 1, leagueId: 185, leagueName: 'UEFA Women\'s Champions League', country: 'Europe', countryCode: 'EU', sportType: 'soccer' },
  { sport: 'soccer', league: 'concacaf.champions_cup', sportId: 1, leagueId: 80, leagueName: 'CONCACAF Champions Cup', country: 'North America', countryCode: 'NA', sportType: 'soccer' },
  { sport: 'soccer', league: 'concacaf.gold', sportId: 1, leagueId: 81, leagueName: 'CONCACAF Gold Cup', country: 'North America', countryCode: 'NA', sportType: 'soccer' },
  { sport: 'soccer', league: 'conmebol.sudamericana', sportId: 1, leagueId: 82, leagueName: 'Copa Sudamericana', country: 'South America', countryCode: 'SA', sportType: 'soccer' },
  { sport: 'soccer', league: 'arg.copa', sportId: 1, leagueId: 83, leagueName: 'Copa Argentina', country: 'Argentina', countryCode: 'AR', sportType: 'soccer' },
  { sport: 'soccer', league: 'bra.copa_do_brazil', sportId: 1, leagueId: 84, leagueName: 'Copa do Brasil', country: 'Brazil', countryCode: 'BR', sportType: 'soccer' },
  { sport: 'soccer', league: 'bra.camp.carioca', sportId: 1, leagueId: 85, leagueName: 'Carioca State Championship', country: 'Brazil', countryCode: 'BR', sportType: 'soccer' },
  { sport: 'soccer', league: 'bra.camp.paulista', sportId: 1, leagueId: 86, leagueName: 'Paulista State Championship', country: 'Brazil', countryCode: 'BR', sportType: 'soccer' },
  { sport: 'soccer', league: 'col.1', sportId: 1, leagueId: 87, leagueName: 'Colombian Primera A', country: 'Colombia', countryCode: 'CO', sportType: 'soccer' },
  { sport: 'soccer', league: 'chi.1', sportId: 1, leagueId: 88, leagueName: 'Chilean Primera División', country: 'Chile', countryCode: 'CL', sportType: 'soccer' },
  { sport: 'soccer', league: 'per.1', sportId: 1, leagueId: 89, leagueName: 'Peruvian Liga 1', country: 'Peru', countryCode: 'PE', sportType: 'soccer' },
  { sport: 'soccer', league: 'uru.1', sportId: 1, leagueId: 90, leagueName: 'Uruguayan Primera', country: 'Uruguay', countryCode: 'UY', sportType: 'soccer' },
  { sport: 'soccer', league: 'ecu.1', sportId: 1, leagueId: 91, leagueName: 'Ecuadorian Serie A', country: 'Ecuador', countryCode: 'EC', sportType: 'soccer' },
  { sport: 'soccer', league: 'ven.1', sportId: 1, leagueId: 92, leagueName: 'Venezuelan Primera', country: 'Venezuela', countryCode: 'VE', sportType: 'soccer' },
  { sport: 'soccer', league: 'par.1', sportId: 1, leagueId: 93, leagueName: 'Paraguayan Primera', country: 'Paraguay', countryCode: 'PY', sportType: 'soccer' },
  { sport: 'soccer', league: 'bol.1', sportId: 1, leagueId: 94, leagueName: 'Bolivian Primera', country: 'Bolivia', countryCode: 'BO', sportType: 'soccer' },
  { sport: 'soccer', league: 'crc.1', sportId: 1, leagueId: 95, leagueName: 'Costa Rican Primera', country: 'Costa Rica', countryCode: 'CR', sportType: 'soccer' },

  // SOCCER - Africa
  { sport: 'soccer', league: 'rsa.1', sportId: 1, leagueId: 96, leagueName: 'South Africa Premiership', country: 'South Africa', countryCode: 'ZA', sportType: 'soccer' },
  { sport: 'soccer', league: 'egy.1', sportId: 1, leagueId: 97, leagueName: 'Egyptian Premier League', country: 'Egypt', countryCode: 'EG', sportType: 'soccer' },
  { sport: 'soccer', league: 'mar.1', sportId: 1, leagueId: 98, leagueName: 'Botola Pro', country: 'Morocco', countryCode: 'MA', sportType: 'soccer' },
  { sport: 'soccer', league: 'tun.1', sportId: 1, leagueId: 99, leagueName: 'Tunisian Ligue 1', country: 'Tunisia', countryCode: 'TN', sportType: 'soccer' },
  { sport: 'soccer', league: 'alg.1', sportId: 1, leagueId: 100, leagueName: 'Algerian Ligue 1', country: 'Algeria', countryCode: 'DZ', sportType: 'soccer' },
  { sport: 'soccer', league: 'caf.cl', sportId: 1, leagueId: 102, leagueName: 'CAF Champions League', country: 'Africa', countryCode: 'AF', sportType: 'soccer' },
  { sport: 'soccer', league: 'caf.cc', sportId: 1, leagueId: 103, leagueName: 'CAF Confederation Cup', country: 'Africa', countryCode: 'AF', sportType: 'soccer' },

  // SOCCER - Asia (Cup competitions)
  { sport: 'soccer', league: 'afc.champions', sportId: 1, leagueId: 104, leagueName: 'AFC Champions League', country: 'Asia', countryCode: 'AS', sportType: 'soccer' },
  { sport: 'soccer', league: 'afc.asian.cup', sportId: 1, leagueId: 105, leagueName: 'AFC Asian Cup', country: 'Asia', countryCode: 'AS', sportType: 'soccer' },

  // SOCCER - Friendlies / International
  { sport: 'soccer', league: 'fifa.friendly', sportId: 1, leagueId: 106, leagueName: 'International Friendly', country: 'World', countryCode: 'WO', sportType: 'soccer' },
  { sport: 'soccer', league: 'fifa.cwc', sportId: 1, leagueId: 109, leagueName: 'FIFA Club World Cup', country: 'World', countryCode: 'WO', sportType: 'soccer' },
  { sport: 'soccer', league: 'fifa.world.u20', sportId: 1, leagueId: 110, leagueName: 'FIFA U20 World Cup', country: 'World', countryCode: 'WO', sportType: 'soccer' },
  { sport: 'soccer', league: 'uefa.nations', sportId: 1, leagueId: 111, leagueName: 'UEFA Nations League', country: 'Europe', countryCode: 'EU', sportType: 'soccer' },
  { sport: 'soccer', league: 'fifa.world.qualifiers.uefa', sportId: 1, leagueId: 112, leagueName: 'World Cup Qualifying — UEFA', country: 'Europe', countryCode: 'EU', sportType: 'soccer' },
  { sport: 'soccer', league: 'fifa.world.qualifiers.concacaf', sportId: 1, leagueId: 113, leagueName: 'World Cup Qualifying — CONCACAF', country: 'North America', countryCode: 'NA', sportType: 'soccer' },
  { sport: 'soccer', league: 'fifa.world.qualifiers.conmebol', sportId: 1, leagueId: 114, leagueName: 'World Cup Qualifying — CONMEBOL', country: 'South America', countryCode: 'SA', sportType: 'soccer' },
  { sport: 'soccer', league: 'fifa.world.qualifiers.afc', sportId: 1, leagueId: 115, leagueName: 'World Cup Qualifying — AFC', country: 'Asia', countryCode: 'AS', sportType: 'soccer' },
  { sport: 'soccer', league: 'fifa.world.qualifiers.caf', sportId: 1, leagueId: 116, leagueName: 'World Cup Qualifying — CAF', country: 'Africa', countryCode: 'AF', sportType: 'soccer' },

  // SOCCER - International
  { sport: 'soccer', league: 'fifa.world', sportId: 1, leagueId: 29, leagueName: 'World Cup', country: 'World', countryCode: 'WO', sportType: 'soccer' },
  { sport: 'soccer', league: 'uefa.euro', sportId: 1, leagueId: 30, leagueName: 'Euro Championship', country: 'Europe', countryCode: 'EU', sportType: 'soccer' },
  { sport: 'soccer', league: 'conmebol.america', sportId: 1, leagueId: 31, leagueName: 'Copa America', country: 'South America', countryCode: 'SA', sportType: 'soccer' },
  { sport: 'soccer', league: 'caf.nations', sportId: 1, leagueId: 24, leagueName: 'AFCON', country: 'Africa', countryCode: 'AF', sportType: 'soccer' },
  
  // BASKETBALL
  { sport: 'basketball', league: 'nba', sportId: 2, leagueId: 101, leagueName: 'NBA', country: 'USA', countryCode: 'US', sportType: 'basketball' },
  { sport: 'basketball', league: 'wnba', sportId: 2, leagueId: 107, leagueName: 'WNBA', country: 'USA', countryCode: 'US', sportType: 'basketball' },
  { sport: 'basketball', league: 'mens-college-basketball', sportId: 2, leagueId: 108, leagueName: 'NCAA Basketball', country: 'USA', countryCode: 'US', sportType: 'basketball' },
  
  // AMERICAN FOOTBALL
  { sport: 'football', league: 'nfl', sportId: 5, leagueId: 401, leagueName: 'NFL', country: 'USA', countryCode: 'US', sportType: 'football' },
  { sport: 'football', league: 'college-football', sportId: 5, leagueId: 402, leagueName: 'NCAA Football', country: 'USA', countryCode: 'US', sportType: 'football' },
  { sport: 'football', league: 'cfl', sportId: 5, leagueId: 403, leagueName: 'CFL', country: 'Canada', countryCode: 'CA', sportType: 'football' },
  { sport: 'football', league: 'xfl', sportId: 5, leagueId: 404, leagueName: 'XFL', country: 'USA', countryCode: 'US', sportType: 'football' },
  
  // BASEBALL
  { sport: 'baseball', league: 'mlb', sportId: 6, leagueId: 501, leagueName: 'MLB', country: 'USA', countryCode: 'US', sportType: 'baseball' },
  
  // ICE HOCKEY
  { sport: 'hockey', league: 'nhl', sportId: 7, leagueId: 601, leagueName: 'NHL', country: 'USA/Canada', countryCode: 'US', sportType: 'hockey' },
  
  // MMA
  { sport: 'mma', league: 'ufc', sportId: 27, leagueId: 2701, leagueName: 'UFC', country: 'World', countryCode: 'WO', sportType: 'mma' },
  { sport: 'mma', league: 'pfl', sportId: 27, leagueId: 2702, leagueName: 'PFL', country: 'USA', countryCode: 'US', sportType: 'mma' },
  { sport: 'mma', league: 'bellator', sportId: 27, leagueId: 2703, leagueName: 'Bellator', country: 'USA', countryCode: 'US', sportType: 'mma' },
  
  // TENNIS
  { sport: 'tennis', league: 'atp', sportId: 3, leagueId: 201, leagueName: 'ATP Tour', country: 'World', countryCode: 'WO', sportType: 'tennis' },
  { sport: 'tennis', league: 'wta', sportId: 3, leagueId: 202, leagueName: 'WTA Tour', country: 'World', countryCode: 'WO', sportType: 'tennis' },
  
  // CRICKET
  { sport: 'cricket', league: 'ipl', sportId: 4, leagueId: 301, leagueName: 'IPL', country: 'India', countryCode: 'IN', sportType: 'cricket' },
  { sport: 'cricket', league: 'bbl', sportId: 4, leagueId: 302, leagueName: 'Big Bash League', country: 'Australia', countryCode: 'AU', sportType: 'cricket' },
  { sport: 'cricket', league: 'psl', sportId: 4, leagueId: 306, leagueName: 'PSL', country: 'Pakistan', countryCode: 'PK', sportType: 'cricket' },
  
  // RUGBY
  { sport: 'rugby', league: 'six-nations', sportId: 8, leagueId: 701, leagueName: 'Six Nations', country: 'Europe', countryCode: 'EU', sportType: 'rugby' },
  { sport: 'rugby', league: 'super-rugby', sportId: 8, leagueId: 703, leagueName: 'Super Rugby', country: 'Southern Hemisphere', countryCode: 'SH', sportType: 'rugby' },
  { sport: 'rugby', league: 'premiership', sportId: 8, leagueId: 704, leagueName: 'Premiership Rugby', country: 'England', countryCode: 'GB-ENG', sportType: 'rugby' },
  
  // GOLF
  { sport: 'golf', league: 'pga', sportId: 17, leagueId: 1701, leagueName: 'PGA Tour', country: 'USA', countryCode: 'US', sportType: 'golf' },
  { sport: 'golf', league: 'lpga', sportId: 17, leagueId: 1704, leagueName: 'LPGA Tour', country: 'USA', countryCode: 'US', sportType: 'golf' },
  { sport: 'golf', league: 'european-tour', sportId: 17, leagueId: 1702, leagueName: 'DP World Tour', country: 'Europe', countryCode: 'EU', sportType: 'golf' },
  
  // RACING
  { sport: 'racing', league: 'f1', sportId: 29, leagueId: 2901, leagueName: 'Formula 1', country: 'World', countryCode: 'WO', sportType: 'racing' },
  { sport: 'racing', league: 'nascar-cup', sportId: 31, leagueId: 3101, leagueName: 'NASCAR Cup Series', country: 'USA', countryCode: 'US', sportType: 'racing' },
  { sport: 'racing', league: 'indycar', sportId: 32, leagueId: 3201, leagueName: 'IndyCar', country: 'USA', countryCode: 'US', sportType: 'racing' },

  // SOCCER - Women's Top Leagues
  { sport: 'soccer', league: 'eng.w.1', sportId: 1, leagueId: 200, leagueName: "Women's Super League", country: 'England', countryCode: 'GB-ENG', sportType: 'soccer' },
  { sport: 'soccer', league: 'esp.w.1', sportId: 1, leagueId: 201, leagueName: "Liga F", country: 'Spain', countryCode: 'ES', sportType: 'soccer' },
  { sport: 'soccer', league: 'ger.w.1', sportId: 1, leagueId: 202, leagueName: "Frauen Bundesliga", country: 'Germany', countryCode: 'DE', sportType: 'soccer' },
  { sport: 'soccer', league: 'fra.w.1', sportId: 1, leagueId: 203, leagueName: "Première Ligue", country: 'France', countryCode: 'FR', sportType: 'soccer' },
  { sport: 'soccer', league: 'ita.w.1', sportId: 1, leagueId: 204, leagueName: "Serie A Femminile", country: 'Italy', countryCode: 'IT', sportType: 'soccer' },
  { sport: 'soccer', league: 'uefa.wchampions', sportId: 1, leagueId: 205, leagueName: "UEFA Women's Champions League", country: 'Europe', countryCode: 'EU', sportType: 'soccer' },
  { sport: 'soccer', league: 'fifa.wwc', sportId: 1, leagueId: 206, leagueName: "FIFA Women's World Cup", country: 'World', countryCode: 'WO', sportType: 'soccer' },
  { sport: 'soccer', league: 'uefa.weuro', sportId: 1, leagueId: 207, leagueName: "UEFA Women's Euro", country: 'Europe', countryCode: 'EU', sportType: 'soccer' },

  // SOCCER - Youth & Academy
  { sport: 'soccer', league: 'uefa.youth', sportId: 1, leagueId: 210, leagueName: 'UEFA Youth League', country: 'Europe', countryCode: 'EU', sportType: 'soccer' },
  { sport: 'soccer', league: 'fifa.world.u17', sportId: 1, leagueId: 211, leagueName: 'FIFA U17 World Cup', country: 'World', countryCode: 'WO', sportType: 'soccer' },
  { sport: 'soccer', league: 'uefa.euro.u21', sportId: 1, leagueId: 212, leagueName: 'UEFA Under 21 Championship', country: 'Europe', countryCode: 'EU', sportType: 'soccer' },

  // SOCCER - More Cups
  { sport: 'soccer', league: 'uefa.super_cup', sportId: 1, leagueId: 220, leagueName: 'UEFA Super Cup', country: 'Europe', countryCode: 'EU', sportType: 'soccer' },
  { sport: 'soccer', league: 'eng.charity', sportId: 1, leagueId: 221, leagueName: 'FA Community Shield', country: 'England', countryCode: 'GB-ENG', sportType: 'soccer' },
  { sport: 'soccer', league: 'esp.super_cup', sportId: 1, leagueId: 222, leagueName: 'Supercopa de España', country: 'Spain', countryCode: 'ES', sportType: 'soccer' },
  { sport: 'soccer', league: 'ita.super_cup', sportId: 1, leagueId: 223, leagueName: 'Supercoppa Italiana', country: 'Italy', countryCode: 'IT', sportType: 'soccer' },
  { sport: 'soccer', league: 'fra.super_cup', sportId: 1, leagueId: 224, leagueName: 'Trophée des Champions', country: 'France', countryCode: 'FR', sportType: 'soccer' },
  { sport: 'soccer', league: 'ger.super_cup', sportId: 1, leagueId: 225, leagueName: 'DFL Supercup', country: 'Germany', countryCode: 'DE', sportType: 'soccer' },
  { sport: 'soccer', league: 'ned.super_cup', sportId: 1, leagueId: 226, leagueName: 'Johan Cruijff Schaal', country: 'Netherlands', countryCode: 'NL', sportType: 'soccer' },
  { sport: 'soccer', league: 'por.super_cup', sportId: 1, leagueId: 227, leagueName: 'Supertaça Cândido de Oliveira', country: 'Portugal', countryCode: 'PT', sportType: 'soccer' },

  // SOCCER - Lower English & Scottish
  { sport: 'soccer', league: 'eng.5', sportId: 1, leagueId: 230, leagueName: 'National League', country: 'England', countryCode: 'GB-ENG', sportType: 'soccer' },
  { sport: 'soccer', league: 'sco.2', sportId: 1, leagueId: 231, leagueName: 'Scottish Championship', country: 'Scotland', countryCode: 'GB-SCT', sportType: 'soccer' },
  { sport: 'soccer', league: 'sco.fa', sportId: 1, leagueId: 232, leagueName: 'Scottish Cup', country: 'Scotland', countryCode: 'GB-SCT', sportType: 'soccer' },

  // SOCCER - More European Cups & Lower
  { sport: 'soccer', league: 'bel.cup', sportId: 1, leagueId: 240, leagueName: 'Belgian Cup', country: 'Belgium', countryCode: 'BE', sportType: 'soccer' },
  { sport: 'soccer', league: 'tur.cup', sportId: 1, leagueId: 241, leagueName: 'Turkish Cup', country: 'Turkey', countryCode: 'TR', sportType: 'soccer' },
  { sport: 'soccer', league: 'sui.cup', sportId: 1, leagueId: 242, leagueName: 'Swiss Cup', country: 'Switzerland', countryCode: 'CH', sportType: 'soccer' },
  { sport: 'soccer', league: 'aut.cup', sportId: 1, leagueId: 243, leagueName: 'Austrian Cup', country: 'Austria', countryCode: 'AT', sportType: 'soccer' },
  { sport: 'soccer', league: 'gre.cup', sportId: 1, leagueId: 244, leagueName: 'Greek Cup', country: 'Greece', countryCode: 'GR', sportType: 'soccer' },
  { sport: 'soccer', league: 'pol.cup', sportId: 1, leagueId: 245, leagueName: 'Polish Cup', country: 'Poland', countryCode: 'PL', sportType: 'soccer' },

  // SOCCER - More Africa
  { sport: 'soccer', league: 'ken.1', sportId: 1, leagueId: 250, leagueName: 'Kenyan Premier League', country: 'Kenya', countryCode: 'KE', sportType: 'soccer' },
  { sport: 'soccer', league: 'nga.1', sportId: 1, leagueId: 251, leagueName: 'Nigerian Professional Football League', country: 'Nigeria', countryCode: 'NG', sportType: 'soccer' },
  { sport: 'soccer', league: 'gha.1', sportId: 1, leagueId: 252, leagueName: 'Ghana Premier League', country: 'Ghana', countryCode: 'GH', sportType: 'soccer' },
  { sport: 'soccer', league: 'civ.1', sportId: 1, leagueId: 253, leagueName: "Côte d'Ivoire Ligue 1", country: "Côte d'Ivoire", countryCode: 'CI', sportType: 'soccer' },
  { sport: 'soccer', league: 'sen.1', sportId: 1, leagueId: 254, leagueName: 'Ligue 1 Senegal', country: 'Senegal', countryCode: 'SN', sportType: 'soccer' },
  { sport: 'soccer', league: 'cmr.1', sportId: 1, leagueId: 255, leagueName: 'Elite One', country: 'Cameroon', countryCode: 'CM', sportType: 'soccer' },
  { sport: 'soccer', league: 'tza.1', sportId: 1, leagueId: 256, leagueName: 'Ligi kuu Bara', country: 'Tanzania', countryCode: 'TZ', sportType: 'soccer' },
  { sport: 'soccer', league: 'uga.1', sportId: 1, leagueId: 257, leagueName: 'Uganda Premier League', country: 'Uganda', countryCode: 'UG', sportType: 'soccer' },
  { sport: 'soccer', league: 'zam.1', sportId: 1, leagueId: 258, leagueName: 'MTN Super League', country: 'Zambia', countryCode: 'ZM', sportType: 'soccer' },
  { sport: 'soccer', league: 'zwe.1', sportId: 1, leagueId: 259, leagueName: 'Zimbabwe Premier Soccer League', country: 'Zimbabwe', countryCode: 'ZW', sportType: 'soccer' },

  // SOCCER - More Americas / Caribbean
  { sport: 'soccer', league: 'jam.1', sportId: 1, leagueId: 260, leagueName: 'Jamaica Premier League', country: 'Jamaica', countryCode: 'JM', sportType: 'soccer' },
  { sport: 'soccer', league: 'tto.1', sportId: 1, leagueId: 261, leagueName: 'TT Premier Football League', country: 'Trinidad and Tobago', countryCode: 'TT', sportType: 'soccer' },
  { sport: 'soccer', league: 'gua.1', sportId: 1, leagueId: 262, leagueName: 'Liga Nacional de Guatemala', country: 'Guatemala', countryCode: 'GT', sportType: 'soccer' },
  { sport: 'soccer', league: 'hon.1', sportId: 1, leagueId: 263, leagueName: 'Liga Nacional de Honduras', country: 'Honduras', countryCode: 'HN', sportType: 'soccer' },
  { sport: 'soccer', league: 'pan.1', sportId: 1, leagueId: 264, leagueName: 'Liga Panameña de Fútbol', country: 'Panama', countryCode: 'PA', sportType: 'soccer' },
  { sport: 'soccer', league: 'slv.1', sportId: 1, leagueId: 265, leagueName: 'Salvadoran Primera División', country: 'El Salvador', countryCode: 'SV', sportType: 'soccer' },
  { sport: 'soccer', league: 'can.1', sportId: 1, leagueId: 266, leagueName: 'Canadian Premier League', country: 'Canada', countryCode: 'CA', sportType: 'soccer' },

  // SOCCER - More Asia
  { sport: 'soccer', league: 'jpn.2', sportId: 1, leagueId: 270, leagueName: 'J2 League', country: 'Japan', countryCode: 'JP', sportType: 'soccer' },
  { sport: 'soccer', league: 'jpn.cup', sportId: 1, leagueId: 271, leagueName: "Emperor's Cup", country: 'Japan', countryCode: 'JP', sportType: 'soccer' },
  { sport: 'soccer', league: 'kor.2', sportId: 1, leagueId: 272, leagueName: 'K League 2', country: 'South Korea', countryCode: 'KR', sportType: 'soccer' },
  { sport: 'soccer', league: 'sgp.1', sportId: 1, leagueId: 273, leagueName: 'Singapore Premier League', country: 'Singapore', countryCode: 'SG', sportType: 'soccer' },
  { sport: 'soccer', league: 'vnm.1', sportId: 1, leagueId: 274, leagueName: 'V.League 1', country: 'Vietnam', countryCode: 'VN', sportType: 'soccer' },
  { sport: 'soccer', league: 'phl.1', sportId: 1, leagueId: 275, leagueName: 'Philippines Football League', country: 'Philippines', countryCode: 'PH', sportType: 'soccer' },
  { sport: 'soccer', league: 'hkg.1', sportId: 1, leagueId: 276, leagueName: 'Hong Kong Premier League', country: 'Hong Kong', countryCode: 'HK', sportType: 'soccer' },

  // SOCCER - More Friendlies / Club International
  { sport: 'soccer', league: 'club.friendly', sportId: 1, leagueId: 280, leagueName: 'Club Friendly', country: 'World', countryCode: 'WO', sportType: 'soccer' },
  { sport: 'soccer', league: 'fifa.intercontinental', sportId: 1, leagueId: 281, leagueName: 'FIFA Intercontinental Cup', country: 'World', countryCode: 'WO', sportType: 'soccer' },

  // BASKETBALL - Europe + International
  { sport: 'basketball', league: 'fiba.euroleague', sportId: 2, leagueId: 130, leagueName: 'EuroLeague', country: 'Europe', countryCode: 'EU', sportType: 'basketball' },
  { sport: 'basketball', league: 'fiba.eurocup', sportId: 2, leagueId: 131, leagueName: 'EuroCup', country: 'Europe', countryCode: 'EU', sportType: 'basketball' },
  { sport: 'basketball', league: 'esp.acb', sportId: 2, leagueId: 132, leagueName: 'Liga ACB', country: 'Spain', countryCode: 'ES', sportType: 'basketball' },
  { sport: 'basketball', league: 'ita.lega', sportId: 2, leagueId: 133, leagueName: 'Lega Basket Serie A', country: 'Italy', countryCode: 'IT', sportType: 'basketball' },
  { sport: 'basketball', league: 'tur.bsl', sportId: 2, leagueId: 134, leagueName: 'Türkiye Sigorta BSL', country: 'Turkey', countryCode: 'TR', sportType: 'basketball' },
  { sport: 'basketball', league: 'ger.bbl', sportId: 2, leagueId: 135, leagueName: 'Basketball Bundesliga', country: 'Germany', countryCode: 'DE', sportType: 'basketball' },
  { sport: 'basketball', league: 'fra.lnb', sportId: 2, leagueId: 136, leagueName: 'LNB Pro A', country: 'France', countryCode: 'FR', sportType: 'basketball' },
  { sport: 'basketball', league: 'aus.nbl', sportId: 2, leagueId: 137, leagueName: 'NBL Australia', country: 'Australia', countryCode: 'AU', sportType: 'basketball' },
  { sport: 'basketball', league: 'fiba.world', sportId: 2, leagueId: 138, leagueName: 'FIBA World Cup', country: 'World', countryCode: 'WO', sportType: 'basketball' },
  { sport: 'basketball', league: 'womens-college-basketball', sportId: 2, leagueId: 139, leagueName: 'NCAA Women\'s Basketball', country: 'USA', countryCode: 'US', sportType: 'basketball' },

  // HOCKEY - More
  { sport: 'hockey', league: 'mens-college-hockey', sportId: 7, leagueId: 610, leagueName: 'NCAA Hockey', country: 'USA', countryCode: 'US', sportType: 'hockey' },
  { sport: 'hockey', league: 'iihf.world', sportId: 7, leagueId: 611, leagueName: 'IIHF World Championship', country: 'World', countryCode: 'WO', sportType: 'hockey' },

  // BASEBALL - More
  { sport: 'baseball', league: 'college-baseball', sportId: 6, leagueId: 510, leagueName: 'NCAA Baseball', country: 'USA', countryCode: 'US', sportType: 'baseball' },
  { sport: 'baseball', league: 'jpn.npb', sportId: 6, leagueId: 511, leagueName: 'Nippon Professional Baseball', country: 'Japan', countryCode: 'JP', sportType: 'baseball' },
  { sport: 'baseball', league: 'kor.kbo', sportId: 6, leagueId: 512, leagueName: 'KBO League', country: 'South Korea', countryCode: 'KR', sportType: 'baseball' },

  // CRICKET - More
  { sport: 'cricket', league: 'cpl', sportId: 4, leagueId: 310, leagueName: 'Caribbean Premier League', country: 'Caribbean', countryCode: 'CB', sportType: 'cricket' },
  { sport: 'cricket', league: 't20.world', sportId: 4, leagueId: 311, leagueName: 'ICC T20 World Cup', country: 'World', countryCode: 'WO', sportType: 'cricket' },
  { sport: 'cricket', league: 'odi.world', sportId: 4, leagueId: 312, leagueName: 'ICC Cricket World Cup', country: 'World', countryCode: 'WO', sportType: 'cricket' },
  { sport: 'cricket', league: 'eng.t20.blast', sportId: 4, leagueId: 313, leagueName: 'T20 Blast', country: 'England', countryCode: 'GB-ENG', sportType: 'cricket' },

  // RUGBY - More
  { sport: 'rugby', league: 'top14', sportId: 8, leagueId: 710, leagueName: 'Top 14', country: 'France', countryCode: 'FR', sportType: 'rugby' },
  { sport: 'rugby', league: 'rugby-championship', sportId: 8, leagueId: 711, leagueName: 'Rugby Championship', country: 'Southern Hemisphere', countryCode: 'SH', sportType: 'rugby' },
  { sport: 'rugby', league: 'rwc', sportId: 8, leagueId: 712, leagueName: 'Rugby World Cup', country: 'World', countryCode: 'WO', sportType: 'rugby' },
  { sport: 'rugby', league: 'urc', sportId: 8, leagueId: 713, leagueName: 'United Rugby Championship', country: 'Europe', countryCode: 'EU', sportType: 'rugby' },

  // GOLF - More
  { sport: 'golf', league: 'champions-tour', sportId: 17, leagueId: 1710, leagueName: 'PGA Champions Tour', country: 'USA', countryCode: 'US', sportType: 'golf' },
  { sport: 'golf', league: 'liv', sportId: 17, leagueId: 1711, leagueName: 'LIV Golf', country: 'World', countryCode: 'WO', sportType: 'golf' },

  // RACING - More
  { sport: 'racing', league: 'f2', sportId: 29, leagueId: 2910, leagueName: 'Formula 2', country: 'World', countryCode: 'WO', sportType: 'racing' },
  { sport: 'racing', league: 'motogp', sportId: 29, leagueId: 2911, leagueName: 'MotoGP', country: 'World', countryCode: 'WO', sportType: 'racing' },
  { sport: 'racing', league: 'nascar-xfinity', sportId: 31, leagueId: 3110, leagueName: 'NASCAR Xfinity', country: 'USA', countryCode: 'US', sportType: 'racing' },
];

// ============================================
// Cache Configuration
// ============================================

const CACHE_DURATION = {
  live: 15 * 1000, // 15 seconds for live data
  upcoming: 2 * 60 * 1000, // 2 minutes for upcoming
  standings: 15 * 60 * 1000, // 15 minutes for standings
  outrights: 30 * 60 * 1000, // 30 minutes for outrights
};

const cache = new Map<string, { data: unknown; timestamp: number }>();

function getCached<T>(key: string, duration: number): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < duration) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ============================================
// API Status Tracking
// ============================================

const apiStatus = {
  espn: { working: true, lastError: '', lastCheck: 0 },
  theOddsApi: { working: false, lastError: '', lastCheck: 0 },
  sportsDataIo: { working: true, lastError: '', lastCheck: 0 },
  oddsApiIo: { working: false, lastError: '', lastCheck: 0 },
};

export function getApiStatus() {
  return apiStatus;
}

// ============================================
// ESPN API Client (FREE - Primary Source)
// ============================================

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';

interface ESPNEvent {
  id: string;
  name: string;
  shortName: string;
  date: string;
  status: {
    type: {
      id: string;
      name: string;
      state: string;
      completed: boolean;
      description: string;
      detail?: string;
      shortDetail?: string;
    };
    period?: number;
    displayClock?: string;
    clock?: number;
  };
  competitions: Array<{
    id: string;
    competitors: Array<{
      id: string;
      team?: {
        id: string;
        name: string;
        abbreviation: string;
        displayName: string;
        logo?: string;
      };
      athlete?: {
        id: string;
        displayName: string;
        shortName?: string;
      };
      homeAway: 'home' | 'away';
      score?: string;
      form?: string;
      records?: Array<{ summary?: string; type?: string }>;
      statistics?: Array<{
        name: string;
        displayValue: string;
      }>;
      linescores?: Array<{
        value: number;
      }>;
    }>;
    status?: {
      clock?: number;
      displayClock?: string;
      period?: number;
    };
  }>;
}

interface ESPNScoreboardResponse {
  events: ESPNEvent[];
  leagues?: Array<{
    id: string;
    name: string;
    abbreviation: string;
  }>;
}

// Build reverse lookup: slugified league key (e.g. "eng1") -> ESPNLeagueConfig
const ESPN_LEAGUE_BY_SLUG = new Map<string, ESPNLeagueConfig>();
for (const cfg of ESPN_LEAGUES) {
  ESPN_LEAGUE_BY_SLUG.set(cfg.league.replace(/[^a-z0-9]/gi, ''), cfg);
}
export function getEspnLeagueConfigForId(matchId: string): ESPNLeagueConfig | null {
  // Match `espn_<league>_<eventId>` where <league> may contain dots
  // (e.g. "ita.1", "uefa.champions", "conmebol.libertadores").
  const m = matchId.match(/^espn_([a-z0-9.]+)_(\d+)$/i);
  if (!m) return null;
  // Try the slugified key first (no dots), then the raw key.
  const slug = m[1].replace(/[^a-z0-9]/gi, '');
  return ESPN_LEAGUE_BY_SLUG.get(slug) || ESPN_LEAGUE_BY_SLUG.get(m[1]) || null;
}
export function getEspnEventIdFromMatchId(matchId: string): string | null {
  const m = matchId.match(/^espn_[a-z0-9.]+_(\d+)$/i);
  return m ? m[1] : null;
}

async function fetchESPN(
  sport: string,
  league: string,
  endpoint: string = 'scoreboard',
  dates?: string,
): Promise<ESPNScoreboardResponseFull | null> {
  const base = `${ESPN_BASE_URL}/${sport}/${league}/${endpoint}`;
  const url = dates ? `${base}?dates=${dates}` : base;

  // ESPN tennis (ATP/WTA) and golf scoreboards are huge (often >2MB) and exceed
  // Next.js's data-cache item limit, which spams "Failed to set fetch cache"
  // warnings. Skip the data cache for those endpoints — our in-memory cache
  // (setCache/getCache) already handles dedupe + TTL upstream.
  const skipDataCache = sport === 'tennis' || sport === 'golf';

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      ...(skipDataCache ? { cache: 'no-store' as const } : { next: { revalidate: 15 } }),
    });

    if (!response.ok) {
      apiStatus.espn.lastError = `HTTP ${response.status}`;
      return null;
    }

    apiStatus.espn.working = true;
    apiStatus.espn.lastCheck = Date.now();

    return await response.json();
  } catch (error) {
    apiStatus.espn.lastError = String(error);
    return null;
  }
}

// ============================================
// ESPN Global Catch-all Scoreboard
// ============================================
// ESPN exposes a `/sports/<sport>/all/scoreboard` endpoint that returns EVERY
// match across EVERY league for the date(s) requested — including tons of
// leagues we don't have explicitly configured (Iraqi Premier, Maltese
// Premier, Hong Kong, Costa Rica cup, etc). We use this to dramatically
// expand match coverage so the Live + Today lists feel as rich as Oddspedia.
//
// We map each event into a UnifiedMatch using the league id encoded in
// `event.uid` (s:<sportId>~l:<leagueId>~e:<eventId>) and resolve unknown
// league ids to a friendly name via a one-shot ESPN league-info fetch
// that's cached per worker.
const GLOBAL_SPORT_TYPES: Array<{ sport: string; sportType: ESPNLeagueConfig['sportType']; sportId: number }> = [
  { sport: 'soccer', sportType: 'soccer', sportId: 1 },
  { sport: 'basketball', sportType: 'basketball', sportId: 2 },
  { sport: 'tennis', sportType: 'tennis', sportId: 3 },
  { sport: 'baseball', sportType: 'baseball', sportId: 6 },
  { sport: 'hockey', sportType: 'hockey', sportId: 7 },
  { sport: 'rugby', sportType: 'rugby', sportId: 8 },
  { sport: 'cricket', sportType: 'cricket', sportId: 26 },
  { sport: 'mma', sportType: 'mma', sportId: 27 },
  { sport: 'golf', sportType: 'golf', sportId: 9 },
  { sport: 'racing', sportType: 'racing', sportId: 12 },
];

// Cache resolved league info: ESPN league id (numeric) → { name, slug, country }
interface GlobalLeagueInfo { name: string; slug: string; country: string; countryCode: string; }
const globalLeagueInfoCache = new Map<string, GlobalLeagueInfo>();

// Build a fast index of "ESPN league code (e.g. eng.1) → ESPNLeagueConfig" so
// when the global feed surfaces a known league we still link to our internal
// league page instead of inventing a duplicate.
const ESPN_CONFIG_BY_LEAGUE_CODE = new Map<string, ESPNLeagueConfig>();
for (const cfg of ESPN_LEAGUES) ESPN_CONFIG_BY_LEAGUE_CODE.set(cfg.league, cfg);

// Hand-curated map of common ESPN numeric league ids → friendly metadata.
// Covers everything we don't already configure as a first-class league but
// surfaces frequently in /all/scoreboard. Names match how Oddspedia/ESPN
// display the competition.
const KNOWN_GLOBAL_LEAGUES: Record<string, { name: string; country: string; countryCode: string }> = {
  '21231': { name: 'Saudi Pro League', country: 'Saudi Arabia', countryCode: 'SA' },
  '8316': { name: 'Indian Super League', country: 'India', countryCode: 'IN' },
  '8339': { name: 'Indonesian Super League', country: 'Indonesia', countryCode: 'ID' },
  '8340': { name: 'Malaysian Super League', country: 'Malaysia', countryCode: 'MY' },
  '11053': { name: 'Ugandan Premier League', country: 'Uganda', countryCode: 'UG' },
  '8305': { name: 'KNVB Beker', country: 'Netherlands', countryCode: 'NL' },
  '5454': { name: 'Copa Libertadores', country: 'South America', countryCode: 'WO' },
  '5337': { name: 'US Open Cup', country: 'United States', countryCode: 'US' },
  '5699': { name: 'CONCACAF Champions Cup', country: 'North America', countryCode: 'WO' },
  '3903': { name: 'Argentine Primera B Metropolitana', country: 'Argentina', countryCode: 'AR' },
  '3914': { name: 'EFL League One', country: 'England', countryCode: 'GB' },
  '3915': { name: 'EFL League Two', country: 'England', countryCode: 'GB' },
  '3917': { name: 'EFL League Two Playoffs', country: 'England', countryCode: 'GB' },
  '3910': { name: 'National League', country: 'England', countryCode: 'GB' },
  '4002': { name: 'Scottish Championship', country: 'Scotland', countryCode: 'GB' },
  '10951': { name: 'Saudi King Cup', country: 'Saudi Arabia', countryCode: 'SA' },
  '22059': { name: 'AFC Champions League Two', country: 'Asia', countryCode: 'WO' },
  '775': { name: 'UEFA Champions League', country: 'Europe', countryCode: 'WO' },
  '783': { name: 'Copa Sudamericana', country: 'South America', countryCode: 'WO' },
};

// Convert a season slug like "2025-26-saudi-pro-league" or "uefa-champions-league"
// into a clean display name. Strips year prefixes and title-cases the rest.
function leagueNameFromSeasonSlug(slug?: string): string | null {
  if (!slug) return null;
  // Skip generic slugs that don't carry league info.
  const generic = new Set(['regular-season', 'group-stage', 'semifinals', 'quarterfinals', 'round-of-16', 'first-round', 'second-round', 'final', 'playoffs', 'preseason', 'postseason', 'promotion-quarterfinals']);
  if (generic.has(slug)) return null;
  // Strip leading year prefix (e.g. "2025-26-" or "2025-").
  const stripped = slug.replace(/^\d{4}(-\d{2})?-/, '');
  if (generic.has(stripped) || /^\d/.test(stripped)) return null;
  // Title-case each word.
  return stripped
    .split('-')
    .map(w => w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function resolveGlobalLeagueInfo(
  sport: string,
  espnLeagueId: string,
  hint?: { seasonSlug?: string; teamSlug?: string },
): Promise<GlobalLeagueInfo> {
  const ck = `${sport}_${espnLeagueId}`;
  const cached = globalLeagueInfoCache.get(ck);
  if (cached) return cached;

  // 1. Curated map wins — most accurate names.
  const known = KNOWN_GLOBAL_LEAGUES[espnLeagueId];
  if (known) {
    const info: GlobalLeagueInfo = { name: known.name, slug: known.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), country: known.country, countryCode: known.countryCode };
    globalLeagueInfoCache.set(ck, info);
    return info;
  }
  // 2. Try the season slug (e.g. "2025-26-saudi-pro-league" → "Saudi Pro League").
  const fromSlug = leagueNameFromSeasonSlug(hint?.seasonSlug);
  if (fromSlug) {
    const info: GlobalLeagueInfo = { name: fromSlug, slug: fromSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-'), country: 'World', countryCode: 'WO' };
    globalLeagueInfoCache.set(ck, info);
    return info;
  }
  // 3. Fallback: derive country from team slug ("ksa.1" → KSA).
  const country = hint?.teamSlug?.split('.')[0]?.toUpperCase();
  const info: GlobalLeagueInfo = {
    name: country ? `${country} League` : `League ${espnLeagueId}`,
    slug: `espn-${espnLeagueId}`,
    country: country || 'World',
    countryCode: 'WO',
  };
  globalLeagueInfoCache.set(ck, info);
  return info;
}

async function fetchESPNGlobalSport(sport: string, sportType: ESPNLeagueConfig['sportType'], sportId: number): Promise<UnifiedMatch[]> {
  const cacheKey = `espn-global-${sport}`;
  const cached = getCached<UnifiedMatch[]>(cacheKey, CACHE_DURATION.live);
  if (cached) return cached;

  // Pull a 7-day window (yesterday → +6 days) so multi-day tournaments
  // (tennis Slams, cricket Tests, golf majors) and weekend-heavy sports
  // always surface their full Today / Upcoming coverage even when ESPN's
  // default response would only return the next single matchday.
  const now = new Date();
  const start = new Date(now); start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(now); end.setUTCDate(end.getUTCDate() + 6);
  const range = `${formatYYYYMMDD(start)}-${formatYYYYMMDD(end)}`;
  const url = `${ESPN_BASE_URL}/${sport}/all/scoreboard?dates=${range}`;
  // Same caveat as fetchESPN: tennis & golf payloads exceed Next.js's
  // data-cache item limit; skip data cache for them and rely on our
  // in-memory setCache/getCache below.
  const skipDataCache = sport === 'tennis' || sport === 'golf';
  let data: ESPNScoreboardResponseFull | null = null;
  try {
    const r = await fetch(url, {
      headers: { Accept: 'application/json' },
      ...(skipDataCache ? { cache: 'no-store' as const } : { next: { revalidate: 30 } }),
    });
    if (r.ok) data = await r.json() as ESPNScoreboardResponseFull;
  } catch { /* fall through */ }
  if (!data?.events?.length) {
    setCache(cacheKey, []);
    return [];
  }

  const noDrawSports: ESPNLeagueConfig['sportType'][] = ['basketball', 'baseball', 'mma', 'tennis', 'golf', 'racing'];
  const hasDraw = !noDrawSports.includes(sportType);

  const matches: UnifiedMatch[] = [];
  // Build per-league hint (use the season slug from the first event of each
  // league — usually contains the league name like "2025-26-saudi-pro-league")
  // so resolveGlobalLeagueInfo can derive friendly names without expensive
  // per-event lookups.
  const leagueHints = new Map<string, { seasonSlug?: string; teamSlug?: string }>();
  for (const ev of data.events) {
    const evExt = ev as ESPNEvent & { uid?: string; season?: { slug?: string } };
    const m = evExt.uid?.match(/l:(\d+)/);
    if (!m) continue;
    if (!leagueHints.has(m[1])) {
      const homeSlug = (ev.competitions?.[0]?.competitors?.[0]?.team as { slug?: string } | undefined)?.slug;
      leagueHints.set(m[1], { seasonSlug: evExt.season?.slug, teamSlug: homeSlug });
    }
  }
  const leagueInfoMap = new Map<string, GlobalLeagueInfo>();
  await Promise.all(
    Array.from(leagueHints.entries()).map(async ([lid, hint]) => {
      const info = await resolveGlobalLeagueInfo(sport, lid, hint);
      leagueInfoMap.set(lid, info);
    })
  );

  for (const event of data.events) {
    const competition = event.competitions[0];
    if (!competition) continue;
    const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
    const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');
    const homeTeamName = homeCompetitor?.team?.displayName || homeCompetitor?.team?.name || homeCompetitor?.athlete?.displayName || 'TBD';
    const awayTeamName = awayCompetitor?.team?.displayName || awayCompetitor?.team?.name || awayCompetitor?.athlete?.displayName || 'TBD';
    if (homeTeamName === 'TBD' && awayTeamName === 'TBD') continue;

    const espnLeagueIdMatch = (event as ESPNEvent & { uid?: string }).uid?.match(/l:(\d+)/);
    const espnLeagueId = espnLeagueIdMatch?.[1] || '0';
    const leagueInfo = leagueInfoMap.get(espnLeagueId) || { name: 'Unknown League', slug: `espn-${espnLeagueId}`, country: 'World', countryCode: 'WO' };

    // Pseudo-config for ID stability — a deterministic leagueId derived from
    // ESPN's league id keeps URLs consistent across requests.
    const ourLeagueId = 80000 + parseInt(espnLeagueId, 10);
    // Use ESPN league id as the slug fragment in our match ID so the match
    // detail page can reconstruct it. Format: espn_global<id>_<eventId>
    const leagueKeyForId = `global${espnLeagueId}`;

    const status = mapESPNStatus(event.status);
    const { odds, markets } = extractEspnOdds(competition.odds, hasDraw);
    const venue = competition.venue?.fullName;

    matches.push({
      id: `espn_${leagueKeyForId}_${event.id}`,
      externalId: event.id,
      source: 'espn',
      sportId,
      sportKey: `${sport}_global${espnLeagueId}`,
      leagueId: ourLeagueId,
      leagueKey: leagueKeyForId,
      homeTeam: {
        id: homeCompetitor?.team?.id || homeCompetitor?.athlete?.id || '',
        name: homeTeamName,
        shortName: homeCompetitor?.team?.abbreviation || homeCompetitor?.athlete?.shortName || homeTeamName.slice(0, 3).toUpperCase(),
        logo: homeCompetitor?.team?.logo,
        form: homeCompetitor?.form || undefined,
        record: homeCompetitor?.records?.find(r => r.type === 'total' || !r.type)?.summary || undefined,
      },
      awayTeam: {
        id: awayCompetitor?.team?.id || awayCompetitor?.athlete?.id || '',
        name: awayTeamName,
        shortName: awayCompetitor?.team?.abbreviation || awayCompetitor?.athlete?.shortName || awayTeamName.slice(0, 3).toUpperCase(),
        logo: awayCompetitor?.team?.logo,
        form: awayCompetitor?.form || undefined,
        record: awayCompetitor?.records?.find(r => r.type === 'total' || !r.type)?.summary || undefined,
      },
      kickoffTime: new Date(event.date),
      status,
      homeScore:
        homeCompetitor?.score !== undefined && homeCompetitor?.score !== null && homeCompetitor.score !== ''
          ? parseInt(homeCompetitor.score, 10)
          : null,
      awayScore:
        awayCompetitor?.score !== undefined && awayCompetitor?.score !== null && awayCompetitor.score !== ''
          ? parseInt(awayCompetitor.score, 10)
          : null,
      minute: extractLiveMinute(event.status, sportType) ?? undefined,
      period: event.status.displayClock,
      league: {
        id: ourLeagueId,
        name: leagueInfo.name,
        slug: leagueInfo.slug,
        country: leagueInfo.country,
        countryCode: leagueInfo.countryCode,
        tier: 3,
      },
      sport: {
        id: sportId,
        name: ALL_SPORTS.find(s => s.id === sportId)?.name || sport,
        slug: ALL_SPORTS.find(s => s.id === sportId)?.slug || sport,
        icon: ALL_SPORTS.find(s => s.id === sportId)?.icon || sport,
      },
      odds,
      markets,
      tipsCount: 0,
      venue,
    });
  }

  setCache(cacheKey, matches);
  return matches;
}

async function fetchESPNGlobalAll(): Promise<UnifiedMatch[]> {
  const all = await Promise.allSettled(
    GLOBAL_SPORT_TYPES.map(s => fetchESPNGlobalSport(s.sport, s.sportType, s.sportId))
  );
  const out: UnifiedMatch[] = [];
  for (const r of all) {
    if (r.status === 'fulfilled') out.push(...r.value);
  }
  return out;
}

// Leagues we always fetch a multi-day window for (so today + a week of fixtures
// always show up regardless of ESPN's default "next game day" behaviour).
const PRIORITY_LEAGUE_KEYS = new Set<string>([
  'eng.1', 'eng.2', 'eng.fa', 'eng.league_cup',
  'esp.1', 'esp.2', 'esp.copa_del_rey',
  'ger.1', 'ger.2', 'ger.dfb_pokal',
  'ita.1', 'ita.2', 'ita.coppa_italia',
  'fra.1', 'fra.2',
  'ned.1', 'por.1', 'sco.1', 'bel.1', 'tur.1',
  'uefa.champions', 'uefa.europa', 'uefa.europa.conf', 'uefa.nations',
  'usa.1', 'mex.1', 'bra.1', 'arg.1',
  'sau.1', 'jpn.1', 'aus.1',
  'nba', 'nfl', 'mlb', 'nhl', 'ufc',
]);

function formatYYYYMMDD(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// ============================================
// ESPN Odds extraction (real DraftKings/etc odds)
// ============================================

function americanToDecimal(american: number | string | undefined): number | undefined {
  if (american === undefined || american === null || american === '') return undefined;
  const n = typeof american === 'string' ? parseFloat(american.replace(/[^\d.\-+]/g, '')) : american;
  if (!Number.isFinite(n) || n === 0) return undefined;
  const decimal = n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
  return Math.round(decimal * 100) / 100;
}

interface ESPNOddsRaw {
  provider?: { id?: string; name?: string; displayName?: string };
  details?: string;
  overUnder?: number;
  spread?: number;
  overOdds?: number | string;
  underOdds?: number | string;
  drawOdds?: { moneyLine?: number };
  homeTeamOdds?: { moneyLine?: number; spreadOdds?: number; favorite?: boolean; team?: { id?: string } };
  awayTeamOdds?: { moneyLine?: number; spreadOdds?: number; favorite?: boolean; team?: { id?: string } };
  total?: {
    over?: { close?: { odds?: string; line?: string }, open?: { odds?: string; line?: string } };
    under?: { close?: { odds?: string; line?: string }, open?: { odds?: string; line?: string } };
  };
  // New ESPN scoreboard format (2024+)
  moneyline?: {
    displayName?: string;
    shortDisplayName?: string;
    home?: { open?: { odds?: string }; close?: { odds?: string } };
    away?: { open?: { odds?: string }; close?: { odds?: string } };
    draw?: { open?: { odds?: string }; close?: { odds?: string } };
  };
  pointSpread?: {
    displayName?: string;
    shortDisplayName?: string;
    home?: { open?: { line?: string; odds?: string }; close?: { line?: string; odds?: string } };
    away?: { open?: { line?: string; odds?: string }; close?: { line?: string; odds?: string } };
  };
}

interface ESPNScoreboardResponseFull extends ESPNScoreboardResponse {
  events: Array<ESPNEvent & { competitions: Array<ESPNEvent['competitions'][number] & { odds?: ESPNOddsRaw[]; venue?: { fullName?: string; address?: { city?: string; country?: string } } }> }>;
}

export function extractEspnOdds(rawOddsList: ESPNOddsRaw[] | undefined, hasDraw: boolean = true): { odds?: MatchOdds; markets?: Market[] } {
  if (!rawOddsList || !Array.isArray(rawOddsList) || rawOddsList.length === 0) return {};

  // ESPN sometimes returns null entries in the odds array — strip them first.
  const cleanList = rawOddsList.filter((x): x is ESPNOddsRaw => x != null);
  if (cleanList.length === 0) return {};

  // Try to find provider with moneyline data — support BOTH ESPN formats:
  // Old: homeTeamOdds.moneyLine (number)
  // New (2024+): moneyline.home.close.odds (string like "+180")
  const o = cleanList.find(x =>
    x.homeTeamOdds?.moneyLine !== undefined ||
    x.awayTeamOdds?.moneyLine !== undefined ||
    x.moneyline?.home?.close?.odds !== undefined ||
    x.moneyline?.away?.close?.odds !== undefined
  ) || cleanList[0];
  if (!o) return {};

  // Extract moneyline: prefer new format, fallback to old
  const home = americanToDecimal(o.moneyline?.home?.close?.odds ?? o.homeTeamOdds?.moneyLine);
  const away = americanToDecimal(o.moneyline?.away?.close?.odds ?? o.awayTeamOdds?.moneyLine);
  const draw = hasDraw
    ? americanToDecimal(o.moneyline?.draw?.close?.odds ?? o.drawOdds?.moneyLine)
    : undefined;

  if (!home || !away) return {};

  const odds: MatchOdds = {
    home,
    away,
    draw,
    bookmaker: o.provider?.displayName || o.provider?.name || 'DraftKings',
    lastUpdate: new Date(),
  };

  const markets: Market[] = [{
    key: 'h2h',
    name: 'Match Result',
    outcomes: [
      { name: 'Home', price: home },
      ...(draw ? [{ name: 'Draw', price: draw }] : []),
      { name: 'Away', price: away },
    ],
  }];

  // Spread / handicap — support new format (pointSpread) and old (homeTeamOdds.spreadOdds)
  if (o.pointSpread?.home?.close?.odds && o.pointSpread?.away?.close?.odds) {
    const homeSpread = americanToDecimal(o.pointSpread.home.close.odds);
    const awaySpread = americanToDecimal(o.pointSpread.away.close.odds);
    const spreadLine = parseFloat(o.pointSpread.home.close.line || '0');
    if (homeSpread && awaySpread) {
      markets.push({
        key: 'spreads',
        name: 'Handicap',
        outcomes: [
          { name: 'Home', price: homeSpread, point: spreadLine },
          { name: 'Away', price: awaySpread, point: -spreadLine },
        ],
      });
    }
  } else if (o.spread !== undefined && o.homeTeamOdds?.spreadOdds !== undefined) {
    const homeSpread = americanToDecimal(o.homeTeamOdds.spreadOdds);
    const awaySpread = americanToDecimal(o.awayTeamOdds?.spreadOdds);
    if (homeSpread && awaySpread) {
      markets.push({
        key: 'spreads',
        name: 'Handicap',
        outcomes: [
          { name: 'Home', price: homeSpread, point: -Math.abs(o.spread) },
          { name: 'Away', price: awaySpread, point: Math.abs(o.spread) },
        ],
      });
    }
  }

  // Totals (over/under)
  if (o.overUnder !== undefined) {
    const overOdds = americanToDecimal(o.total?.over?.close?.odds || o.overOdds);
    const underOdds = americanToDecimal(o.total?.under?.close?.odds || o.underOdds);
    if (overOdds && underOdds) {
      markets.push({
        key: 'totals',
        name: 'Total Goals/Points',
        outcomes: [
          { name: 'Over', price: overOdds, point: o.overUnder },
          { name: 'Under', price: underOdds, point: o.overUnder },
        ],
      });
    }
  }

  // ─── Derived markets (Oddspedia/BettingExpert-style market expansion) ────────
  // Real bookmakers price these as separate markets, but the underlying maths
  // is just a recombination of the 1X2 implied probabilities, so we publish
  // them deterministically (with a small house margin baked in via the 1X2 vig
  // we already inherited from the source). Punters get the variety of markets
  // they expect; we never invent prices that aren't grounded in real odds.
  if (hasDraw && draw) {
    deriveSoccerMarkets(home, draw, away).forEach(m => markets.push(m));
  }

  return { odds, markets };
}

/**
 * Build the soccer derived market suite (Double Chance, Draw No Bet) from a
 * 1X2 set. Implied probabilities are normalised first so the synthetic prices
 * sum to ~1 (no extra vig added beyond what's in the source 1X2 odds).
 */
export function deriveSoccerMarkets(home: number, draw: number, away: number): Market[] {
  if (!home || !draw || !away) return [];
  const pH = 1 / home, pD = 1 / draw, pA = 1 / away;
  const total = pH + pD + pA;
  if (total <= 0) return [];
  // Normalise
  const nH = pH / total, nD = pD / total, nA = pA / total;
  const round2 = (x: number) => Math.round(x * 100) / 100;

  const dc1X = nH + nD, dc12 = nH + nA, dcX2 = nD + nA;
  const dnbH = nH / (nH + nA), dnbA = nA / (nH + nA);

  return [
    {
      key: 'double_chance',
      name: 'Double Chance',
      outcomes: [
        { name: '1X', price: round2(1 / dc1X) },
        { name: '12', price: round2(1 / dc12) },
        { name: 'X2', price: round2(1 / dcX2) },
      ],
    },
    {
      key: 'draw_no_bet',
      name: 'Draw No Bet',
      outcomes: [
        { name: 'Home', price: round2(1 / dnbH) },
        { name: 'Away', price: round2(1 / dnbA) },
      ],
    },
  ];
}

// ============================================
// ESPN Summary endpoint - rich match details
// ============================================

export interface ESPNSummaryResponse {
  header?: {
    competitions?: Array<{
      competitors?: Array<{
        id?: string;
        homeAway?: 'home' | 'away';
        winner?: boolean;
        team?: { id: string; displayName: string; abbreviation: string; logo?: string; color?: string };
        score?: string;
        record?: Array<{ summary?: string; type?: string }>;
        form?: string; // "WWDLW"
      }>;
    }>;
    season?: { year?: number; type?: number };
    league?: { id?: string; name?: string };
  };
  gameInfo?: {
    venue?: { fullName?: string; address?: { city?: string; country?: string }; capacity?: number; indoor?: boolean };
    attendance?: number;
    officials?: Array<{ displayName?: string; position?: { displayName?: string } }>;
    weather?: { displayValue?: string; temperature?: number };
  };
  pickcenter?: ESPNOddsRaw[];
  odds?: ESPNOddsRaw[];
  hasOdds?: boolean;
  rosters?: Array<{
    team?: { id: string; displayName: string; logo?: string };
    homeAway?: 'home' | 'away';
    formation?: string;
    roster?: Array<{
      starter?: boolean;
      position?: { abbreviation?: string; name?: string };
      jersey?: string;
      athlete?: { id: string; displayName: string; shortName?: string; headshot?: string };
      stats?: Array<{ name?: string; displayValue?: string }>;
    }>;
    coach?: Array<{ firstName?: string; lastName?: string; displayName?: string }>;
  }>;
  headToHeadGames?: Array<{
    team?: { id?: string; displayName?: string; abbreviation?: string; logo?: string };
    games?: Array<{
      gameDate?: string;
      score?: string;
      gameResult?: string;
      homeTeam?: { displayName: string; abbreviation: string; logo?: string; score?: string };
      awayTeam?: { displayName: string; abbreviation: string; logo?: string; score?: string };
      league?: { abbreviation?: string };
    }>;
  }>;
  standings?: {
    fullViewLink?: { href?: string };
    groups?: Array<{
      header?: string;
      standings?: {
        entries?: Array<{
          team?: { id?: string; displayName?: string; abbreviation?: string; logo?: string };
          stats?: Array<{ name?: string; abbreviation?: string; value?: number; displayValue?: string }>;
        }>;
      };
    }>;
  };
  news?: { articles?: Array<{ id?: number; headline?: string; description?: string; published?: string; images?: Array<{ url?: string }>; links?: { web?: { href?: string } } }> };
  leaders?: Array<{
    team?: { id?: string; displayName?: string };
    leaders?: Array<{
      name?: string;
      displayName?: string;
      leaders?: Array<{ displayValue?: string; athlete?: { displayName?: string; headshot?: string; shortName?: string } }>;
    }>;
  }>;
  broadcasts?: Array<{ market?: string; media?: { shortName?: string } }>;
  scoringPlays?: Array<{
    id?: string;
    type?: { id?: string; text?: string; abbreviation?: string };
    period?: { number?: number; type?: string };
    clock?: { value?: number; displayValue?: string };
    team?: { id?: string; displayName?: string; abbreviation?: string };
    participants?: Array<{
      athlete?: { id?: string; displayName?: string; shortName?: string; headshot?: string };
      type?: { name?: string };
    }>;
    text?: string;
    scoreValue?: number;
    awayScore?: number;
    homeScore?: number;
  }>;
  plays?: Array<{
    id?: string;
    type?: { id?: string; text?: string; abbreviation?: string };
    period?: { number?: number };
    clock?: { value?: number; displayValue?: string };
    team?: { id?: string; displayName?: string };
    participants?: Array<{
      athlete?: { id?: string; displayName?: string; shortName?: string; headshot?: string };
      type?: { name?: string };
    }>;
    text?: string;
    scoringPlay?: boolean;
    scoreValue?: number;
    homeScore?: number;
    awayScore?: number;
  }>;
  boxscore?: {
    teams?: Array<{
      team?: { id?: string; displayName?: string; abbreviation?: string; logo?: string };
      homeAway?: 'home' | 'away';
      statistics?: Array<{
        name?: string;
        abbreviation?: string;
        displayValue?: string;
        label?: string;
        value?: number;
      }>;
    }>;
    players?: unknown;
  };
}

export async function fetchESPNSummary(sport: string, league: string, eventId: string): Promise<ESPNSummaryResponse | null> {
  const cacheKey = `espn-summary-${sport}-${league}-${eventId}`;
  const cached = getCached<ESPNSummaryResponse>(cacheKey, 60 * 1000); // 1 min
  if (cached) return cached;

  const url = `${ESPN_BASE_URL}/${sport}/${league}/summary?event=${eventId}`;
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' }, next: { revalidate: 60 } });
    if (!r.ok) return null;
    const j = await r.json() as ESPNSummaryResponse;
    setCache(cacheKey, j);
    return j;
  } catch (e) {
    console.error('[ESPN summary] fetch failed', e);
    return null;
  }
}

function mapESPNStatus(status: ESPNEvent['status']): UnifiedMatch['status'] {
  const state = status.type.state?.toLowerCase() || '';
  const name = status.type.name?.toLowerCase() || '';
  const detail = (status.type.detail || status.type.shortDetail || '').toLowerCase();

  if (name.includes('halftime') || name === 'half' || detail.includes('halftime') || detail.includes('half time')) return 'halftime';
  if (name.includes('extra') || detail.includes('extra time') || detail.includes('et')) return 'extra_time';
  if (name.includes('penalt') || detail.includes('penalt')) return 'penalties';
  if (state === 'in' || name === 'in progress' || name === 'in_progress' || name.startsWith('status_in')) return 'live';
  if (state === 'post' || status.type.completed) return 'finished';
  if (name === 'postponed' || detail.includes('postpon')) return 'postponed';
  if (name === 'canceled' || name === 'cancelled' || detail.includes('cancel')) return 'cancelled';
  return 'scheduled';
}

/**
 * Extract the real live minute for a match from ESPN's status payload.
 * - Soccer: displayClock is usually "75'" or "45+2'" (minutes elapsed).
 *   In 2nd half ESPN may also send "MM:SS" elapsed in current half — add 45.
 * - Basketball/Football/Hockey: displayClock is time REMAINING in the period.
 *   We compute elapsed minutes inside that period and add prior periods.
 * Returns the elapsed match minute as an integer, or null if it cannot be parsed.
 */
function extractLiveMinute(
  status: ESPNEvent['status'],
  sportType: ESPNLeagueConfig['sportType']
): number | null {
  const dc = (status.displayClock || '').trim();
  const period = status.period || 0;
  if (!dc && !period) return null;

  if (sportType === 'soccer') {
    // "75'" or "90+3'" or "45+2"
    const m = dc.match(/^(\d+)(?:\+(\d+))?'?$/);
    if (m) {
      const base = parseInt(m[1], 10);
      const extra = m[2] ? parseInt(m[2], 10) : 0;
      return base + extra;
    }
    // "MM:SS" elapsed inside current half
    const mmss = dc.match(/^(\d+):(\d+)$/);
    if (mmss) {
      const mins = parseInt(mmss[1], 10);
      if (period >= 2) return Math.min(45 + mins, 130);
      return mins;
    }
    // Halftime / pre-match — fall through to 45 / 0
    if (status.type?.name?.toLowerCase().includes('half')) return 45;
    return null;
  }

  // Period-based sports — remaining time in MM:SS in current period
  const mmss = dc.match(/^(\d+):(\d+)$/);
  if (mmss) {
    // Determine period length per sport
    const periodLen = sportType === 'basketball'
      ? 12 // NBA quarter; college is 20 (handled below)
      : sportType === 'football' ? 15
      : sportType === 'hockey' ? 20
      : sportType === 'rugby' ? 40
      : 12;
    const remainingMin = parseInt(mmss[1], 10);
    const elapsedInPeriod = Math.max(0, periodLen - remainingMin - 1); // approx, treat seconds as part of current min
    const completedPeriods = Math.max(0, period - 1);
    return completedPeriods * periodLen + elapsedInPeriod;
  }

  return period || null;
}

// Generate realistic odds based on team factors
export function generateRealisticOdds(
  homeTeamName: string,
  awayTeamName: string,
  sportType: ESPNLeagueConfig['sportType'] = 'soccer'
): MatchOdds {
  const hashCode = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };
  
  const matchHash = hashCode(homeTeamName + awayTeamName);
  const seed = (matchHash % 1000) / 1000;
  
  // Home advantage varies by sport
  const homeAdvantage: Record<string, number> = {
    soccer: 0.45,
    basketball: 0.55,
    football: 0.52,
    baseball: 0.53,
    hockey: 0.52,
    mma: 0.5,
    tennis: 0.5,
    cricket: 0.52,
    rugby: 0.52,
    golf: 0.5,
    racing: 0.5,
  };
  
  // Sports without draw
  const noDrawSports = ['basketball', 'baseball', 'mma', 'tennis', 'golf', 'racing'];
  
  let homeProb = (homeAdvantage[sportType] || 0.5) + (seed - 0.5) * 0.3;
  let awayProb: number;
  let drawProb: number | undefined;
  
  if (noDrawSports.includes(sportType)) {
    awayProb = 1 - homeProb;
    drawProb = undefined;
  } else {
    drawProb = 0.25 + (seed * 0.1);
    homeProb = Math.max(0.2, Math.min(0.55, homeProb));
    awayProb = 1 - homeProb - drawProb;
  }
  
  // Convert to decimal odds with bookmaker margin
  const margin = 1.06;
  const homeOdds = Math.round((margin / homeProb) * 100) / 100;
  const awayOdds = Math.round((margin / awayProb) * 100) / 100;
  const drawOdds = drawProb ? Math.round((margin / drawProb) * 100) / 100 : undefined;
  
  return {
    home: Math.max(1.15, Math.min(homeOdds, 6.0)),
    draw: drawOdds ? Math.max(2.8, Math.min(drawOdds, 5.5)) : undefined,
    away: Math.max(1.15, Math.min(awayOdds, 8.0)),
    bookmaker: 'Market Average',
    lastUpdate: new Date(),
  };
}

// Generate sport-specific betting markets
function generateBettingMarkets(
  homeTeam: string,
  awayTeam: string,
  odds: MatchOdds,
  sportType: ESPNLeagueConfig['sportType'] = 'soccer'
): Market[] {
  const markets: Market[] = [];
  
  // Main market (1X2 or Moneyline)
  markets.push({
    key: 'h2h',
    name: sportType === 'soccer' ? 'Match Result (1X2)' : 'Moneyline',
    outcomes: [
      { name: homeTeam, price: odds.home },
      ...(odds.draw ? [{ name: 'Draw', price: odds.draw }] : []),
      { name: awayTeam, price: odds.away },
    ]
  });
  
  if (sportType === 'soccer') {
    const drawOdd = odds.draw || 3.5;
    const round = (n: number, p = 100) => Math.round(n * p) / p;
    const jitter = (base: number, spread: number) => round(base + (Math.random() - 0.5) * spread);

    // Double Chance
    const dc1x = round(1 / (1/odds.home + 1/drawOdd));
    const dc12 = round(1 / (1/odds.home + 1/odds.away));
    const dcx2 = round(1 / (1/drawOdd + 1/odds.away));
    markets.push({
      key: 'double_chance',
      name: 'Double Chance',
      outcomes: [
        { name: '1X (Home or Draw)', price: Math.max(1.1, dc1x) },
        { name: '12 (Home or Away)', price: Math.max(1.1, dc12) },
        { name: 'X2 (Draw or Away)', price: Math.max(1.1, dcx2) },
      ],
    });

    // Draw No Bet
    const dnbHome = round(1 / (1/odds.home + (1/drawOdd) * 0.5));
    const dnbAway = round(1 / (1/odds.away + (1/drawOdd) * 0.5));
    markets.push({
      key: 'dnb',
      name: 'Draw No Bet',
      outcomes: [
        { name: homeTeam, price: Math.max(1.1, dnbHome) },
        { name: awayTeam, price: Math.max(1.1, dnbAway) },
      ],
    });

    // Over/Under goals — full ladder
    for (const line of [0.5, 1.5, 2.5, 3.5, 4.5]) {
      const drift = (line - 2.5) * 0.6;
      markets.push({
        key: `totals_${String(line).replace('.', '_')}`,
        name: `Over/Under ${line} Goals`,
        outcomes: [
          { name: `Over ${line}`, price: jitter(1.9 + drift, 0.2), point: line },
          { name: `Under ${line}`, price: jitter(1.9 - drift, 0.2), point: line },
        ],
      });
    }

    // Both Teams to Score
    markets.push({
      key: 'btts',
      name: 'Both Teams to Score',
      outcomes: [
        { name: 'Yes', price: jitter(1.85, 0.25) },
        { name: 'No', price: jitter(1.95, 0.25) },
      ],
    });

    // BTTS + Result combo
    markets.push({
      key: 'btts_and_result',
      name: 'BTTS & Result',
      outcomes: [
        { name: `${homeTeam} & Yes`, price: jitter(4.0, 0.6) },
        { name: 'Draw & Yes', price: jitter(4.5, 0.6) },
        { name: `${awayTeam} & Yes`, price: jitter(5.0, 0.7) },
        { name: `${homeTeam} & No`, price: jitter(4.5, 0.7) },
        { name: 'Draw & No', price: jitter(7.5, 1.2) },
        { name: `${awayTeam} & No`, price: jitter(6.0, 0.9) },
      ],
    });

    // HT/FT
    markets.push({
      key: 'ht_ft',
      name: 'Half-Time / Full-Time',
      outcomes: [
        { name: '1/1', price: jitter(3.5, 0.6) },
        { name: '1/X', price: jitter(13, 2) },
        { name: '1/2', price: jitter(28, 4) },
        { name: 'X/1', price: jitter(5.5, 0.7) },
        { name: 'X/X', price: jitter(4.5, 0.6) },
        { name: 'X/2', price: jitter(7, 0.9) },
        { name: '2/1', price: jitter(28, 4) },
        { name: '2/X', price: jitter(15, 2) },
        { name: '2/2', price: jitter(4.5, 0.6) },
      ],
    });

    // Half-time Result (1X2)
    markets.push({
      key: 'ht_result',
      name: 'Half-Time Result',
      outcomes: [
        { name: homeTeam, price: jitter(odds.home * 1.4, 0.3) },
        { name: 'Draw', price: jitter(2.2, 0.3) },
        { name: awayTeam, price: jitter(odds.away * 1.4, 0.3) },
      ],
    });

    // Odd/Even Goals
    markets.push({
      key: 'odd_even_goals',
      name: 'Odd/Even Goals',
      outcomes: [
        { name: 'Odd', price: jitter(1.92, 0.1) },
        { name: 'Even', price: jitter(1.92, 0.1) },
      ],
    });

    // Exact Goals
    markets.push({
      key: 'exact_goals',
      name: 'Exact Goals',
      outcomes: [
        { name: '0', price: jitter(9, 1.5) },
        { name: '1', price: jitter(4.5, 0.6) },
        { name: '2', price: jitter(3.6, 0.4) },
        { name: '3', price: jitter(4.5, 0.6) },
        { name: '4', price: jitter(7.5, 1.2) },
        { name: '5+', price: jitter(8.5, 1.5) },
      ],
    });

    // Clean Sheet — Yes/No per side
    markets.push({
      key: 'clean_sheet_home',
      name: `${homeTeam} Clean Sheet`,
      outcomes: [
        { name: 'Yes', price: jitter(2.4, 0.3) },
        { name: 'No', price: jitter(1.55, 0.15) },
      ],
    });
    markets.push({
      key: 'clean_sheet_away',
      name: `${awayTeam} Clean Sheet`,
      outcomes: [
        { name: 'Yes', price: jitter(2.9, 0.4) },
        { name: 'No', price: jitter(1.4, 0.15) },
      ],
    });

    // Win to Nil
    markets.push({
      key: 'win_to_nil',
      name: 'Win to Nil',
      outcomes: [
        { name: homeTeam, price: jitter(odds.home * 1.6, 0.3) },
        { name: awayTeam, price: jitter(odds.away * 1.6, 0.4) },
      ],
    });

    // Correct Score
    markets.push({
      key: 'correct_score',
      name: 'Correct Score',
      outcomes: [
        { name: '1-0', price: jitter(7.5, 1.5) },
        { name: '2-0', price: jitter(9, 1.5) },
        { name: '2-1', price: jitter(8.5, 1.5) },
        { name: '3-0', price: jitter(15, 3) },
        { name: '3-1', price: jitter(14, 2) },
        { name: '3-2', price: jitter(20, 4) },
        { name: '0-0', price: jitter(10, 2) },
        { name: '1-1', price: jitter(6.5, 1) },
        { name: '2-2', price: jitter(15, 3) },
        { name: '0-1', price: jitter(10, 2) },
        { name: '0-2', price: jitter(13, 2) },
        { name: '1-2', price: jitter(11, 2) },
      ],
    });

    // Total Corners (full ladder)
    for (const line of [7.5, 8.5, 9.5, 10.5, 11.5]) {
      markets.push({
        key: `corners_total_${String(line).replace('.', '_')}`,
        name: `Total Corners O/U ${line}`,
        outcomes: [
          { name: `Over ${line}`, price: jitter(1.9, 0.2), point: line },
          { name: `Under ${line}`, price: jitter(1.9, 0.2), point: line },
        ],
      });
    }
    // Race to corners
    markets.push({
      key: 'race_corners_5',
      name: 'Race to 5 Corners',
      outcomes: [
        { name: homeTeam, price: jitter(2.0, 0.2) },
        { name: awayTeam, price: jitter(2.2, 0.2) },
        { name: 'Neither', price: jitter(8, 2) },
      ],
    });
    // Total cards
    for (const line of [3.5, 4.5, 5.5, 6.5]) {
      markets.push({
        key: `cards_total_${String(line).replace('.', '_')}`,
        name: `Total Cards O/U ${line}`,
        outcomes: [
          { name: `Over ${line}`, price: jitter(1.9, 0.2), point: line },
          { name: `Under ${line}`, price: jitter(1.9, 0.2), point: line },
        ],
      });
    }
    // Red Card in match
    markets.push({
      key: 'red_card',
      name: 'Red Card in Match',
      outcomes: [
        { name: 'Yes', price: jitter(3.5, 0.5) },
        { name: 'No', price: jitter(1.28, 0.08) },
      ],
    });
    // Penalty awarded
    markets.push({
      key: 'penalty_awarded',
      name: 'Penalty Awarded',
      outcomes: [
        { name: 'Yes', price: jitter(2.6, 0.3) },
        { name: 'No', price: jitter(1.45, 0.1) },
      ],
    });
    // First-half goal
    markets.push({
      key: 'goal_first_half',
      name: 'Goal in 1st Half',
      outcomes: [
        { name: 'Yes', price: jitter(1.55, 0.15) },
        { name: 'No', price: jitter(2.35, 0.25) },
      ],
    });
    // Goal in both halves
    markets.push({
      key: 'goal_both_halves',
      name: 'Goal in Both Halves',
      outcomes: [
        { name: 'Yes', price: jitter(1.75, 0.2) },
        { name: 'No', price: jitter(2.0, 0.2) },
      ],
    });
    // Asian handicap (popular)
    const ahLine = odds.home < odds.away ? -1 : 1;
    markets.push({
      key: 'asian_handicap',
      name: `Asian Handicap ${ahLine > 0 ? '+' : ''}${ahLine}`,
      outcomes: [
        { name: `${homeTeam} ${ahLine > 0 ? '+' : ''}${ahLine}`, price: jitter(1.9, 0.2), point: ahLine },
        { name: `${awayTeam} ${-ahLine > 0 ? '+' : ''}${-ahLine}`, price: jitter(1.9, 0.2), point: -ahLine },
      ],
    });
    // Team totals
    markets.push({
      key: 'team_total_home_1_5',
      name: `${homeTeam} Total Goals 1.5`,
      outcomes: [
        { name: 'Over 1.5', price: jitter(2.1, 0.2), point: 1.5 },
        { name: 'Under 1.5', price: jitter(1.7, 0.15), point: 1.5 },
      ],
    });
    markets.push({
      key: 'team_total_away_1_5',
      name: `${awayTeam} Total Goals 1.5`,
      outcomes: [
        { name: 'Over 1.5', price: jitter(2.4, 0.3), point: 1.5 },
        { name: 'Under 1.5', price: jitter(1.55, 0.15), point: 1.5 },
      ],
    });
    // Highest scoring half
    markets.push({
      key: 'highest_scoring_half',
      name: 'Highest Scoring Half',
      outcomes: [
        { name: '1st Half', price: jitter(2.6, 0.3) },
        { name: '2nd Half', price: jitter(2.05, 0.2) },
        { name: 'Equal', price: jitter(3.4, 0.4) },
      ],
    });
  } else if (sportType === 'basketball') {
    const round = (n: number, p = 100) => Math.round(n * p) / p;
    const jitter = (base: number, spread: number) => round(base + (Math.random() - 0.5) * spread);
    const spread = odds.home < odds.away ? -5.5 : 5.5;
    markets.push({
      key: 'spreads',
      name: 'Point Spread',
      outcomes: [
        { name: `${homeTeam} ${spread > 0 ? '+' : ''}${spread}`, price: 1.91, point: spread },
        { name: `${awayTeam} ${-spread > 0 ? '+' : ''}${-spread}`, price: 1.91, point: -spread },
      ],
    });
    // Alternate spreads
    for (const off of [3.5, 7.5, 10.5]) {
      const sp = spread > 0 ? spread + off : spread - off;
      markets.push({
        key: `spread_alt_${off}`,
        name: `Alt Spread ±${Math.abs(sp).toFixed(1)}`,
        outcomes: [
          { name: `${homeTeam} ${sp > 0 ? '+' : ''}${sp}`, price: jitter(1.91, 0.4), point: sp },
          { name: `${awayTeam} ${-sp > 0 ? '+' : ''}${-sp}`, price: jitter(1.91, 0.4), point: -sp },
        ],
      });
    }
    const totalPoints = 210 + Math.floor(Math.random() * 30);
    markets.push({
      key: 'totals',
      name: `Total Points O/U ${totalPoints}.5`,
      outcomes: [
        { name: `Over ${totalPoints}.5`, price: 1.91, point: totalPoints + 0.5 },
        { name: `Under ${totalPoints}.5`, price: 1.91, point: totalPoints + 0.5 },
      ],
    });
    // Team totals
    markets.push({
      key: 'team_total_home',
      name: `${homeTeam} Total Points`,
      outcomes: [
        { name: 'Over 110.5', price: jitter(1.9, 0.2), point: 110.5 },
        { name: 'Under 110.5', price: jitter(1.9, 0.2), point: 110.5 },
      ],
    });
    markets.push({
      key: 'team_total_away',
      name: `${awayTeam} Total Points`,
      outcomes: [
        { name: 'Over 108.5', price: jitter(1.9, 0.2), point: 108.5 },
        { name: 'Under 108.5', price: jitter(1.9, 0.2), point: 108.5 },
      ],
    });
    // Quarter / half winner
    for (const q of [1, 2, 3, 4]) {
      markets.push({
        key: `quarter_winner_${q}`,
        name: `Q${q} Winner`,
        outcomes: [
          { name: homeTeam, price: jitter(odds.home * 0.95, 0.2) },
          { name: awayTeam, price: jitter(odds.away * 0.95, 0.2) },
        ],
      });
    }
    markets.push({
      key: 'half_1_winner',
      name: '1st Half Winner',
      outcomes: [
        { name: homeTeam, price: jitter(odds.home, 0.2) },
        { name: awayTeam, price: jitter(odds.away, 0.2) },
      ],
    });
    // Race to 20 points
    markets.push({
      key: 'race_to_20',
      name: 'Race to 20 Points',
      outcomes: [
        { name: homeTeam, price: jitter(1.85, 0.2) },
        { name: awayTeam, price: jitter(1.95, 0.2) },
      ],
    });
    // Overtime
    markets.push({
      key: 'overtime',
      name: 'Overtime?',
      outcomes: [
        { name: 'Yes', price: jitter(8, 1.5) },
        { name: 'No', price: jitter(1.07, 0.05) },
      ],
    });
    // Highest scoring quarter
    markets.push({
      key: 'highest_quarter',
      name: 'Highest Scoring Quarter',
      outcomes: [
        { name: 'Q1', price: jitter(4.5, 0.5) },
        { name: 'Q2', price: jitter(4.0, 0.5) },
        { name: 'Q3', price: jitter(4.0, 0.5) },
        { name: 'Q4', price: jitter(2.4, 0.3) },
      ],
    });
  } else if (sportType === 'football') {
    const spread = odds.home < odds.away ? -3.5 : 3.5;
    markets.push({
      key: 'spreads',
      name: 'Point Spread',
      outcomes: [
        { name: `${homeTeam} ${spread > 0 ? '+' : ''}${spread}`, price: 1.91, point: spread },
        { name: `${awayTeam} ${-spread > 0 ? '+' : ''}${-spread}`, price: 1.91, point: -spread },
      ]
    });
    
    const totalPoints = 42 + Math.floor(Math.random() * 10);
    markets.push({
      key: 'totals',
      name: `Total Points (${totalPoints}.5)`,
      outcomes: [
        { name: `Over ${totalPoints}.5`, price: 1.91, point: totalPoints + 0.5 },
        { name: `Under ${totalPoints}.5`, price: 1.91, point: totalPoints + 0.5 },
      ]
    });
    
    // First Touchdown Scorer type market
    markets.push({
      key: 'first_score',
      name: 'First Team to Score',
      outcomes: [
        { name: homeTeam, price: Math.round((1.85 + Math.random() * 0.2) * 100) / 100 },
        { name: awayTeam, price: Math.round((1.95 + Math.random() * 0.2) * 100) / 100 },
      ]
    });
  } else if (sportType === 'tennis') {
    const round = (n: number, p = 100) => Math.round(n * p) / p;
    const jitter = (base: number, spread: number) => round(base + (Math.random() - 0.5) * spread);
    // Set betting (best of 3)
    markets.push({
      key: 'set_betting',
      name: 'Set Betting (Bo3)',
      outcomes: [
        { name: `${homeTeam} 2-0`, price: jitter(2.5, 0.6) },
        { name: `${homeTeam} 2-1`, price: jitter(3.5, 0.5) },
        { name: `${awayTeam} 2-0`, price: jitter(2.8, 0.6) },
        { name: `${awayTeam} 2-1`, price: jitter(3.8, 0.5) },
      ],
    });
    // Games handicap (full ladder)
    for (const g of [2.5, 4.5, 6.5]) {
      markets.push({
        key: `games_handicap_${g}`,
        name: `Games Handicap ±${g}`,
        outcomes: [
          { name: `${homeTeam} -${g}`, price: jitter(1.91, 0.3), point: -g },
          { name: `${awayTeam} +${g}`, price: jitter(1.91, 0.3), point: g },
        ],
      });
    }
    // Total games
    markets.push({
      key: 'total_games_22_5',
      name: 'Total Games O/U 22.5',
      outcomes: [
        { name: 'Over 22.5', price: jitter(1.9, 0.2), point: 22.5 },
        { name: 'Under 22.5', price: jitter(1.9, 0.2), point: 22.5 },
      ],
    });
    // 1st Set Winner
    markets.push({
      key: 'first_set_winner',
      name: '1st Set Winner',
      outcomes: [
        { name: homeTeam, price: jitter(odds.home, 0.2) },
        { name: awayTeam, price: jitter(odds.away, 0.2) },
      ],
    });
    // Tie-break in match
    markets.push({
      key: 'tiebreak_in_match',
      name: 'Tie-Break in Match',
      outcomes: [
        { name: 'Yes', price: jitter(2.2, 0.3) },
        { name: 'No', price: jitter(1.65, 0.2) },
      ],
    });
  } else if (sportType === 'mma') {
    const round = (n: number, p = 100) => Math.round(n * p) / p;
    const jitter = (base: number, spread: number) => round(base + (Math.random() - 0.5) * spread);
    // Method of Victory
    markets.push({
      key: 'method',
      name: 'Method of Victory',
      outcomes: [
        { name: `${homeTeam} by KO/TKO`, price: jitter(3.5, 1.2) },
        { name: `${homeTeam} by Submission`, price: jitter(6.5, 2) },
        { name: `${homeTeam} by Decision`, price: jitter(5, 1.2) },
        { name: `${awayTeam} by KO/TKO`, price: jitter(4, 1.2) },
        { name: `${awayTeam} by Submission`, price: jitter(7, 2) },
        { name: `${awayTeam} by Decision`, price: jitter(5.5, 1.2) },
      ],
    });
    // Total Rounds (ladder)
    for (const line of [1.5, 2.5, 3.5, 4.5]) {
      markets.push({
        key: `total_rounds_${String(line).replace('.', '_')}`,
        name: `Total Rounds O/U ${line}`,
        outcomes: [
          { name: `Over ${line}`, price: jitter(1.85, 0.3), point: line },
          { name: `Under ${line}`, price: jitter(1.95, 0.3), point: line },
        ],
      });
    }
    // Round betting (which round fight ends)
    markets.push({
      key: 'round_betting',
      name: 'Round Betting',
      outcomes: [
        { name: 'Round 1', price: jitter(3.5, 0.6) },
        { name: 'Round 2', price: jitter(5.5, 1) },
        { name: 'Round 3', price: jitter(6.5, 1) },
        { name: 'Goes to Decision', price: jitter(2.4, 0.4) },
      ],
    });
    // Fight goes the distance
    markets.push({
      key: 'goes_distance',
      name: 'Fight Goes the Distance',
      outcomes: [
        { name: 'Yes', price: jitter(2.4, 0.4) },
        { name: 'No', price: jitter(1.55, 0.2) },
      ],
    });
  } else if (sportType === 'hockey') {
    // Puck line (NHL spread)
    markets.push({
      key: 'puck_line',
      name: 'Puck Line',
      outcomes: [
        { name: `${homeTeam} -1.5`, price: Math.round((2.1 + Math.random() * 0.3) * 100) / 100 },
        { name: `${awayTeam} +1.5`, price: Math.round((1.75 + Math.random() * 0.2) * 100) / 100 },
      ]
    });
    
    const totalGoals = 5 + Math.floor(Math.random() * 2);
    markets.push({
      key: 'totals',
      name: `Total Goals (${totalGoals}.5)`,
      outcomes: [
        { name: `Over ${totalGoals}.5`, price: 1.91, point: totalGoals + 0.5 },
        { name: `Under ${totalGoals}.5`, price: 1.91, point: totalGoals + 0.5 },
      ]
    });
  } else if (sportType === 'cricket') {
    // Match Winner
    markets.push({
      key: 'match_winner',
      name: 'Match Winner',
      outcomes: [
        { name: homeTeam, price: odds.home },
        { name: awayTeam, price: odds.away },
      ]
    });
    
    // Top Batsman runs
    markets.push({
      key: 'total_runs',
      name: 'Total Match Runs',
      outcomes: [
        { name: 'Over 320.5', price: Math.round((1.85 + Math.random() * 0.2) * 100) / 100 },
        { name: 'Under 320.5', price: Math.round((1.95 + Math.random() * 0.2) * 100) / 100 },
      ]
    });
  }
  
  return markets;
}

// Generate sport-specific statistics
function generateSportSpecificData(sportType: ESPNLeagueConfig['sportType'], status: UnifiedMatch['status']): SportSpecificData | undefined {
  if (status === 'scheduled') return undefined;
  
  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  
  switch (sportType) {
    case 'soccer':
      return {
        possession: { home: rand(40, 60), away: 100 - rand(40, 60) },
        shots: { home: rand(5, 15), away: rand(5, 15) },
        shotsOnTarget: { home: rand(2, 8), away: rand(2, 8) },
        corners: { home: rand(2, 8), away: rand(2, 8) },
        fouls: { home: rand(5, 15), away: rand(5, 15) },
        yellowCards: { home: rand(0, 3), away: rand(0, 3) },
        redCards: { home: rand(0, 1), away: rand(0, 1) },
      };
    case 'basketball':
      return {
        quarters: { home: [rand(20, 35), rand(20, 35), rand(20, 35), rand(20, 35)], away: [rand(20, 35), rand(20, 35), rand(20, 35), rand(20, 35)] },
        rebounds: { home: rand(35, 55), away: rand(35, 55) },
        assists: { home: rand(18, 30), away: rand(18, 30) },
        steals: { home: rand(5, 12), away: rand(5, 12) },
        blocks: { home: rand(2, 8), away: rand(2, 8) },
        turnovers: { home: rand(8, 18), away: rand(8, 18) },
        fieldGoalPct: { home: rand(40, 55), away: rand(40, 55) },
        threePointPct: { home: rand(28, 42), away: rand(28, 42) },
        freeThrowPct: { home: rand(70, 90), away: rand(70, 90) },
      };
    case 'football':
      return {
        passingYards: { home: rand(150, 350), away: rand(150, 350) },
        rushingYards: { home: rand(50, 180), away: rand(50, 180) },
        totalYards: { home: rand(250, 450), away: rand(250, 450) },
        firstDowns: { home: rand(12, 25), away: rand(12, 25) },
        thirdDownConv: { home: `${rand(3, 8)}/${rand(10, 15)}`, away: `${rand(3, 8)}/${rand(10, 15)}` },
        timeOfPossession: { home: `${rand(25, 35)}:${rand(10, 59).toString().padStart(2, '0')}`, away: `${rand(25, 35)}:${rand(10, 59).toString().padStart(2, '0')}` },
        sacks: { home: rand(0, 5), away: rand(0, 5) },
        interceptions: { home: rand(0, 3), away: rand(0, 3) },
        fumbles: { home: rand(0, 2), away: rand(0, 2) },
      };
    case 'tennis':
      return {
        sets: { home: [rand(0, 7), rand(0, 7)], away: [rand(0, 7), rand(0, 7)] },
        aces: { home: rand(2, 15), away: rand(2, 15) },
        doubleFaults: { home: rand(0, 5), away: rand(0, 5) },
        firstServePct: { home: rand(55, 75), away: rand(55, 75) },
        breakPoints: { home: `${rand(1, 4)}/${rand(3, 8)}`, away: `${rand(1, 4)}/${rand(3, 8)}` },
        winners: { home: rand(15, 40), away: rand(15, 40) },
        unforcedErrors: { home: rand(10, 35), away: rand(10, 35) },
      };
    case 'mma':
      return {
        round: rand(1, 5),
        totalRounds: 3,
        strikes: { home: rand(30, 100), away: rand(30, 100) },
        takedowns: { home: rand(0, 5), away: rand(0, 5) },
        significantStrikes: { home: rand(20, 80), away: rand(20, 80) },
      };
    case 'hockey':
      return {
        shots: { home: rand(20, 40), away: rand(20, 40) },
        powerPlayGoals: { home: rand(0, 2), away: rand(0, 2) },
        penaltyMinutes: { home: rand(2, 12), away: rand(2, 12) },
        faceoffWins: { home: rand(20, 35), away: rand(20, 35) },
        hitsCount: { home: rand(15, 35), away: rand(15, 35) },
        blockedShots: { home: rand(8, 20), away: rand(8, 20) },
      };
    case 'baseball':
      return {
        hits: { home: rand(5, 12), away: rand(5, 12) },
        errors: { home: rand(0, 2), away: rand(0, 2) },
        innings: { home: [rand(0, 3), rand(0, 2), rand(0, 3), rand(0, 2), rand(0, 3), rand(0, 2), rand(0, 3), rand(0, 2), rand(0, 3)], away: [rand(0, 3), rand(0, 2), rand(0, 3), rand(0, 2), rand(0, 3), rand(0, 2), rand(0, 3), rand(0, 2), rand(0, 3)] },
        strikeouts: { home: rand(4, 12), away: rand(4, 12) },
        walks: { home: rand(1, 5), away: rand(1, 5) },
        homeRuns: { home: rand(0, 3), away: rand(0, 3) },
      };
    case 'cricket':
      return {
        overs: { home: `${rand(15, 20)}.${rand(0, 5)}`, away: `${rand(15, 20)}.${rand(0, 5)}` },
        wickets: { home: rand(1, 10), away: rand(1, 10) },
        runRate: { home: rand(6, 12), away: rand(6, 12) },
        extras: { home: rand(2, 12), away: rand(2, 12) },
      };
    default:
      return undefined;
  }
}

// Generic ESPN match fetcher.
// For priority leagues, fetch a multi-day window so today + the upcoming week
// always show up — ESPN's default scoreboard otherwise only returns the
// nearest active game-day for that league (e.g. EPL midweek matches were missing).
async function getESPNMatches(config: ESPNLeagueConfig): Promise<UnifiedMatch[]> {
  const cacheKey = `espn-${config.sport}-${config.league}`;
  const cached = getCached<UnifiedMatch[]>(cacheKey, CACHE_DURATION.live);
  if (cached) return cached;

  // Fetch yesterday + next 14 days for EVERY league (not just priority ones)
  // so smaller sports always surface their upcoming fixtures, not just live.
  const isPriority = PRIORITY_LEAGUE_KEYS.has(config.league);
  let data: ESPNScoreboardResponseFull | null = null;
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(now);
  // Priority leagues get a 28-day window so the next ~4 weeks of fixtures are
  // always visible (was 21 — bumped to match oddspedia/freesupertips, which
  // typically show "next 4 weeks" of league action without paging). Smaller
  // / less-frequent leagues get a 60-day window so even a sparsely-played
  // cup competition still surfaces fixtures well in advance.
  end.setUTCDate(end.getUTCDate() + (isPriority ? 28 : 60));
  const range = `${formatYYYYMMDD(start)}-${formatYYYYMMDD(end)}`;
  data = await fetchESPN(config.sport, config.league, 'scoreboard', range);
  // Fall back to the default endpoint if range request fails or returns nothing.
  if (!data?.events?.length) {
    data = await fetchESPN(config.sport, config.league);
  }

  if (!data?.events) return [];

  // Sports without draws (basketball, baseball, mma, tennis etc.)
  const noDrawSports: ESPNLeagueConfig['sportType'][] = ['basketball', 'baseball', 'mma', 'tennis', 'golf', 'racing'];
  const hasDraw = !noDrawSports.includes(config.sportType);

  const matches: UnifiedMatch[] = data.events.map((event) => {
    const competition = event.competitions[0];
    const homeCompetitor = competition?.competitors.find(c => c.homeAway === 'home');
    const awayCompetitor = competition?.competitors.find(c => c.homeAway === 'away');
    
    // Handle both team sports and individual sports (tennis, golf, etc.)
    const homeTeamName = homeCompetitor?.team?.displayName || homeCompetitor?.team?.name || homeCompetitor?.athlete?.displayName || 'TBD';
    const awayTeamName = awayCompetitor?.team?.displayName || awayCompetitor?.team?.name || awayCompetitor?.athlete?.displayName || 'TBD';
    
    const status = mapESPNStatus(event.status);
    // Extract REAL odds from ESPN scoreboard (DraftKings/Caesars/etc) - NO computed fallback
    const { odds, markets } = extractEspnOdds(competition?.odds, hasDraw);
    const venue = competition?.venue?.fullName;

    return {
      id: `espn_${config.league.replace(/[^a-z0-9]/gi, '')}_${event.id}`,
      externalId: event.id,
      source: 'espn' as const,
      sportId: config.sportId,
      sportKey: `${config.sport}_${config.league}`,
      leagueId: config.leagueId,
      leagueKey: config.league,
      homeTeam: {
        id: homeCompetitor?.team?.id || homeCompetitor?.athlete?.id || '',
        name: homeTeamName,
        shortName: homeCompetitor?.team?.abbreviation || homeCompetitor?.athlete?.shortName || 'TBD',
        logo: homeCompetitor?.team?.logo,
        form: homeCompetitor?.form || undefined,
        record: homeCompetitor?.records?.find(r => r.type === 'total' || !r.type)?.summary || undefined,
      },
      awayTeam: {
        id: awayCompetitor?.team?.id || awayCompetitor?.athlete?.id || '',
        name: awayTeamName,
        shortName: awayCompetitor?.team?.abbreviation || awayCompetitor?.athlete?.shortName || 'TBD',
        logo: awayCompetitor?.team?.logo,
        form: awayCompetitor?.form || undefined,
        record: awayCompetitor?.records?.find(r => r.type === 'total' || !r.type)?.summary || undefined,
      },
      kickoffTime: new Date(event.date),
      status,
      // ESPN delivers score as a string ("0", "3", etc). Use a strict
      // null/undefined/'' check so a real "0" is preserved (treating "0" as
      // falsy here would silently turn 3-0 into 3-null on results pages).
      homeScore:
        homeCompetitor?.score !== undefined && homeCompetitor?.score !== null && homeCompetitor.score !== ''
          ? parseInt(homeCompetitor.score, 10)
          : null,
      awayScore:
        awayCompetitor?.score !== undefined && awayCompetitor?.score !== null && awayCompetitor.score !== ''
          ? parseInt(awayCompetitor.score, 10)
          : null,
      minute: extractLiveMinute(event.status, config.sportType) ?? undefined,
      period: event.status.displayClock,
      league: {
        id: config.leagueId,
        name: config.leagueName,
        // Prefer the friendly slug from ALL_LEAGUES (e.g. "premier-league") so
        // sidebar links and matches-page links resolve to the same URL. Fall
        // back to the ESPN-style code (e.g. "eng-1") only when no row exists.
        slug: ALL_LEAGUES.find(l => l.id === config.leagueId)?.slug || config.league.replace(/\./g, '-'),
        country: config.country,
        countryCode: config.countryCode,
        tier: 1,
      },
      sport: {
        id: config.sportId,
        name: ALL_SPORTS.find(s => s.id === config.sportId)?.name || config.sport,
        slug: ALL_SPORTS.find(s => s.id === config.sportId)?.slug || config.sport,
        icon: ALL_SPORTS.find(s => s.id === config.sportId)?.icon || config.sport,
      },
      odds,
      markets,
      tipsCount: 0,
      venue,
    };
  });

  // Filter out tournament-style events without a proper head-to-head matchup
  const filtered = matches.filter(m => {
    if (m.homeTeam.name === 'TBD' && m.awayTeam.name === 'TBD') return false;
    return true;
  });

  setCache(cacheKey, filtered);
  return filtered;
}

// ============================================
// The Odds API Client
// ============================================

const THE_ODDS_API_SPORTS: Record<string, { sportId: number; leagueId: number }> = {
  'soccer_epl': { sportId: 1, leagueId: 1 },
  'soccer_spain_la_liga': { sportId: 1, leagueId: 2 },
  'soccer_germany_bundesliga': { sportId: 1, leagueId: 3 },
  'soccer_italy_serie_a': { sportId: 1, leagueId: 4 },
  'soccer_france_ligue_one': { sportId: 1, leagueId: 5 },
  'soccer_uefa_champs_league': { sportId: 1, leagueId: 9 },
  'basketball_nba': { sportId: 2, leagueId: 101 },
  'americanfootball_nfl': { sportId: 5, leagueId: 401 },
  'baseball_mlb': { sportId: 6, leagueId: 501 },
  'icehockey_nhl': { sportId: 7, leagueId: 601 },
  'mma_mixed_martial_arts': { sportId: 27, leagueId: 2701 },
};

// Track quota exhaustion so we don't keep hammering the API
let theOddsApiOutOfCredits = 0; // timestamp when last 401/429 happened
const QUOTA_BACKOFF_MS = 60 * 60 * 1000; // 1 hour back-off

export async function fetchTheOddsAPI(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  // Read from admin DB first, fall back to env var. Allows admins to
  // rotate the key from /admin/settings → API Keys without redeploy.
  const { getApiKey } = await import('@/lib/api-keys');
  const apiKey = await getApiKey('the_odds_api_key');
  if (!apiKey || apiKey === 'your_api_key_here') {
    return null;
  }

  // If out of credits, skip until back-off expires
  if (theOddsApiOutOfCredits > 0 && Date.now() - theOddsApiOutOfCredits < QUOTA_BACKOFF_MS) {
    return null;
  }

  const url = new URL(`https://api.the-odds-api.com/v4/${endpoint}`);
  url.searchParams.set('apiKey', apiKey);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  try {
    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      apiStatus.theOddsApi.working = false;
      apiStatus.theOddsApi.lastError = `HTTP ${response.status}`;
      apiStatus.theOddsApi.lastCheck = Date.now();
      // Detect quota errors and back off
      if (response.status === 401 || response.status === 429) {
        try {
          const body = await response.json();
          if (body?.error_code === 'OUT_OF_USAGE_CREDITS' || body?.error_code === 'INVALID_API_KEY' || response.status === 429) {
            theOddsApiOutOfCredits = Date.now();
            apiStatus.theOddsApi.lastError = `${body?.error_code || 'QUOTA_EXCEEDED'}`;
            console.warn('[TheOddsAPI] Quota exhausted or invalid key — backing off for 1 hour. Falling back to computed odds.');
          }
        } catch {
          theOddsApiOutOfCredits = Date.now();
        }
      }
      return null;
    }

    apiStatus.theOddsApi.working = true;
    apiStatus.theOddsApi.lastCheck = Date.now();
    // Reset backoff on success
    theOddsApiOutOfCredits = 0;
    return await response.json();
  } catch (error) {
    apiStatus.theOddsApi.working = false;
    apiStatus.theOddsApi.lastError = String(error);
    return null;
  }
}

export function isTheOddsApiQuotaExhausted(): boolean {
  return theOddsApiOutOfCredits > 0 && Date.now() - theOddsApiOutOfCredits < QUOTA_BACKOFF_MS;
}

// ============================================
// Unified API - Combines All Sources
// ============================================

// ============================================
// The Odds API event type
// ============================================
interface TheOddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: Array<{
    key: string;
    title: string;
    last_update: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
        point?: number;
      }>;
    }>;
  }>;
}

// Normalize team name for fuzzy matching
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|cfc|club|the)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Compute average odds across bookmakers (best of)
function aggregateBookmakerOdds(event: TheOddsApiEvent): { odds?: MatchOdds; markets?: Market[] } {
  if (!event.bookmakers || event.bookmakers.length === 0) return {};

  const h2hPrices: { home: number[]; draw: number[]; away: number[] } = { home: [], draw: [], away: [] };
  const marketsMap = new Map<string, Map<string, number[]>>();

  for (const bm of event.bookmakers) {
    for (const market of bm.markets) {
      if (market.key === 'h2h') {
        for (const o of market.outcomes) {
          if (o.name === event.home_team) h2hPrices.home.push(o.price);
          else if (o.name === event.away_team) h2hPrices.away.push(o.price);
          else if (o.name.toLowerCase() === 'draw') h2hPrices.draw.push(o.price);
        }
      } else {
        if (!marketsMap.has(market.key)) marketsMap.set(market.key, new Map());
        const outcomesMap = marketsMap.get(market.key)!;
        for (const o of market.outcomes) {
          const k = o.point !== undefined ? `${o.name}|${o.point}` : o.name;
          if (!outcomesMap.has(k)) outcomesMap.set(k, []);
          outcomesMap.get(k)!.push(o.price);
        }
      }
    }
  }

  const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((s, p) => s + p, 0) / arr.length) * 100) / 100 : undefined;
  const odds: MatchOdds | undefined = h2hPrices.home.length && h2hPrices.away.length ? {
    home: avg(h2hPrices.home)!,
    draw: avg(h2hPrices.draw),
    away: avg(h2hPrices.away)!,
    bookmaker: `${event.bookmakers.length} bookmakers`,
    lastUpdate: new Date(),
  } : undefined;

  const markets: Market[] = [];
  if (odds) {
    markets.push({
      key: 'h2h',
      name: 'Match Result',
      outcomes: [
        { name: event.home_team, price: odds.home },
        ...(odds.draw ? [{ name: 'Draw', price: odds.draw }] : []),
        { name: event.away_team, price: odds.away },
      ],
    });
  }
  for (const [marketKey, outcomesMap] of marketsMap.entries()) {
    const outs: Outcome[] = [];
    for (const [k, prices] of outcomesMap.entries()) {
      const [name, pointStr] = k.split('|');
      outs.push({
        name,
        price: avg(prices)!,
        ...(pointStr ? { point: parseFloat(pointStr) } : {}),
      });
    }
    markets.push({
      key: marketKey,
      name: marketKey === 'spreads' ? 'Point Spread' : marketKey === 'totals' ? 'Totals' : marketKey,
      outcomes: outs,
    });
  }

  return { odds, markets };
}

// Fetch live odds from The Odds API for one sport key
async function fetchOddsForSport(sportKey: string): Promise<TheOddsApiEvent[]> {
  const cacheKey = `odds-${sportKey}`;
  const cached = getCached<TheOddsApiEvent[]>(cacheKey, 10 * 60 * 1000); // 10 min cache
  if (cached) return cached;

  const data = await fetchTheOddsAPI(`sports/${sportKey}/odds`, {
    regions: 'uk,eu,us',
    markets: 'h2h,spreads,totals',
    oddsFormat: 'decimal',
    dateFormat: 'iso',
  }) as TheOddsApiEvent[] | null;

  if (!data || !Array.isArray(data)) return [];
  setCache(cacheKey, data);
  return data;
}

// Build a lookup of real odds keyed by normalized team pair
async function buildRealOddsIndex(): Promise<Map<string, { odds: MatchOdds; markets: Market[] }>> {
  const { getApiKey } = await import('@/lib/api-keys');
  const apiKey = await getApiKey('the_odds_api_key');
  if (!apiKey || apiKey === 'your_api_key_here') return new Map();

  const sportKeys = Object.keys(THE_ODDS_API_SPORTS);
  // Fetch all in parallel
  const results = await Promise.allSettled(sportKeys.map(sk => fetchOddsForSport(sk)));

  const index = new Map<string, { odds: MatchOdds; markets: Market[] }>();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const ev of result.value) {
      const { odds, markets } = aggregateBookmakerOdds(ev);
      if (!odds) continue;
      const home = normalizeTeamName(ev.home_team);
      const away = normalizeTeamName(ev.away_team);
      const dateKey = new Date(ev.commence_time).toISOString().split('T')[0];
      // Index by both orderings — ESPN sometimes flips home/away
      index.set(`${home}_${away}_${dateKey}`, { odds, markets: markets || [] });
      index.set(`${away}_${home}_${dateKey}`, { odds, markets: markets || [] });
    }
  }
  return index;
}

// Global-level cache for getAllMatches — shared across all concurrent requests.
// This prevents the "thundering herd" where 5+ SWR hooks all hit the external
// APIs simultaneously on page load, making the homepage feel slow.
const ALLMATCHES_CACHE_TTL = 20 * 1000; // 20 seconds
const g_allMatchesCache: { data: UnifiedMatch[] | null; ts: number; promise: Promise<UnifiedMatch[]> | null } = { data: null, ts: 0, promise: null };

export async function getAllMatches(): Promise<UnifiedMatch[]> {
  // Return cached result if fresh
  if (g_allMatchesCache.data && Date.now() - g_allMatchesCache.ts < ALLMATCHES_CACHE_TTL) {
    return g_allMatchesCache.data;
  }
  // Deduplicate concurrent requests — return the same in-flight promise
  if (g_allMatchesCache.promise) return g_allMatchesCache.promise;

  const fetchPromise = _fetchAllMatches().finally(() => {
    g_allMatchesCache.promise = null;
  });
  g_allMatchesCache.promise = fetchPromise;
  return fetchPromise;
}

async function _fetchAllMatches(): Promise<UnifiedMatch[]> {
  const allMatches: UnifiedMatch[] = [];
  const seenMatchKeys = new Set<string>();

  const getMatchKey = (match: UnifiedMatch): string => {
    const homeNorm = match.homeTeam.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const awayNorm = match.awayTeam.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dateKey = new Date(match.kickoffTime).toISOString().split('T')[0];
    return `${homeNorm}_${awayNorm}_${dateKey}`;
  };

  const addMatch = (match: UnifiedMatch) => {
    const key = getMatchKey(match);
    if (!seenMatchKeys.has(key)) {
      seenMatchKeys.add(key);
      allMatches.push(match);
    }
  };

  // Fetch ESPN matches, real odds index AND every supplementary feed in parallel.
  // Each .catch() ensures one source going down never blocks the others.
  const [
    espnResults,
    realOddsIndex,
    tsdbMatches,
    oldbMatches,
    fdMatches,
    fmMatches,
    globalEspnMatches,
  ] = await Promise.all([
    Promise.allSettled(ESPN_LEAGUES.map(config => getESPNMatches(config))),
    buildRealOddsIndex(),
    fetchTSDBMatches().catch(() => [] as UnifiedMatch[]),
    fetchOpenLigaDBMatches().catch(() => [] as UnifiedMatch[]),
    fetchFootballDataOrgMatches().catch(() => [] as UnifiedMatch[]),
    fetchFotMobMatches().catch(() => [] as UnifiedMatch[]),
    fetchESPNGlobalAll().catch(() => [] as UnifiedMatch[]),
  ]);

  for (const result of espnResults) {
    if (result.status === 'fulfilled' && result.value) {
      for (const match of result.value) {
        // Try to enrich with real bookmaker odds
        if (realOddsIndex.size > 0) {
          const homeNorm = normalizeTeamName(match.homeTeam.name);
          const awayNorm = normalizeTeamName(match.awayTeam.name);
          const dateKey = new Date(match.kickoffTime).toISOString().split('T')[0];
          const real = realOddsIndex.get(`${homeNorm}_${awayNorm}_${dateKey}`);
          if (real) {
            match.odds = real.odds;
            // Merge real markets in front of generated markets, dedupe by key
            const existingKeys = new Set(real.markets.map(m => m.key));
            const otherMarkets = (match.markets || []).filter(m => !existingKeys.has(m.key));
            match.markets = [...real.markets, ...otherMarkets];
            match.source = 'the-odds-api';
          }
        }
        addMatch(match);
      }
    }
  }

  // Merge in supplementary sources (ESPN global catch-all, TheSportsDB,
  // OpenLigaDB, football-data.org, FotMob). Order matters because addMatch()
  // dedupes by team-pair+date and keeps the first source seen — we put
  // higher-trust feeds first.
  // ESPN per-league already added above. Then ESPN /all/scoreboard (covers
  // every other ESPN league we don't explicitly configure), then
  // football-data.org (top-tier), then OpenLigaDB (German depth),
  // then TheSportsDB (African/exotic), then FotMob (catch-all).
  const supplementarySources: UnifiedMatch[][] = [globalEspnMatches, fdMatches, oldbMatches, tsdbMatches, fmMatches];
  for (const source of supplementarySources) {
    for (const match of source) {
      if (realOddsIndex.size > 0) {
        const homeNorm = normalizeTeamName(match.homeTeam.name);
        const awayNorm = normalizeTeamName(match.awayTeam.name);
        const dateKey = new Date(match.kickoffTime).toISOString().split('T')[0];
        const real = realOddsIndex.get(`${homeNorm}_${awayNorm}_${dateKey}`);
        if (real) {
          match.odds = real.odds;
          match.markets = real.markets;
        }
      }
      addMatch(match);
    }
  }

  // Fire-and-forget: persist teams + leagues into MySQL when available.
  // Never blocks, never throws — silently no-ops on free tier without DB.
  try {
    const { persistMatchEntities } = await import('../db/sync');
    persistMatchEntities(allMatches);
  } catch { /* swallow */ }

  // Limit to a 5-day window: yesterday (for results) + today + 3 days ahead.
  // This prevents thousands of fixtures far in the future from bloating the list.
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 1); // include yesterday's results
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 3); // today + 3 days ahead
  windowEnd.setHours(23, 59, 59, 999);

  const windowed = allMatches.filter(m => {
    const t = new Date(m.kickoffTime).getTime();
    return t >= windowStart.getTime() && t <= windowEnd.getTime();
  });

  const sorted = sortMatchesWithPriority(windowed.length > 0 ? windowed : allMatches);

  // Update the global cache
  g_allMatchesCache.data = sorted;
  g_allMatchesCache.ts = Date.now();

  return sorted;
}

export async function getMatchesBySport(sportId: number): Promise<UnifiedMatch[]> {
  const allMatches = await getAllMatches();
  return allMatches.filter(m => m.sportId === sportId);
}

export async function getMatchesByLeague(leagueId: number): Promise<UnifiedMatch[]> {
  const allMatches = await getAllMatches();
  return allMatches.filter(m => m.leagueId === leagueId);
}

export async function getLiveMatches(): Promise<UnifiedMatch[]> {
  const allMatches = await getAllMatches();
  return allMatches.filter(m =>
    m.status === 'live' ||
    m.status === 'halftime' ||
    m.status === 'extra_time' ||
    m.status === 'penalties'
  );
}

export async function getUpcomingMatches(): Promise<UnifiedMatch[]> {
  const allMatches = await getAllMatches();
  const now = new Date();
  return allMatches
    .filter(m => m.status === 'scheduled' && new Date(m.kickoffTime) > now)
    .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());
}

// ============================================
// Standings API (real ESPN data)
// ============================================

interface ESPNStandingEntry {
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    logos?: Array<{ href?: string }>;
    logo?: string;
  };
  stats?: Array<{
    name?: string;
    type?: string;
    abbreviation?: string;
    value?: number;
    displayValue?: string;
  }>;
  note?: { description?: string; rank?: number };
}

interface ESPNStandingsResponse {
  children?: Array<{
    standings?: { entries?: ESPNStandingEntry[] };
  }>;
  standings?: { entries?: ESPNStandingEntry[] };
}

function pickStat(stats: ESPNStandingEntry['stats'], names: string[]): number {
  if (!stats) return 0;
  for (const s of stats) {
    const key = (s.name || s.type || s.abbreviation || '').toLowerCase();
    if (names.some(n => key === n.toLowerCase())) {
      const v = typeof s.value === 'number' ? s.value : parseFloat(s.displayValue || '0');
      if (Number.isFinite(v)) return v;
    }
  }
  return 0;
}

export async function getLeagueStandings(leagueId: number, seasonYear?: number): Promise<Standing[]> {
  const cacheKey = `standings-${leagueId}-${seasonYear ?? 'current'}`;
  const cached = getCached<Standing[]>(cacheKey, CACHE_DURATION.standings);
  if (cached) return cached;

  const config = ESPN_LEAGUES.find(l => l.leagueId === leagueId);
  if (!config) return [];

  // Soccer uses a slightly different host/path that exposes table directly.
  // For past seasons, use the core API with explicit year.
  let url: string;
  if (seasonYear) {
    url = `https://sports.core.api.espn.com/v2/sports/${config.sport}/leagues/${config.league}/seasons/${seasonYear}/types/2/groups/1/standings`;
  } else {
    url = config.sportType === 'soccer'
      ? `https://site.web.api.espn.com/apis/v2/sports/soccer/${config.league}/standings`
      : `https://site.api.espn.com/apis/v2/sports/${config.sport}/${config.league}/standings`;
  }

  let data: ESPNStandingsResponse | null = null;
  try {
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 600 },
    });
    if (resp.ok) data = await resp.json();
  } catch {
    /* network error → empty */
  }

  if (!data) return [];

  // ESPN packages standings either at top-level or in `children[].standings.entries`
  const entries: ESPNStandingEntry[] =
    data.standings?.entries ||
    data.children?.flatMap(c => c.standings?.entries || []) ||
    [];

  const standings: Standing[] = entries.map((e, idx) => {
    const won = pickStat(e.stats, ['wins', 'gameswon']);
    const drawn = pickStat(e.stats, ['ties', 'draws']);
    const lost = pickStat(e.stats, ['losses', 'gameslost']);
    const played = pickStat(e.stats, ['gamesplayed', 'games']) || won + drawn + lost;
    const goalsFor = pickStat(e.stats, ['pointsfor', 'goalsfor', 'pf']);
    const goalsAgainst = pickStat(e.stats, ['pointsagainst', 'goalsagainst', 'pa']);
    const goalDifference = pickStat(e.stats, ['pointdifferential', 'goaldifference', 'gd']) || (goalsFor - goalsAgainst);
    const points = pickStat(e.stats, ['points', 'leaguepoints']);
    const rank = pickStat(e.stats, ['rank']) || idx + 1;

    return {
      position: rank,
      team: {
        id: String(e.team?.id || idx),
        name: e.team?.displayName || e.team?.shortDisplayName || `Team ${idx + 1}`,
        logo: e.team?.logos?.[0]?.href || e.team?.logo,
      },
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDifference,
      points,
    };
  }).sort((a, b) => a.position - b.position);

  setCache(cacheKey, standings);
  return standings;
}

// ============================================
// Outrights API (real bookmaker odds via The Odds API)
// ============================================

interface TheOddsApiOutrightEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  bookmakers?: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number }>;
    }>;
  }>;
}

// leagueId → ARRAY of The Odds API sport_keys for OUTRIGHTS markets.
// We probe multiple winner / top-scorer / relegation keys per league and merge
// whichever ones return data — this catches seasonal markets that come and go.
//
// We try ALL of these in parallel; empty responses are skipped silently.
const LEAGUE_TO_ODDS_KEYS: Record<number, string[]> = {
  // ─── Soccer — top tiers ───
  1:  ['soccer_epl_winner', 'soccer_epl_top_scorer', 'soccer_epl_relegation'],
  2:  ['soccer_spain_la_liga_winner', 'soccer_spain_la_liga_top_scorer', 'soccer_spain_la_liga_relegation'],
  3:  ['soccer_germany_bundesliga_winner', 'soccer_germany_bundesliga_top_scorer'],
  4:  ['soccer_italy_serie_a_winner', 'soccer_italy_serie_a_top_scorer'],
  5:  ['soccer_france_ligue_one_winner', 'soccer_france_ligue_one_top_scorer'],
  6:  ['soccer_netherlands_eredivisie_winner'],
  7:  ['soccer_portugal_primeira_liga_winner'],
  8:  ['soccer_spl_winner'],                                  // Scottish Premiership
  11: ['soccer_usa_mls_winner', 'soccer_usa_mls_top_scorer'], // MLS
  12: ['soccer_brazil_campeonato_winner'],
  13: ['soccer_argentina_primera_division_winner'],
  15: ['soccer_turkey_super_league_winner'],
  16: ['soccer_belgium_first_div_winner'],
  // ─── Soccer — European competitions ───
  9:  ['soccer_uefa_champs_league_winner'],
  10: ['soccer_uefa_europa_league_winner'],
  26: ['soccer_uefa_europa_conference_league_winner'],
  220: ['soccer_uefa_super_cup_winner'],
  // ─── Soccer — domestic cups ───
  44: ['soccer_fa_cup_winner'],
  45: ['soccer_efl_cup_winner'],
  47: ['soccer_copa_del_rey_winner'],
  49: ['soccer_germany_dfb_pokal_winner'],
  51: ['soccer_italy_coppa_italia_winner'],
  53: ['soccer_france_coupe_winner'],
  // ─── Soccer — internationals ───
  29: ['soccer_fifa_world_cup_winner'],
  30: ['soccer_uefa_european_championship_winner', 'soccer_uefa_euros_qualification_winner'],
  31: ['soccer_conmebol_copa_america_winner'],
  24: ['soccer_caf_africa_cup_of_nations_winner'],
  109: ['soccer_fifa_club_world_cup_winner'],
  111: ['soccer_uefa_nations_league_winner'],
  // ─── Soccer — Lower European tiers ───
  41: ['soccer_efl_champ_winner'],                  // EFL Championship
  46: ['soccer_spain_segunda_division_winner'],     // La Liga 2
  48: ['soccer_germany_bundesliga2_winner'],        // 2. Bundesliga
  50: ['soccer_italy_serie_b_winner'],              // Serie B
  // ─── North-American majors — championship futures ───
  101: ['basketball_nba_championship_winner', 'basketball_nba_mvp'],
  107: ['basketball_wnba_championship_winner'],
  401: ['americanfootball_nfl_super_bowl_winner', 'americanfootball_nfl_mvp'],
  501: ['baseball_mlb_world_series_winner', 'baseball_mlb_world_series_mvp'],
  601: ['icehockey_nhl_championship_winner'],
  // ─── NCAA ───
  108: ['basketball_ncaab_championship_winner'],
  402: ['americanfootball_ncaaf_championship_winner'],
  // ─── Tennis (Grand Slam outrights) ───
  201: ['tennis_atp_aus_open_singles', 'tennis_atp_french_open_singles', 'tennis_atp_wimbledon_singles', 'tennis_atp_us_open_singles'],
  202: ['tennis_wta_aus_open_singles', 'tennis_wta_french_open_singles', 'tennis_wta_wimbledon_singles', 'tennis_wta_us_open_singles'],
  // ─── Cricket ───
  301: ['cricket_ipl_winner'],
  302: ['cricket_big_bash_winner'],
  306: ['cricket_psl_winner'],
  // ─── Golf majors ───
  1701: ['golf_masters_tournament_winner', 'golf_us_open_winner', 'golf_the_open_championship_winner', 'golf_pga_championship_winner'],
  1702: ['golf_dp_world_tour_championship_winner'],
  // ─── Motorsports ───
  2901: ['motorsport_f1_drivers_championship', 'motorsport_f1_constructors_championship'],
};

// Cached list of currently active outright sport keys from The Odds API.
// Markets come and go (Super Bowl winner runs all year, EPL Winner only in season).
// We re-fetch every 6h.
let activeOutrightKeysCache: { keys: Set<string>; ts: number } | null = null;
async function getActiveOutrightKeys(): Promise<Set<string>> {
  if (activeOutrightKeysCache && Date.now() - activeOutrightKeysCache.ts < 6 * 60 * 60_000) {
    return activeOutrightKeysCache.keys;
  }
  const list = await fetchTheOddsAPI('sports', { all: 'true' }) as Array<{ key: string; active: boolean; has_outrights: boolean }> | null;
  const keys = new Set<string>();
  if (Array.isArray(list)) {
    for (const s of list) {
      if (s.active && s.has_outrights) keys.add(s.key);
    }
  }
  activeOutrightKeysCache = { keys, ts: Date.now() };
  return keys;
}

export async function getLeagueOutrights(leagueId: number): Promise<Outright[]> {
  const cacheKey = `outrights-${leagueId}`;
  const cached = getCached<Outright[]>(cacheKey, CACHE_DURATION.outrights);
  if (cached) return cached;

  // First try SportsGameOdds (covers UCL + MLS on free tier; richer book coverage).
  // Their data is keyed differently so we run both providers and concat.
  const { getSgoOutrights } = await import('@/lib/api/sportsgameodds');
  const sgoOutrights = await getSgoOutrights(leagueId).catch(() => []);

  const sportKeys = LEAGUE_TO_ODDS_KEYS[leagueId];
  if (!sportKeys || sportKeys.length === 0) {
    setCache(cacheKey, sgoOutrights);
    return sgoOutrights;
  }

  // Filter to only sport keys actually active right now in The Odds API —
  // calling an inactive key returns INVALID_MARKET_COMBO and burns quota.
  const activeKeys = await getActiveOutrightKeys();
  const callableKeys = sportKeys.filter(k => activeKeys.has(k));
  if (callableKeys.length === 0) {
    setCache(cacheKey, []);
    return [];
  }

  // Probe all callable outright keys in parallel.
  const responses = await Promise.allSettled(
    callableKeys.map(sportKey => fetchTheOddsAPI(`sports/${sportKey}/odds`, {
      regions: 'uk,eu,us',
      markets: 'outrights',
      oddsFormat: 'decimal',
      dateFormat: 'iso',
    }) as Promise<TheOddsApiOutrightEvent[] | null>),
  );

  const outrights: Outright[] = [];

  for (const result of responses) {
    if (result.status !== 'fulfilled') continue;
    const data = result.value;
    if (!data || !Array.isArray(data) || data.length === 0) continue;

    for (const ev of data) {
      if (!ev.bookmakers || ev.bookmakers.length === 0) continue;

      // outcome name → array of prices across bookmakers
      const tally = new Map<string, number[]>();
      for (const bm of ev.bookmakers) {
        for (const market of bm.markets) {
          if (market.key !== 'outrights') continue;
          for (const o of market.outcomes) {
            if (!tally.has(o.name)) tally.set(o.name, []);
            tally.get(o.name)!.push(o.price);
          }
        }
      }

      if (tally.size === 0) continue;

      const outcomes = Array.from(tally.entries())
        .map(([name, prices]) => ({
          name,
          // best (highest) decimal price across bookmakers — that's what punters want
          price: Math.round(Math.max(...prices) * 100) / 100,
        }))
        .sort((a, b) => a.price - b.price); // shortest odds = favourite first

      outrights.push({
        id: ev.id,
        name: ev.sport_title || 'Outright Winner',
        outcomes,
      });
    }
  }

  // Merge in any SGO outrights (de-dup on (name, top outcome)) so we never
  // show the same market twice if both providers return it.
  const seen = new Set(outrights.map(o => `${o.name}::${o.outcomes[0]?.name || ''}`));
  for (const sgo of sgoOutrights) {
    const key = `${sgo.name}::${sgo.outcomes[0]?.name || ''}`;
    if (!seen.has(key)) {
      outrights.push(sgo);
      seen.add(key);
    }
  }

  // ─── Deterministic fallback ─────────────────────────────────────────────
  // If both providers returned nothing, derive a "Title Race" outright from
  // the live standings table — top 6 teams scored by points + goal-difference.
  // This guarantees the league/competition outright section never goes empty
  // for active league seasons (EPL, La Liga, MLS, etc.) even when neither
  // The Odds API nor SGO covers them.
  if (outrights.length === 0) {
    const fallback = await buildOutrightFromStandings(leagueId).catch(() => null);
    if (fallback) outrights.push(fallback);
  }

  setCache(cacheKey, outrights);
  return outrights;
}

/**
 * Synthetic outright winner market built from the current standings table.
 *
 * We compute each team's "title equity" as a function of:
 *   • current points (the dominant factor)
 *   • goal difference (tie-breaker)
 *   • position penalty (each rung down halves the implied probability)
 *
 * The top 6 are surfaced; the long tail collapses into "Field" so totals
 * roughly sum to 1.0. Decimal odds are then 1 / probability.
 */
export async function buildOutrightFromStandings(leagueId: number): Promise<Outright | null> {
  const standings = await getLeagueStandings(leagueId).catch(() => []);
  if (!standings || standings.length < 4) return null;

  // Score each team — points dominate, GD is tertiary, position adds decay.
  const scored = standings
    .map(s => {
      const ptsScore = Math.max(0, s.points);
      const gdScore = Math.max(0, s.goalDifference) * 0.1;
      // Position decay — leader = 1.0, 2nd = 0.55, 3rd = 0.32, etc.
      const decay = Math.pow(0.55, Math.max(0, s.position - 1));
      return { team: s.team, raw: (ptsScore + gdScore) * decay };
    })
    .filter(s => s.raw > 0);

  if (scored.length === 0) return null;

  const total = scored.reduce((acc, s) => acc + s.raw, 0);
  if (total === 0) return null;

  const top = scored.slice(0, 6).map(s => ({
    name: s.team.name,
    // Add 7% house margin (typical bookmaker overround) so prices look real.
    price: Math.round((1 / (s.raw / total)) * 0.93 * 100) / 100,
  }));

  // Long-tail "Field" outcome
  const tailRaw = scored.slice(6).reduce((acc, s) => acc + s.raw, 0);
  if (tailRaw > 0) {
    top.push({
      name: 'Any other team',
      price: Math.round((1 / (tailRaw / total)) * 0.93 * 100) / 100,
    });
  }

  return {
    id: `synthetic-outright-${leagueId}`,
    name: 'Title Winner (computed from current standings)',
    outcomes: top.sort((a, b) => a.price - b.price),
  };
}

// ============================================
// Top scorers / leaders (real ESPN data)
// ============================================

export interface TopScorer {
  position: number;
  player: {
    id: string;
    name: string;
    photo?: string;
    position?: string;
  };
  team: { id?: string; name: string; logo?: string };
  stats: { goals: number; appearances?: number; assists?: number };
}

interface ESPNLeader {
  displayValue?: string;
  value?: number;
  athlete?: {
    id?: string;
    displayName?: string;
    shortName?: string;
    headshot?: { href?: string };
    position?: { abbreviation?: string };
    team?: { id?: string; displayName?: string; logo?: string; logos?: Array<{ href?: string }> };
  };
  team?: { id?: string; displayName?: string; logo?: string; logos?: Array<{ href?: string }> };
}

interface ESPNLeadersResponse {
  categories?: Array<{
    name?: string;
    displayName?: string;
    abbreviation?: string;
    leaders?: ESPNLeader[];
  }>;
  leaders?: Array<{
    name?: string;
    displayName?: string;
    abbreviation?: string;
    leaders?: ESPNLeader[];
  }>;
}

type CoreLeader = {
  displayValue?: string;
  shortDisplayValue?: string;
  value?: number;
  athlete?: { $ref?: string; id?: string | number; displayName?: string; shortName?: string; headshot?: { href?: string }; position?: { abbreviation?: string } };
  team?: { $ref?: string; id?: string | number; displayName?: string; logos?: Array<{ href?: string }>; logo?: string };
};

async function dereferenceEspnRef<T>(ref?: string): Promise<T | null> {
  if (!ref) return null;
  try {
    // ESPN $ref values come back as http:// — upgrade to https for safety
    const url = ref.replace(/^http:\/\//, 'https://');
    const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

export async function getLeagueTopScorers(leagueId: number, limit = 10): Promise<TopScorer[]> {
  const cacheKey = `top-scorers-${leagueId}-${limit}`;
  const cached = getCached<TopScorer[]>(cacheKey, CACHE_DURATION.standings);
  if (cached) return cached;

  const config = ESPN_LEAGUES.find(l => l.leagueId === leagueId);
  if (!config) return [];

  // The reliable ESPN core leaders endpoint: per-season per-type.
  // type=1 (regular season) is the only one that's populated for soccer/most leagues.
  // Try current year first, then previous year (covers off-season + late-starting leagues).
  const now = new Date();
  const yr = now.getUTCFullYear();
  const candidates = [
    `https://sports.core.api.espn.com/v2/sports/${config.sport}/leagues/${config.league}/seasons/${yr}/types/1/leaders`,
    `https://sports.core.api.espn.com/v2/sports/${config.sport}/leagues/${config.league}/seasons/${yr - 1}/types/1/leaders`,
    `https://sports.core.api.espn.com/v2/sports/${config.sport}/leagues/${config.league}/seasons/${yr}/types/2/leaders`,
  ];

  let data: { categories?: Array<{ name?: string; displayName?: string; leaders?: CoreLeader[] }> } | null = null;
  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 1800 } });
      if (!r.ok) continue;
      const j = await r.json();
      if (j?.categories?.length) { data = j; break; }
    } catch { /* try next */ }
  }

  if (!data?.categories?.length) {
    setCache(cacheKey, []);
    return [];
  }

  // Sport-aware scoring category — soccer uses goalsLeaders, basketball uses pointsPerGame, etc.
  const SCORING_PRIORITY: Record<string, string[]> = {
    soccer: ['goalsLeaders', 'goals'],
    basketball: ['pointsPerGame', 'points', 'totalPoints', 'pointsLeaders'],
    football: ['passingYards', 'rushingYards', 'totalTouchdowns'],
    baseball: ['homeRuns', 'rbi', 'battingAverage'],
    hockey: ['goals', 'points', 'goalsLeaders'],
  };
  const wantList = SCORING_PRIORITY[config.sport] || ['goals', 'goalsLeaders', 'points'];
  const scoringCat =
    wantList.map(n => data!.categories!.find(c => (c.name || '').toLowerCase() === n.toLowerCase())).find(Boolean) ||
    data.categories.find(c => /goal|point|score/i.test(c.name || c.displayName || '')) ||
    data.categories[0];

  if (!scoringCat?.leaders?.length) {
    setCache(cacheKey, []);
    return [];
  }

  // Dereference athlete + team for top N in parallel
  const top = scoringCat.leaders.slice(0, limit);
  const enriched = await Promise.all(top.map(async (l, idx) => {
    const [athlete, team] = await Promise.all([
      dereferenceEspnRef<{ id?: string; displayName?: string; shortName?: string; headshot?: { href?: string }; position?: { abbreviation?: string } }>(l.athlete?.$ref),
      dereferenceEspnRef<{ id?: string; displayName?: string; logos?: Array<{ href?: string }> }>(l.team?.$ref),
    ]);
    const goals = typeof l.value === 'number' ? l.value : parseFloat(l.displayValue || '0') || 0;
    return {
      position: idx + 1,
      player: {
        id: String(athlete?.id || idx),
        name: athlete?.displayName || athlete?.shortName || `Player ${idx + 1}`,
        photo: athlete?.headshot?.href,
        position: athlete?.position?.abbreviation,
      },
      team: {
        id: team?.id ? String(team.id) : undefined,
        name: team?.displayName || 'Unknown',
        logo: team?.logos?.[0]?.href,
      },
      stats: { goals: Math.round(goals) },
    } as TopScorer;
  }));

  setCache(cacheKey, enriched);
  return enriched;
}

// ============================================
// Helper Functions
// ============================================

const SPORT_PRIORITY: Record<number, number> = {
  1: 0,   // Football
  2: 1,   // Basketball
  3: 2,   // Tennis
  4: 3,   // Cricket
  5: 4,   // American Football
  6: 5,   // Baseball
  7: 6,   // Ice Hockey
  8: 7,   // Rugby
  27: 8,  // MMA
  26: 9,  // Boxing
  29: 10, // Formula 1
  17: 11, // Golf
  33: 12, // Esports
};

export function sortMatchesWithPriority(matches: UnifiedMatch[]): UnifiedMatch[] {
  return matches.sort((a, b) => {
    const sportPriorityA = SPORT_PRIORITY[a.sportId] ?? 99;
    const sportPriorityB = SPORT_PRIORITY[b.sportId] ?? 99;
    if (sportPriorityA !== sportPriorityB) return sportPriorityA - sportPriorityB;

    const statusOrder = { live: 0, halftime: 1, scheduled: 2, finished: 3, postponed: 4, cancelled: 5 };
    const statusOrderA = statusOrder[a.status] ?? 5;
    const statusOrderB = statusOrder[b.status] ?? 5;
    if (statusOrderA !== statusOrderB) return statusOrderA - statusOrderB;

    return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
  });
}

export async function getMatchById(matchId: string): Promise<UnifiedMatch | null> {
  // 1) Fast path — match is in the current rolling window (today/upcoming/recent).
  //    Wrapped in its own try so a transient scoreboard error doesn't kill the
  //    direct-lookup fallback below.
  try {
    const allMatches = await getAllMatches();
    const found = allMatches.find(m => m.id === matchId);
    if (found) return found;
  } catch (error) {
    console.warn('[API] getAllMatches failed during getMatchById fast-path:', error);
  }

  try {
    // 2) Fallback — direct ESPN lookup. This catches:
    //    • Older / further-future fixtures outside the cached scoreboard window
    //    • Past H2H meetings linked from the match-detail page
    //    • Direct/shared/refreshed match URLs after the league cache rotated
    const cfg = getEspnLeagueConfigForId(matchId);
    const eventId = getEspnEventIdFromMatchId(matchId);
    if (!cfg || !eventId) return null;

    const summary = await fetchESPNSummary(cfg.sport, cfg.league, eventId);
    const competition = summary?.header?.competitions?.[0];
    if (!competition) return null;

    const homeComp = competition.competitors?.find(c => c.homeAway === 'home');
    const awayComp = competition.competitors?.find(c => c.homeAway === 'away');
    if (!homeComp || !awayComp) return null;

    const noDrawSports: ESPNLeagueConfig['sportType'][] = ['basketball', 'baseball', 'mma', 'tennis', 'golf', 'racing'];
    const hasDraw = !noDrawSports.includes(cfg.sportType);
    const summaryOddsList = [...(summary?.pickcenter || []), ...(summary?.odds || [])];
    const { odds, markets } = extractEspnOdds(summaryOddsList, hasDraw);

    // Best-effort kickoff time — ESPN summary doesn't always include `date`,
    // so we leave it as "now" if absent (the detail page formats it gracefully).
    const kickoff = (summary as unknown as { header?: { competitions?: Array<{ date?: string }> } })?.header?.competitions?.[0]?.date;

    // Best-effort status — derive from ESPN's status block on the competition.
    // We previously used `competitors.some(c => typeof c.winner === 'boolean')`
    // which matched scheduled games too (`winner: false` is a boolean), so
    // upcoming fixtures were being shown as FT 0:0. Use the canonical
    // `status.type.{state,completed}` instead, which is set even for the
    // direct-summary path.
    const compStatus = (competition as { status?: { type?: { state?: string; completed?: boolean; name?: string } } }).status
      || (summary?.header as { competitions?: Array<{ status?: { type?: { state?: string; completed?: boolean; name?: string } } }> })?.competitions?.[0]?.status;
    const stateRaw = (compStatus?.type?.state || '').toLowerCase();
    const nameRaw = (compStatus?.type?.name || '').toLowerCase();
    let status: UnifiedMatch['status'];
    if (compStatus?.type?.completed || stateRaw === 'post' || nameRaw.includes('final')) {
      status = 'finished';
    } else if (stateRaw === 'in' || nameRaw.includes('in_progress') || nameRaw.includes('halftime')) {
      status = nameRaw.includes('halftime') ? 'halftime' : 'live';
    } else {
      status = 'scheduled';
    }

    // Don't trust score values for unstarted games — ESPN sometimes returns "0"
    // even before kickoff which makes the UI show 0:0.
    const isStartedOrFinished = status === 'live' || status === 'halftime' || status === 'finished';
    const homeScoreNum = isStartedOrFinished && homeComp.score !== undefined && homeComp.score !== null && homeComp.score !== ''
      ? parseInt(String(homeComp.score), 10) : null;
    const awayScoreNum = isStartedOrFinished && awayComp.score !== undefined && awayComp.score !== null && awayComp.score !== ''
      ? parseInt(String(awayComp.score), 10) : null;

    const sportMeta = ALL_SPORTS.find(s => s.id === cfg.sportId);
    const leagueMeta = ALL_LEAGUES.find(l => l.id === cfg.leagueId);

    return {
      id: matchId,
      externalId: eventId,
      source: 'espn',
      sportId: cfg.sportId,
      sportKey: `${cfg.sport}_${cfg.league}`,
      leagueId: cfg.leagueId,
      leagueKey: cfg.league,
      homeTeam: {
        id: homeComp.team?.id || '',
        name: homeComp.team?.displayName || 'Home',
        shortName: homeComp.team?.abbreviation || 'HOM',
        logo: homeComp.team?.logo,
        form: homeComp.form,
        record: homeComp.record?.find(r => r.type === 'total' || !r.type)?.summary,
      },
      awayTeam: {
        id: awayComp.team?.id || '',
        name: awayComp.team?.displayName || 'Away',
        shortName: awayComp.team?.abbreviation || 'AWY',
        logo: awayComp.team?.logo,
        form: awayComp.form,
        record: awayComp.record?.find(r => r.type === 'total' || !r.type)?.summary,
      },
      kickoffTime: kickoff ? new Date(kickoff) : new Date(),
      status,
      homeScore: homeScoreNum,
      awayScore: awayScoreNum,
      league: {
        id: cfg.leagueId,
        name: cfg.leagueName,
        slug: leagueMeta?.slug || cfg.league.replace(/\./g, '-'),
        country: cfg.country,
        countryCode: cfg.countryCode,
        tier: 1,
      },
      sport: {
        id: cfg.sportId,
        name: sportMeta?.name || cfg.sport,
        slug: sportMeta?.slug || cfg.sport,
        icon: sportMeta?.icon || cfg.sport,
      },
      odds,
      markets,
      tipsCount: 0,
      venue: summary?.gameInfo?.venue?.fullName,
    };
  } catch (error) {
    console.error('[API] Error fetching match by ID:', error);
    return null;
  }
}

export function getSportIcon(slug: string): string {
  const icons: Record<string, string> = {
    'football': 'soccer',
    'soccer': 'soccer',
    'basketball': 'basketball',
    'tennis': 'tennis',
    'cricket': 'cricket',
    'american-football': 'football',
    'baseball': 'baseball',
    'ice-hockey': 'hockey',
    'rugby': 'rugby',
    'mma': 'mma',
    'boxing': 'boxing',
    'formula-1': 'formula-1',
    'golf': 'golf',
    'esports': 'esports',
  };
  return icons[slug] || 'trophy';
}

// Export ESPN leagues config for external use
export { ESPN_LEAGUES };
export type { ESPNLeagueConfig };
