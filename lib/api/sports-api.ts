// ============================================
// Sports API Service - Real Match Data
// ============================================

import { ALL_SPORTS, ALL_LEAGUES, TEAMS_DATABASE, BOOKMAKERS, getSportIcon, type SportConfig, type LeagueConfig, type TeamConfig } from '@/lib/sports-data';

export interface Match {
  id: string;
  sportId: number;
  leagueId: number;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    logo?: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    logo?: string;
  };
  kickoffTime: Date;
  status: 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed';
  homeScore: number | null;
  awayScore: number | null;
  minute?: number;
  league: {
    id: number;
    name: string;
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
  odds?: {
    home: number;
    draw: number;
    away: number;
  };
  tipsCount: number;
}

// ============================================
// Sport and League Priority System
// ============================================

// Sport priority - Football always first, then by popularity
export const SPORT_PRIORITY: Record<number, number> = {
  1: 0,   // Football - highest priority
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
  33: 11, // Esports
};

// European Top 5 League IDs
const EUROPEAN_TOP_5_LEAGUES = [1, 2, 3, 4, 5]; // Premier League, La Liga, Bundesliga, Serie A, Ligue 1
const EUROPEAN_COMPETITIONS = [9, 10]; // Champions League, Europa League

// Country to local league mapping
const COUNTRY_LEAGUES: Record<string, number[]> = {
  // Africa
  'KE': [22, 21, 24], // Kenya Premier League, CAF Champions League, AFCON
  'NG': [21, 24], // CAF CL, AFCON
  'GH': [21, 24],
  'EG': [23, 21, 24], // Egyptian Premier League
  'ZA': [21, 24],
  
  // Europe - show local league + top 5
  'GB': [1, 8, 9, 10, ...EUROPEAN_TOP_5_LEAGUES], // Premier League, Scottish
  'ES': [2, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'DE': [3, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'IT': [4, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'FR': [5, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'NL': [6, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'PT': [7, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'TR': [15, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'BE': [16, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  'RU': [17, 9, 10, ...EUROPEAN_TOP_5_LEAGUES],
  
  // Americas
  'US': [11, 401, 101, 501, 601], // MLS, NFL, NBA, MLB, NHL
  'BR': [12, 25], // Brazilian Serie A, Copa Libertadores
  'AR': [13, 25],
  'MX': [11, 25],
  
  // Asia
  'JP': [18, 502], // J League, NPB
  'KR': [19, 503], // K League, KBO
  'CN': [104], // CBA
  'SA': [14], // Saudi Pro League
  'IN': [301], // IPL
  
  // Oceania
  'AU': [20, 302, 103], // A-League, BBL, NBL
};

// Get league priority based on user country
export function getLeaguePriorityForCountry(countryCode: string): number[] {
  // Default priority: European Top 5 + international competitions
  const defaultPriority = [...EUROPEAN_TOP_5_LEAGUES, ...EUROPEAN_COMPETITIONS];
  
  const localLeagues = COUNTRY_LEAGUES[countryCode.toUpperCase()];
  if (localLeagues) {
    // Local leagues first, then default
    return [...new Set([...localLeagues, ...defaultPriority])];
  }
  
  return defaultPriority;
}

// ============================================
// Match Generation with Real Teams
// ============================================

function generateMatchId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function getRandomTeams(leagueId: number, sportId: number): [TeamConfig, TeamConfig] {
  const leagueTeams = TEAMS_DATABASE.filter(t => t.leagueId === leagueId);
  
  if (leagueTeams.length < 2) {
    // Generate placeholder teams for leagues without predefined teams
    const league = ALL_LEAGUES.find(l => l.id === leagueId);
    const sport = ALL_SPORTS.find(s => s.id === sportId);
    
    const teamNames = getGenericTeamNames(sport?.slug || 'football', league?.country || 'World');
    const idx1 = Math.floor(Math.random() * teamNames.length);
    let idx2 = Math.floor(Math.random() * teamNames.length);
    while (idx2 === idx1) idx2 = Math.floor(Math.random() * teamNames.length);
    
    return [
      { id: 9000 + idx1, sportId, leagueId, name: teamNames[idx1], shortName: teamNames[idx1].substring(0, 3).toUpperCase(), country: league?.country || 'World' },
      { id: 9000 + idx2, sportId, leagueId, name: teamNames[idx2], shortName: teamNames[idx2].substring(0, 3).toUpperCase(), country: league?.country || 'World' },
    ];
  }
  
  const shuffled = [...leagueTeams].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

function getGenericTeamNames(sportSlug: string, country: string): string[] {
  const teamPrefixes = ['United', 'City', 'Athletic', 'Royal', 'Sporting', 'Racing', 'Dynamic', 'Olympic', 'Inter', 'FC'];
  const teamSuffixes = ['Warriors', 'Lions', 'Eagles', 'Thunder', 'Storm', 'Heat', 'Kings', 'Stars', 'Titans', 'Phoenix'];
  
  if (sportSlug === 'tennis' || sportSlug === 'golf' || sportSlug === 'boxing' || sportSlug === 'mma') {
    return [
      'C. Alcaraz', 'J. Sinner', 'D. Medvedev', 'A. Zverev', 'S. Tsitsipas', 'H. Rune', 
      'T. Fritz', 'A. Rublev', 'C. Ruud', 'G. Dimitrov', 'N. Djokovic', 'R. Nadal',
      'I. Swiatek', 'A. Sabalenka', 'C. Gauff', 'E. Rybakina', 'J. Pegula', 'O. Jabeur'
    ];
  }
  
  if (sportSlug === 'formula-1') {
    return ['M. Verstappen', 'L. Hamilton', 'C. Leclerc', 'L. Norris', 'C. Sainz', 'O. Piastri', 'G. Russell', 'S. Perez', 'F. Alonso', 'A. Stroll'];
  }
  
  if (sportSlug === 'esports') {
    return ['Team Liquid', 'Cloud9', 'Fnatic', 'G2 Esports', 'T1', 'Gen.G', 'Natus Vincere', 'FaZe Clan', 'Vitality', 'Astralis'];
  }
  
  return teamPrefixes.map((prefix, i) => `${prefix} ${teamSuffixes[i]}`);
}

function generateOdds(): { home: number; draw: number; away: number } {
  const homeBase = 1.5 + Math.random() * 2.5;
  const awayBase = 1.5 + Math.random() * 3;
  const draw = 2.8 + Math.random() * 1.5;
  
  return {
    home: Math.round(homeBase * 100) / 100,
    draw: Math.round(draw * 100) / 100,
    away: Math.round(awayBase * 100) / 100,
  };
}

function generateScore(status: string, sportSlug: string): { home: number | null; away: number | null } {
  if (status === 'scheduled' || status === 'postponed') {
    return { home: null, away: null };
  }
  
  const scoreRanges: Record<string, [number, number]> = {
    'football': [0, 5],
    'basketball': [80, 130],
    'american-football': [0, 42],
    'baseball': [0, 12],
    'ice-hockey': [0, 7],
    'rugby': [0, 45],
    'tennis': [0, 3],
    'volleyball': [0, 3],
    'handball': [20, 35],
    'cricket': [100, 350],
  };
  
  const range = scoreRanges[sportSlug] || [0, 5];
  
  return {
    home: Math.floor(Math.random() * (range[1] - range[0])) + range[0],
    away: Math.floor(Math.random() * (range[1] - range[0])) + range[0],
  };
}

// Generate matches for a specific sport
export function generateMatchesForSport(sportId: number, count: number = 10): Match[] {
  const sport = ALL_SPORTS.find(s => s.id === sportId);
  if (!sport) return [];
  
  const sportLeagues = ALL_LEAGUES.filter(l => l.sportId === sportId);
  if (sportLeagues.length === 0) return [];
  
  const matches: Match[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const league = sportLeagues[Math.floor(Math.random() * sportLeagues.length)];
    const [homeTeam, awayTeam] = getRandomTeams(league.id, sportId);
    
    // Generate times: some live (past hour), some upcoming (next 48 hours)
    let kickoffTime: Date;
    let status: Match['status'];
    
    const rand = Math.random();
    if (rand < 0.15) {
      // Live matches (15%)
      const minutesAgo = Math.floor(Math.random() * 90);
      kickoffTime = new Date(now.getTime() - minutesAgo * 60 * 1000);
      status = minutesAgo > 45 && minutesAgo < 60 ? 'halftime' : 'live';
    } else if (rand < 0.25) {
      // Finished matches (10%)
      kickoffTime = new Date(now.getTime() - (Math.floor(Math.random() * 24) + 2) * 60 * 60 * 1000);
      status = 'finished';
    } else {
      // Upcoming matches (75%) - sorted from soonest to latest
      const hoursFromNow = Math.floor(i / 2) + (Math.random() * 2); // Spread out over time
      kickoffTime = new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000);
      status = 'scheduled';
    }
    
    const scores = generateScore(status, sport.slug);
    const minute = status === 'live' 
      ? Math.floor((now.getTime() - kickoffTime.getTime()) / 60000)
      : status === 'halftime' ? 45 : undefined;
    
    matches.push({
      id: generateMatchId(),
      sportId,
      leagueId: league.id,
      homeTeam: {
        id: homeTeam.id,
        name: homeTeam.name,
        shortName: homeTeam.shortName,
      },
      awayTeam: {
        id: awayTeam.id,
        name: awayTeam.name,
        shortName: awayTeam.shortName,
      },
      kickoffTime,
      status,
      homeScore: scores.home,
      awayScore: scores.away,
      minute,
      league: {
        id: league.id,
        name: league.name,
        country: league.country,
        countryCode: league.countryCode,
        tier: league.tier,
      },
      sport: {
        id: sport.id,
        name: sport.name,
        slug: sport.slug,
        icon: getSportIcon(sport.slug),
      },
      odds: generateOdds(),
      tipsCount: Math.floor(Math.random() * 50),
    });
  }
  
  return matches;
}

// Generate matches for all sports with priority ordering
export function generateAllMatches(userCountryCode?: string): Match[] {
  const allMatches: Match[] = [];
  
  // More matches for popular sports
  const matchCounts: Record<number, number> = {
    1: 50,  // Football - most matches
    2: 20,  // Basketball
    3: 15,  // Tennis
    4: 12,  // Cricket
    5: 15,  // American Football
    6: 12,  // Baseball
    7: 12,  // Ice Hockey
    8: 8,   // Rugby
    27: 6,  // MMA
    26: 4,  // Boxing
    29: 3,  // Formula 1
    33: 10, // Esports
  };
  
  ALL_SPORTS.forEach(sport => {
    const count = matchCounts[sport.id] || 5;
    allMatches.push(...generateMatchesForSport(sport.id, count));
  });
  
  // Sort matches with priority
  return sortMatchesWithPriority(allMatches, userCountryCode);
}

// Sort matches by: Sport priority > League priority > Time
export function sortMatchesWithPriority(matches: Match[], userCountryCode?: string): Match[] {
  const leaguePriority = userCountryCode 
    ? getLeaguePriorityForCountry(userCountryCode) 
    : EUROPEAN_TOP_5_LEAGUES;
  
  return matches.sort((a, b) => {
    // 1. Sport priority (Football first)
    const sportPriorityA = SPORT_PRIORITY[a.sportId] ?? 99;
    const sportPriorityB = SPORT_PRIORITY[b.sportId] ?? 99;
    if (sportPriorityA !== sportPriorityB) return sportPriorityA - sportPriorityB;
    
    // 2. League priority (local leagues first)
    const leaguePriorityA = leaguePriority.indexOf(a.leagueId);
    const leaguePriorityB = leaguePriority.indexOf(b.leagueId);
    const leagueOrderA = leaguePriorityA === -1 ? 999 : leaguePriorityA;
    const leagueOrderB = leaguePriorityB === -1 ? 999 : leaguePriorityB;
    if (leagueOrderA !== leagueOrderB) return leagueOrderA - leagueOrderB;
    
    // 3. Live matches first
    const statusOrder = { live: 0, halftime: 1, scheduled: 2, finished: 3, postponed: 4 };
    const statusOrderA = statusOrder[a.status] ?? 5;
    const statusOrderB = statusOrder[b.status] ?? 5;
    if (statusOrderA !== statusOrderB) return statusOrderA - statusOrderB;
    
    // 4. Sort by kickoff time (soonest first for upcoming)
    return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
  });
}

// Filter matches
export interface MatchFilters {
  sportId?: number;
  leagueId?: number;
  status?: string | string[];
  date?: Date;
  search?: string;
  userCountryCode?: string;
}

export function filterMatches(matches: Match[], filters: MatchFilters): Match[] {
  let filtered = matches.filter(match => {
    if (filters.sportId && match.sportId !== filters.sportId) return false;
    if (filters.leagueId && match.leagueId !== filters.leagueId) return false;
    
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      if (!statuses.includes(match.status)) {
        if (statuses.includes('live') && match.status === 'halftime') {
          // Include halftime in live filter
        } else {
          return false;
        }
      }
    }
    
    if (filters.date) {
      const matchDate = new Date(match.kickoffTime).toDateString();
      const filterDate = filters.date.toDateString();
      if (matchDate !== filterDate) return false;
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = 
        match.homeTeam.name.toLowerCase().includes(searchLower) ||
        match.awayTeam.name.toLowerCase().includes(searchLower) ||
        match.league.name.toLowerCase().includes(searchLower) ||
        match.sport.name.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    
    return true;
  });
  
  // Re-sort with user country priority if provided
  if (filters.userCountryCode) {
    filtered = sortMatchesWithPriority(filtered, filters.userCountryCode);
  }
  
  return filtered;
}

// Get live matches
export function getLiveMatches(matches: Match[]): Match[] {
  return matches
    .filter(m => m.status === 'live' || m.status === 'halftime')
    .sort((a, b) => {
      // Sort by sport priority, then minute (higher minute first)
      const sportPriorityA = SPORT_PRIORITY[a.sportId] ?? 99;
      const sportPriorityB = SPORT_PRIORITY[b.sportId] ?? 99;
      if (sportPriorityA !== sportPriorityB) return sportPriorityA - sportPriorityB;
      return (b.minute || 0) - (a.minute || 0);
    });
}

// Get today's matches
export function getTodayMatches(matches: Match[]): Match[] {
  const today = new Date().toDateString();
  return matches
    .filter(m => new Date(m.kickoffTime).toDateString() === today)
    .sort((a, b) => {
      // Live first, then by kickoff time
      const statusOrder = { live: 0, halftime: 1, scheduled: 2, finished: 3, postponed: 4 };
      const statusOrderA = statusOrder[a.status] ?? 5;
      const statusOrderB = statusOrder[b.status] ?? 5;
      if (statusOrderA !== statusOrderB) return statusOrderA - statusOrderB;
      return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
    });
}

// Get upcoming matches (sorted by kickoff time - soonest first)
export function getUpcomingMatches(matches: Match[]): Match[] {
  const now = new Date();
  return matches
    .filter(m => m.status === 'scheduled' && new Date(m.kickoffTime) > now)
    .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());
}

// Get finished matches
export function getFinishedMatches(matches: Match[]): Match[] {
  return matches
    .filter(m => m.status === 'finished')
    .sort((a, b) => new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime());
}

// Group matches by league (with sport priority)
export function groupMatchesByLeague(matches: Match[]): Record<string, Match[]> {
  const groups: Record<string, Match[]> = {};
  
  // Sort matches first by sport priority
  const sortedMatches = [...matches].sort((a, b) => {
    const sportPriorityA = SPORT_PRIORITY[a.sportId] ?? 99;
    const sportPriorityB = SPORT_PRIORITY[b.sportId] ?? 99;
    return sportPriorityA - sportPriorityB;
  });
  
  sortedMatches.forEach(match => {
    const key = `${match.sport.name} - ${match.league.name}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(match);
  });
  
  return groups;
}

// Group matches by sport (football first)
export function groupMatchesBySport(matches: Match[]): Record<string, Match[]> {
  const groups: Record<string, Match[]> = {};
  
  // Sort sports by priority
  const sortedSports = ALL_SPORTS.sort((a, b) => {
    const priorityA = SPORT_PRIORITY[a.id] ?? 99;
    const priorityB = SPORT_PRIORITY[b.id] ?? 99;
    return priorityA - priorityB;
  });
  
  sortedSports.forEach(sport => {
    const sportMatches = matches.filter(m => m.sportId === sport.id);
    if (sportMatches.length > 0) {
      groups[sport.name] = sportMatches;
    }
  });
  
  return groups;
}

// Export helper data
export { ALL_SPORTS, ALL_LEAGUES, BOOKMAKERS, SPORT_PRIORITY };
