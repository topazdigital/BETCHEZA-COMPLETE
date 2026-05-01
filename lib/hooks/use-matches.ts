'use client';

import useSWR from 'swr';
import { useState, useEffect } from 'react';

// Match type from our API
export interface Match {
  id: string;
  sportId: number;
  leagueId: number;
  homeTeam: {
    id: number | string;
    name: string;
    shortName: string;
    logo?: string;
    form?: string;
    record?: string;
  };
  awayTeam: {
    id: number | string;
    name: string;
    shortName: string;
    logo?: string;
    form?: string;
    record?: string;
  };
  kickoffTime: string | Date;
  status: 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed' | 'cancelled' | 'extra_time' | 'penalties' | string;
  homeScore: number | null;
  awayScore: number | null;
  minute?: number;
  league: {
    id: number;
    name: string;
    slug?: string;
    country: string;
    countryCode: string;
    tier: number;
    logo?: string;
  };
  sport: {
    id: number;
    name: string;
    slug: string;
    icon: string;
  };
  odds?: {
    home: number;
    draw?: number;
    away: number;
  };
  tipsCount: number;
  source?: string;
  venue?: string;
}

// User's detected country code
let detectedCountryCode: string | null = null;

// Detect user's country from browser
async function detectUserCountry(): Promise<string> {
  if (detectedCountryCode) return detectedCountryCode;
  
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const timezoneCountryMap: Record<string, string> = {
      'Africa/Nairobi': 'KE',
      'Africa/Lagos': 'NG',
      'Africa/Accra': 'GH',
      'Africa/Cairo': 'EG',
      'Africa/Johannesburg': 'ZA',
      'Europe/London': 'GB',
      'Europe/Madrid': 'ES',
      'Europe/Berlin': 'DE',
      'Europe/Rome': 'IT',
      'Europe/Paris': 'FR',
      'Europe/Amsterdam': 'NL',
      'Europe/Lisbon': 'PT',
      'Europe/Istanbul': 'TR',
      'Europe/Brussels': 'BE',
      'Europe/Moscow': 'RU',
      'America/New_York': 'US',
      'America/Los_Angeles': 'US',
      'America/Chicago': 'US',
      'America/Sao_Paulo': 'BR',
      'America/Argentina/Buenos_Aires': 'AR',
      'America/Mexico_City': 'MX',
      'Asia/Tokyo': 'JP',
      'Asia/Seoul': 'KR',
      'Asia/Shanghai': 'CN',
      'Asia/Riyadh': 'SA',
      'Asia/Kolkata': 'IN',
      'Australia/Sydney': 'AU',
      'Australia/Melbourne': 'AU',
    };
    
    detectedCountryCode = timezoneCountryMap[timezone] || 'GB';
    return detectedCountryCode;
  } catch {
    detectedCountryCode = 'GB';
    return 'GB';
  }
}

// Hook to get user's country code
export function useUserCountry() {
  const [countryCode, setCountryCode] = useState<string>('GB');
  
  useEffect(() => {
    detectUserCountry().then(setCountryCode);
  }, []);
  
  return countryCode;
}

// Sport priority constants
const SPORT_PRIORITY: Record<number, number> = {
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

// API response type
interface MatchesAPIResponse {
  matches: Match[];
  stats: {
    total: number;
    live: number;
    today: number;
    upcoming: number;
  };
  timestamp: string;
}

// Fetcher for API calls
const matchesFetcher = async (url: string): Promise<Match[]> => {
  const res = await fetch(url);
  if (!res.ok) {
    console.error('[v0] Failed to fetch matches:', res.status);
    throw new Error('Failed to fetch matches');
  }
  const data: MatchesAPIResponse = await res.json();
  // API returns { matches, stats }, we extract just matches
  return data.matches || [];
};

// Sort matches: Sport priority > League > Live status > Time
function sortMatchesWithPriority(matches: Match[], countryCode?: string): Match[] {
  return [...matches].sort((a, b) => {
    // 1. Sport priority (Football first)
    const sportPriorityA = SPORT_PRIORITY[a.sportId] ?? 99;
    const sportPriorityB = SPORT_PRIORITY[b.sportId] ?? 99;
    if (sportPriorityA !== sportPriorityB) return sportPriorityA - sportPriorityB;
    
    // 2. League tier (lower tier = higher priority)
    const leagueTierA = a.league?.tier ?? 99;
    const leagueTierB = b.league?.tier ?? 99;
    if (leagueTierA !== leagueTierB) return leagueTierA - leagueTierB;
    
    // 3. Live matches first
    const statusOrder: Record<string, number> = { 
      live: 0, 
      halftime: 1, 
      extra_time: 1.5, 
      penalties: 1.6, 
      scheduled: 2, 
      finished: 3, 
      postponed: 4,
      cancelled: 5 
    };
    const statusOrderA = statusOrder[a.status] ?? 5;
    const statusOrderB = statusOrder[b.status] ?? 5;
    if (statusOrderA !== statusOrderB) return statusOrderA - statusOrderB;
    
    // 4. Sort by kickoff time
    return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
  });
}

// Filter helper functions
function getLiveMatches(matches: Match[]): Match[] {
  return matches
    .filter(m => m.status === 'live' || m.status === 'halftime' || m.status === 'extra_time' || m.status === 'penalties')
    .sort((a, b) => {
      const sportPriorityA = SPORT_PRIORITY[a.sportId] ?? 99;
      const sportPriorityB = SPORT_PRIORITY[b.sportId] ?? 99;
      if (sportPriorityA !== sportPriorityB) return sportPriorityA - sportPriorityB;
      return (b.minute || 0) - (a.minute || 0);
    });
}

// Local-tz YYYY-MM-DD helper — must match the matches page's `toLocalISODate`
// so the sidebar/header badge counts agree with the on-page list.
function toLocalISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getTodayMatches(matches: Match[]): Match[] {
  // Use local-ISO date so the count exactly matches the matches page's
  // "Today" filter, AND exclude finished matches (those live on the
  // Results page) so the badge doesn't double-count yesterday's finals
  // that the feed still tags as "today" in UTC.
  const todayKey = toLocalISODate(new Date());
  return matches
    .filter(m => m.status !== 'finished' && m.status !== 'cancelled' && m.status !== 'postponed')
    .filter(m => toLocalISODate(new Date(m.kickoffTime)) === todayKey)
    .sort((a, b) => {
      const statusOrder: Record<string, number> = { live: 0, halftime: 1, scheduled: 2, finished: 3, postponed: 4 };
      const statusOrderA = statusOrder[a.status] ?? 5;
      const statusOrderB = statusOrder[b.status] ?? 5;
      if (statusOrderA !== statusOrderB) return statusOrderA - statusOrderB;
      return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
    });
}

function getUpcomingMatches(matches: Match[]): Match[] {
  const now = new Date();
  return matches
    .filter(m => m.status === 'scheduled' && new Date(m.kickoffTime) > now)
    .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());
}

function getFinishedMatches(matches: Match[]): Match[] {
  const now = Date.now();
  return matches
    .filter(m => m.status === 'finished')
    // Drop matches that the upstream feed marked finished but never sent a
    // final score for — they would otherwise render as a misleading 0-0.
    // We require BOTH scores to be present (0 is a valid score, null is not).
    .filter(m => m.homeScore !== null && m.homeScore !== undefined
                 && m.awayScore !== null && m.awayScore !== undefined)
    // Belt-and-braces: never show a "finished" match whose kickoff is still
    // in the future — that's always a stale/erroneous status from the feed
    // and would otherwise pollute the Results page with tomorrow's fixtures.
    .filter(m => new Date(m.kickoffTime).getTime() <= now)
    .sort((a, b) => new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime());
}

export interface MatchFilters {
  sportId?: number;
  leagueId?: number;
  status?: string;
}

// Browser timezone offset in minutes (e.g. UTC+3 -> +180)
function getTzOffsetMin(): number {
  // Date.getTimezoneOffset returns minutes WEST of UTC (positive for negative TZ)
  // Invert sign so e.g. EAT (UTC+3) returns +180.
  return -new Date().getTimezoneOffset();
}

// Main hook for all matches - FETCHES FROM REAL API
export function useMatches(filters?: MatchFilters) {
  const countryCode = useUserCountry();
  
  // Build query params (pass countryCode so server can prioritize local leagues)
  const params = new URLSearchParams();
  if (filters?.sportId) params.set('sportId', filters.sportId.toString());
  if (filters?.leagueId) params.set('leagueId', filters.leagueId.toString());
  if (filters?.status) params.set('status', filters.status);
  if (countryCode) params.set('countryCode', countryCode);
  if (typeof window !== 'undefined') params.set('tzOffsetMin', String(getTzOffsetMin()));
  
  const queryString = params.toString();
  const url = `/api/matches${queryString ? `?${queryString}` : ''}`;
  
  const { data, error, isLoading, mutate } = useSWR<Match[]>(
    url,
    matchesFetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      // Keep showing the previous matches list while a background refresh
      // is in flight so the UI doesn't flash empty states between polls.
      keepPreviousData: true,
    }
  );

  // Server already sorts by sport priority -> league priority -> status -> time
  // (we trust the server-side sort which is country-aware)
  const matches = data || [];

  return {
    matches,
    allMatches: matches,
    userCountryCode: countryCode,
    isLoading,
    error,
    mutate,
  };
}

// Hook for live matches only.
// IMPORTANT: We pass `keepPreviousData: true` so the live row never flickers
// to the "no live games right now" empty state during a background refresh.
// Without this, every 10-second SWR poll briefly returned `undefined` while
// the request was in-flight, which caused the home page to oscillate between
// the live marquee and the upcoming-games fallback.
export function useLiveMatches() {
  const { data, error, isLoading, isValidating } = useSWR<Match[]>(
    '/api/matches?status=live',
    matchesFetcher,
    {
      refreshInterval: 10000, // Refresh every 10 seconds for live
      revalidateOnFocus: true,
      keepPreviousData: true,
      dedupingInterval: 5000,
    }
  );

  // Ensure data is an array before filtering
  const matches = Array.isArray(data) ? data : [];

  return {
    matches: getLiveMatches(matches),
    // Show as loading if SWR hasn't resolved yet OR is revalidating with zero results
    // (prevents "Nothing live" flash when data is en-route)
    isLoading: isLoading || (isValidating && matches.length === 0),
    error,
  };
}

// Hook for today's matches
export function useTodayMatches() {
  const { data, error, isLoading } = useSWR<Match[]>(
    '/api/matches',
    matchesFetcher,
    {
      refreshInterval: 30000,
    }
  );

  // Ensure data is an array before filtering
  const matches = Array.isArray(data) ? data : [];

  return {
    matches: getTodayMatches(matches),
    isLoading,
    error,
  };
}

// Hook for upcoming matches
export function useUpcomingMatches(limit?: number) {
  const { data, error, isLoading } = useSWR<Match[]>(
    '/api/matches?status=scheduled',
    matchesFetcher,
    {
      refreshInterval: 60000,
    }
  );

  const upcoming = data ? getUpcomingMatches(data) : [];
  const limited = limit ? upcoming.slice(0, limit) : upcoming;

  return {
    matches: limited,
    total: upcoming.length,
    isLoading,
    error,
  };
}

// Hook for finished matches
export function useFinishedMatches(date?: Date) {
  const { data, error, isLoading } = useSWR<Match[]>(
    '/api/matches?status=finished',
    matchesFetcher,
    {
      refreshInterval: 60000,
    }
  );

  let finished = data ? getFinishedMatches(data) : [];
  
  if (date) {
    const dateStr = date.toDateString();
    finished = finished.filter(m => new Date(m.kickoffTime).toDateString() === dateStr);
  }

  return {
    matches: finished,
    isLoading,
    error,
  };
}

// Hook for a single match
export function useMatch(matchId: string) {
  const { data, error, isLoading } = useSWR<Match[]>(
    '/api/matches',
    matchesFetcher,
    {
      refreshInterval: 10000,
    }
  );

  const match = data?.find(m => m.id === matchId);

  return {
    match,
    isLoading,
    error,
  };
}

// Group matches by league
export function groupMatchesByLeague(matches: Match[]): Record<string, Match[]> {
  const groups: Record<string, Match[]> = {};
  
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

// Group matches by sport
export function groupMatchesBySport(matches: Match[]): Record<string, Match[]> {
  const groups: Record<string, Match[]> = {};
  
  matches.forEach(match => {
    const sportName = match.sport.name;
    if (!groups[sportName]) groups[sportName] = [];
    groups[sportName].push(match);
  });
  
  // Sort by sport priority
  const sortedGroups: Record<string, Match[]> = {};
  Object.entries(groups)
    .sort(([, matchesA], [, matchesB]) => {
      const priorityA = SPORT_PRIORITY[matchesA[0]?.sportId] ?? 99;
      const priorityB = SPORT_PRIORITY[matchesB[0]?.sportId] ?? 99;
      return priorityA - priorityB;
    })
    .forEach(([key, value]) => {
      sortedGroups[key] = value;
    });
  
  return sortedGroups;
}

// Hook for matches grouped by league
export function useMatchesByLeague(sportId?: number) {
  const params = sportId ? `?sportId=${sportId}` : '';
  
  const { data, error, isLoading } = useSWR<Match[]>(
    `/api/matches${params}`,
    matchesFetcher,
    {
      refreshInterval: 30000,
    }
  );

  return {
    groups: groupMatchesByLeague(data || []),
    isLoading,
    error,
  };
}

// Hook for matches grouped by sport
export function useMatchesBySport() {
  const { data, error, isLoading } = useSWR<Match[]>(
    '/api/matches',
    matchesFetcher,
    {
      refreshInterval: 30000,
    }
  );

  return {
    groups: groupMatchesBySport(data || []),
    isLoading,
    error,
  };
}

// Stats hook
export function useMatchStats() {
  const { data, isLoading } = useSWR<Match[]>(
    '/api/matches',
    matchesFetcher,
    {
      refreshInterval: 30000,
    }
  );

  const matches = data || [];

  return {
    total: matches.length,
    live: getLiveMatches(matches).length,
    today: getTodayMatches(matches).length,
    upcoming: getUpcomingMatches(matches).length,
    finished: getFinishedMatches(matches).length,
    isLoading,
  };
}
