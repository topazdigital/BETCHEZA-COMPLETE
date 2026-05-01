// Mock data for development/preview mode when no database is connected
import type {
  User,
  TipsterProfile,
  Sport,
  Country,
  League,
  Team,
  Match,
  MatchWithDetails,
  Bookmaker,
  Market,
  Odds,
  Tip,
  TipWithDetails,
  AIPrediction,
  Competition,
  LeaderboardEntry,
} from './types';

// Sports
export const mockSports: Sport[] = [
  { id: 1, name: 'Football', slug: 'football', icon: '⚽' },
  { id: 2, name: 'Basketball', slug: 'basketball', icon: '🏀' },
  { id: 3, name: 'Tennis', slug: 'tennis', icon: '🎾' },
];

// Countries
export const mockCountries: Country[] = [
  { id: 1, name: 'England', code: 'GB-ENG', flag_url: null },
  { id: 2, name: 'Spain', code: 'ES', flag_url: null },
  { id: 3, name: 'Germany', code: 'DE', flag_url: null },
  { id: 4, name: 'Italy', code: 'IT', flag_url: null },
  { id: 5, name: 'France', code: 'FR', flag_url: null },
  { id: 6, name: 'Kenya', code: 'KE', flag_url: null },
];

// Leagues
export const mockLeagues: League[] = [
  { id: 1, sport_id: 1, country_id: 1, name: 'Premier League', slug: 'premier-league', logo_url: null, priority: 1 },
  { id: 2, sport_id: 1, country_id: 2, name: 'La Liga', slug: 'la-liga', logo_url: null, priority: 2 },
  { id: 3, sport_id: 1, country_id: 3, name: 'Bundesliga', slug: 'bundesliga', logo_url: null, priority: 3 },
  { id: 4, sport_id: 1, country_id: 4, name: 'Serie A', slug: 'serie-a', logo_url: null, priority: 4 },
  { id: 5, sport_id: 1, country_id: 5, name: 'Ligue 1', slug: 'ligue-1', logo_url: null, priority: 5 },
  { id: 6, sport_id: 1, country_id: 6, name: 'KPL', slug: 'kpl', logo_url: null, priority: 6 },
];

// Teams
export const mockTeams: Team[] = [
  // Premier League
  { id: 1, sport_id: 1, country_id: 1, name: 'Arsenal', slug: 'arsenal', logo_url: null },
  { id: 2, sport_id: 1, country_id: 1, name: 'Chelsea', slug: 'chelsea', logo_url: null },
  { id: 3, sport_id: 1, country_id: 1, name: 'Liverpool', slug: 'liverpool', logo_url: null },
  { id: 4, sport_id: 1, country_id: 1, name: 'Manchester City', slug: 'manchester-city', logo_url: null },
  { id: 5, sport_id: 1, country_id: 1, name: 'Manchester United', slug: 'manchester-united', logo_url: null },
  { id: 6, sport_id: 1, country_id: 1, name: 'Tottenham', slug: 'tottenham', logo_url: null },
  // La Liga
  { id: 7, sport_id: 1, country_id: 2, name: 'Real Madrid', slug: 'real-madrid', logo_url: null },
  { id: 8, sport_id: 1, country_id: 2, name: 'Barcelona', slug: 'barcelona', logo_url: null },
  { id: 9, sport_id: 1, country_id: 2, name: 'Atletico Madrid', slug: 'atletico-madrid', logo_url: null },
  // Bundesliga
  { id: 10, sport_id: 1, country_id: 3, name: 'Bayern Munich', slug: 'bayern-munich', logo_url: null },
  { id: 11, sport_id: 1, country_id: 3, name: 'Borussia Dortmund', slug: 'borussia-dortmund', logo_url: null },
  // Serie A
  { id: 12, sport_id: 1, country_id: 4, name: 'Juventus', slug: 'juventus', logo_url: null },
  { id: 13, sport_id: 1, country_id: 4, name: 'AC Milan', slug: 'ac-milan', logo_url: null },
  { id: 14, sport_id: 1, country_id: 4, name: 'Inter Milan', slug: 'inter-milan', logo_url: null },
  // Ligue 1
  { id: 15, sport_id: 1, country_id: 5, name: 'PSG', slug: 'psg', logo_url: null },
  { id: 16, sport_id: 1, country_id: 5, name: 'Marseille', slug: 'marseille', logo_url: null },
  // KPL
  { id: 17, sport_id: 1, country_id: 6, name: 'Gor Mahia', slug: 'gor-mahia', logo_url: null },
  { id: 18, sport_id: 1, country_id: 6, name: 'AFC Leopards', slug: 'afc-leopards', logo_url: null },
];

// Bookmakers
export const mockBookmakers: Bookmaker[] = [
  { id: 1, name: 'Bet365', slug: 'bet365', logo_url: null, affiliate_url: 'https://bet365.com', country_codes: 'GB,KE' },
  { id: 2, name: 'Betway', slug: 'betway', logo_url: null, affiliate_url: 'https://betway.com', country_codes: 'GB,KE,NG' },
  { id: 3, name: '1xBet', slug: '1xbet', logo_url: null, affiliate_url: 'https://1xbet.com', country_codes: 'KE,NG,GH' },
  { id: 4, name: 'Sportybet', slug: 'sportybet', logo_url: null, affiliate_url: 'https://sportybet.com', country_codes: 'KE,NG,GH' },
  { id: 5, name: 'Betika', slug: 'betika', logo_url: null, affiliate_url: 'https://betika.com', country_codes: 'KE' },
];

// Markets
export const mockMarkets: Market[] = [
  { id: 1, name: '1X2', slug: '1x2', description: 'Match winner (Home/Draw/Away)' },
  { id: 2, name: 'Over/Under 2.5', slug: 'over-under-2.5', description: 'Total goals over or under 2.5' },
  { id: 3, name: 'BTTS', slug: 'btts', description: 'Both teams to score' },
  { id: 4, name: 'Double Chance', slug: 'double-chance', description: 'Two outcomes combined' },
  { id: 5, name: 'Asian Handicap', slug: 'asian-handicap', description: 'Handicap betting' },
  { id: 6, name: 'Correct Score', slug: 'correct-score', description: 'Exact final score' },
];

// Generate upcoming matches
function generateMatches(): MatchWithDetails[] {
  const now = new Date();
  const matches: MatchWithDetails[] = [];
  
  // Live match
  matches.push({
    id: 1,
    league_id: 1,
    home_team_id: 1,
    away_team_id: 2,
    kickoff_time: new Date(now.getTime() - 45 * 60000), // Started 45 mins ago
    status: 'live',
    home_score: 1,
    away_score: 0,
    ht_score: '1-0',
    api_id: null,
    scraped_at: now,
    league: mockLeagues[0],
    home_team: mockTeams[0],
    away_team: mockTeams[1],
    country: mockCountries[0],
    tips_count: 24,
  });
  
  // Halftime match
  matches.push({
    id: 2,
    league_id: 2,
    home_team_id: 7,
    away_team_id: 8,
    kickoff_time: new Date(now.getTime() - 50 * 60000),
    status: 'halftime',
    home_score: 2,
    away_score: 1,
    ht_score: '2-1',
    api_id: null,
    scraped_at: now,
    league: mockLeagues[1],
    home_team: mockTeams[6],
    away_team: mockTeams[7],
    country: mockCountries[1],
    tips_count: 45,
  });
  
  // Today's upcoming matches - using safe indexes within mockTeams bounds (0-16)
  const todayMatches = [
    { home: 2, away: 3, league: 0, hours: 2 },  // Liverpool vs Man City
    { home: 4, away: 5, league: 0, hours: 4 },  // Man Utd vs Tottenham
    { home: 6, away: 7, league: 1, hours: 3 },  // Real Madrid vs Barcelona
    { home: 9, away: 10, league: 2, hours: 5 },  // Bayern vs Dortmund
    { home: 11, away: 12, league: 3, hours: 6 },  // Juventus vs AC Milan
    { home: 14, away: 15, league: 4, hours: 1 },  // PSG vs Marseille
  ];
  
  todayMatches.forEach((m, idx) => {
    matches.push({
      id: 10 + idx,
      league_id: mockLeagues[m.league].id,
      home_team_id: mockTeams[m.home].id,
      away_team_id: mockTeams[m.away].id,
      kickoff_time: new Date(now.getTime() + m.hours * 3600000),
      status: 'scheduled',
      home_score: null,
      away_score: null,
      ht_score: null,
      api_id: null,
      scraped_at: now,
      league: mockLeagues[m.league],
      home_team: mockTeams[m.home],
      away_team: mockTeams[m.away],
      country: mockCountries[m.league],
      tips_count: Math.floor(Math.random() * 30) + 5,
    });
  });
  
  // Finished matches (for results)
  const finishedMatches = [
    { home: 0, away: 3, league: 0, hoursAgo: 3, score: [2, 2] },
    { home: 1, away: 5, league: 0, hoursAgo: 5, score: [1, 0] },
    { home: 6, away: 8, league: 1, hoursAgo: 4, score: [3, 1] },
  ];
  
  finishedMatches.forEach((m, idx) => {
    matches.push({
      id: 100 + idx,
      league_id: mockLeagues[m.league].id,
      home_team_id: mockTeams[m.home].id,
      away_team_id: mockTeams[m.away].id,
      kickoff_time: new Date(now.getTime() - m.hoursAgo * 3600000),
      status: 'finished',
      home_score: m.score[0],
      away_score: m.score[1],
      ht_score: '1-1',
      api_id: null,
      scraped_at: now,
      league: mockLeagues[m.league],
      home_team: mockTeams[m.home],
      away_team: mockTeams[m.away],
      country: mockCountries[m.league],
      tips_count: Math.floor(Math.random() * 50) + 10,
    });
  });
  
  return matches;
}

export const mockMatches = generateMatches();

// Mock users
export const mockUsers: (User & { tipster_profile?: TipsterProfile })[] = [
  {
    id: 1,
    email: 'admin@betcheza.co.ke',
    phone: '+254700000000',
    country_code: 'KE',
    password_hash: '$2b$12$fn8QymGU0VzVj.ASGNTz6uylDzCA8Eu3DV/tMgksL3jGQebfdZHJW',
    google_id: null,
    username: 'admin',
    display_name: 'Admin',
    avatar_url: null,
    bio: 'Platform administrator',
    role: 'admin',
    balance: 0,
    timezone: 'Africa/Nairobi',
    odds_format: 'decimal',
    is_verified: true,
    created_at: new Date('2024-01-01'),
  },
  {
    id: 2,
    email: 'king@betcheza.co.ke',
    phone: '+254711111111',
    country_code: 'KE',
    password_hash: '$2a$12$dummy',
    google_id: null,
    username: 'KingOfTips',
    display_name: 'King of Tips',
    avatar_url: null,
    bio: 'Professional tipster with 5+ years experience. Specializing in Premier League and La Liga.',
    role: 'tipster',
    balance: 15000,
    timezone: 'Africa/Nairobi',
    odds_format: 'decimal',
    is_verified: true,
    created_at: new Date('2024-01-15'),
    tipster_profile: {
      user_id: 2,
      win_rate: 68.5,
      total_tips: 342,
      won_tips: 234,
      lost_tips: 98,
      pending_tips: 10,
      avg_odds: 1.85,
      roi: 12.4,
      streak: 5,
      rank: 1,
      followers_count: 1523,
      is_pro: true,
      subscription_price: 500,
    },
  },
  {
    id: 3,
    email: 'ace@betcheza.co.ke',
    phone: '+254722222222',
    country_code: 'KE',
    password_hash: '$2a$12$dummy',
    google_id: null,
    username: 'AcePredicts',
    display_name: 'Ace Predicts',
    avatar_url: null,
    bio: 'Data-driven predictions. Over 2.5 goals specialist.',
    role: 'tipster',
    balance: 8500,
    timezone: 'Africa/Nairobi',
    odds_format: 'decimal',
    is_verified: true,
    created_at: new Date('2024-02-01'),
    tipster_profile: {
      user_id: 3,
      win_rate: 72.1,
      total_tips: 215,
      won_tips: 155,
      lost_tips: 52,
      pending_tips: 8,
      avg_odds: 1.72,
      roi: 15.8,
      streak: 8,
      rank: 2,
      followers_count: 982,
      is_pro: true,
      subscription_price: 400,
    },
  },
  {
    id: 4,
    email: 'lucky@betcheza.co.ke',
    phone: '+254733333333',
    country_code: 'KE',
    password_hash: '$2a$12$dummy',
    google_id: null,
    username: 'LuckyStriker',
    display_name: 'Lucky Striker',
    avatar_url: null,
    bio: 'African football expert. KPL and CAF specialist.',
    role: 'tipster',
    balance: 5200,
    timezone: 'Africa/Nairobi',
    odds_format: 'decimal',
    is_verified: true,
    created_at: new Date('2024-02-15'),
    tipster_profile: {
      user_id: 4,
      win_rate: 65.3,
      total_tips: 178,
      won_tips: 116,
      lost_tips: 55,
      pending_tips: 7,
      avg_odds: 1.95,
      roi: 9.2,
      streak: 3,
      rank: 3,
      followers_count: 654,
      is_pro: false,
      subscription_price: null,
    },
  },
  {
    id: 5,
    email: 'euro@betcheza.co.ke',
    phone: '+254744444444',
    country_code: 'KE',
    password_hash: '$2a$12$dummy',
    google_id: null,
    username: 'EuroExpert',
    display_name: 'Euro Expert',
    avatar_url: null,
    bio: 'European leagues analyst. Bundesliga and Serie A focus.',
    role: 'tipster',
    balance: 3800,
    timezone: 'Europe/London',
    odds_format: 'decimal',
    is_verified: true,
    created_at: new Date('2024-03-01'),
    tipster_profile: {
      user_id: 5,
      win_rate: 61.8,
      total_tips: 156,
      won_tips: 96,
      lost_tips: 54,
      pending_tips: 6,
      avg_odds: 2.05,
      roi: 7.5,
      streak: -2,
      rank: 4,
      followers_count: 421,
      is_pro: false,
      subscription_price: null,
    },
  },
];

// Generate odds for matches
export function generateOddsForMatch(matchId: number): Odds[] {
  const odds: Odds[] = [];
  let oddsId = matchId * 100;
  
  mockBookmakers.forEach((bookmaker) => {
    // 1X2 odds
    const homeOdds = 1.5 + Math.random() * 2;
    const drawOdds = 2.5 + Math.random() * 1.5;
    const awayOdds = 2 + Math.random() * 3;
    
    odds.push(
      { id: oddsId++, match_id: matchId, bookmaker_id: bookmaker.id, market_id: 1, selection: '1', value: parseFloat(homeOdds.toFixed(2)), is_best: false },
      { id: oddsId++, match_id: matchId, bookmaker_id: bookmaker.id, market_id: 1, selection: 'X', value: parseFloat(drawOdds.toFixed(2)), is_best: false },
      { id: oddsId++, match_id: matchId, bookmaker_id: bookmaker.id, market_id: 1, selection: '2', value: parseFloat(awayOdds.toFixed(2)), is_best: false },
    );
    
    // Over/Under 2.5
    const overOdds = 1.6 + Math.random() * 0.8;
    const underOdds = 1.8 + Math.random() * 0.6;
    
    odds.push(
      { id: oddsId++, match_id: matchId, bookmaker_id: bookmaker.id, market_id: 2, selection: 'Over', value: parseFloat(overOdds.toFixed(2)), is_best: false },
      { id: oddsId++, match_id: matchId, bookmaker_id: bookmaker.id, market_id: 2, selection: 'Under', value: parseFloat(underOdds.toFixed(2)), is_best: false },
    );
    
    // BTTS
    const bttsYes = 1.7 + Math.random() * 0.4;
    const bttsNo = 1.9 + Math.random() * 0.4;
    
    odds.push(
      { id: oddsId++, match_id: matchId, bookmaker_id: bookmaker.id, market_id: 3, selection: 'Yes', value: parseFloat(bttsYes.toFixed(2)), is_best: false },
      { id: oddsId++, match_id: matchId, bookmaker_id: bookmaker.id, market_id: 3, selection: 'No', value: parseFloat(bttsNo.toFixed(2)), is_best: false },
    );
  });
  
  // Mark best odds for each selection
  const selectionGroups: Record<string, Odds[]> = {};
  odds.forEach(o => {
    const key = `${o.market_id}-${o.selection}`;
    if (!selectionGroups[key]) selectionGroups[key] = [];
    selectionGroups[key].push(o);
  });
  
  Object.values(selectionGroups).forEach(group => {
    const best = group.reduce((a, b) => a.value > b.value ? a : b);
    best.is_best = true;
  });
  
  return odds;
}

// Mock tips
export const mockTips: TipWithDetails[] = [
  {
    id: 1,
    user_id: 2,
    match_id: 10,
    market_id: 1,
    selection: '1',
    odds_value: 1.75,
    stake: 3,
    analysis: 'Liverpool has been in great form, winning their last 4 home games. City coming off a midweek Champions League fixture, expect tired legs.',
    ai_analysis: null,
    status: 'pending',
    result: null,
    created_at: new Date(),
    user: { id: 2, username: 'KingOfTips', display_name: 'King of Tips', avatar_url: null },
    match: mockMatches.find(m => m.id === 10)!,
    market: mockMarkets[0],
    tipster_profile: mockUsers[1].tipster_profile,
  },
  {
    id: 2,
    user_id: 3,
    match_id: 10,
    market_id: 2,
    selection: 'Over',
    odds_value: 1.85,
    stake: 2,
    analysis: 'Both teams have been involved in high-scoring games recently. Expect goals!',
    ai_analysis: null,
    status: 'pending',
    result: null,
    created_at: new Date(Date.now() - 3600000),
    user: { id: 3, username: 'AcePredicts', display_name: 'Ace Predicts', avatar_url: null },
    match: mockMatches.find(m => m.id === 10)!,
    market: mockMarkets[1],
    tipster_profile: mockUsers[2].tipster_profile,
  },
];

// Mock AI predictions
export const mockAIPredictions: Record<number, AIPrediction> = {
  1: {
    id: 1,
    match_id: 1,
    prediction: 'Arsenal to win',
    confidence: 72,
    reasoning: 'Arsenal has won 8 of their last 10 home games against Chelsea. Current form strongly favors the home side with key Chelsea players injured.',
    result: null,
    created_at: new Date(),
  },
  10: {
    id: 10,
    match_id: 10,
    prediction: 'Liverpool to win & Over 2.5 goals',
    confidence: 68,
    reasoning: 'Liverpool\'s attacking prowess at home combined with Man City\'s high defensive line creates opportunities for goals. Historical H2H shows average of 3.2 goals per game.',
    result: null,
    created_at: new Date(),
  },
};

// Mock competitions
export const mockCompetitions: Competition[] = [
  {
    id: 1,
    name: 'Weekly Tipster Challenge',
    description: 'Compete with other tipsters for the highest win rate this week!',
    start_date: new Date(),
    end_date: new Date(Date.now() + 7 * 24 * 3600000),
    prize_pool: 50000,
    entry_fee: 100,
    max_participants: 500,
    status: 'active',
  },
  {
    id: 2,
    name: 'Monthly Masters',
    description: 'The ultimate monthly competition for pro tipsters',
    start_date: new Date(),
    end_date: new Date(Date.now() + 30 * 24 * 3600000),
    prize_pool: 200000,
    entry_fee: 500,
    max_participants: 200,
    status: 'active',
  },
];

// Generate leaderboard
export function generateLeaderboard(period: string): LeaderboardEntry[] {
  return mockUsers
    .filter(u => u.role === 'tipster' && u.tipster_profile)
    .map((user, idx) => ({
      rank: idx + 1,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      },
      tipster_profile: {
        win_rate: user.tipster_profile!.win_rate,
        roi: user.tipster_profile!.roi,
        total_tips: user.tipster_profile!.total_tips,
        won_tips: user.tipster_profile!.won_tips,
        streak: user.tipster_profile!.streak,
      },
      score: user.tipster_profile!.win_rate * 10 + user.tipster_profile!.roi * 5,
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}
