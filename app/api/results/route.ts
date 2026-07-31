import { NextRequest, NextResponse } from 'next/server';
import { getAllMatches, type UnifiedMatch } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

interface ResultsCache {
  data: ResultMatch[];
  ts: number;
}

const g = globalThis as { __resultsCache?: ResultsCache };
const RESULTS_CACHE_TTL = 5 * 60_000;

export interface ResultMatch {
  id: string;
  sportId: number;
  leagueId: number;
  homeTeam: { id: string | number; name: string; shortName: string; logo?: string };
  awayTeam: { id: string | number; name: string; shortName: string; logo?: string };
  kickoffTime: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  period?: string;
  league: {
    id: number;
    name: string;
    slug: string;
    country: string;
    countryCode: string;
    tier: number;
    logo?: string;
  };
  sport: { id: number; name: string; slug: string; icon: string };
  source?: string;
  venue?: string;
  tipsCount: number;
}

function toResultMatch(m: UnifiedMatch): ResultMatch {
  return {
    id: m.id,
    sportId: m.sportId,
    leagueId: m.leagueId,
    homeTeam: { id: m.homeTeam.id, name: m.homeTeam.name, shortName: m.homeTeam.shortName, logo: m.homeTeam.logo },
    awayTeam: { id: m.awayTeam.id, name: m.awayTeam.name, shortName: m.awayTeam.shortName, logo: m.awayTeam.logo },
    kickoffTime: new Date(m.kickoffTime).toISOString(),
    status: m.status,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    period: m.period,
    league: m.league,
    sport: m.sport,
    source: m.source,
    venue: m.venue,
    tipsCount: m.tipsCount,
  };
}

async function getFinishedMatchesCache(): Promise<ResultMatch[]> {
  const now = Date.now();
  if (g.__resultsCache && now - g.__resultsCache.ts < RESULTS_CACHE_TTL) {
    return g.__resultsCache.data;
  }

  const timeoutMs = 25_000;
  const timeoutPromise = new Promise<UnifiedMatch[]>((_, reject) =>
    setTimeout(() => reject(new Error('getAllMatches timed out after 25s')), timeoutMs)
  );

  const allMatches = await Promise.race([getAllMatches(), timeoutPromise]);

  const finished = allMatches
    .filter(m => m.status === 'finished')
    .filter(m => {
      if (m.homeScore === null || m.awayScore === null) return false;
      const kickoff = new Date(m.kickoffTime).getTime();
      return !isNaN(kickoff) && kickoff <= now;
    })
    .map(m => {
      try { return toResultMatch(m); } catch { return null; }
    })
    .filter((m): m is ResultMatch => m !== null);

  g.__resultsCache = { data: finished, ts: now };
  return finished;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const daysParam = parseInt(searchParams.get('days') || '30', 10);
  const dateParam = searchParams.get('date');

  try {
    const finished = await getFinishedMatchesCache();
    const now = Date.now();
    let filtered: ResultMatch[];

    if (dateParam) {
      const targetStr = new Date(dateParam + 'T00:00:00').toDateString();
      filtered = finished.filter(m => new Date(m.kickoffTime).toDateString() === targetStr);
    } else {
      const cutoff = now - daysParam * 24 * 60 * 60 * 1000;
      filtered = finished.filter(m => new Date(m.kickoffTime).getTime() >= cutoff);
    }

    filtered.sort((a, b) => new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime());

    const res = NextResponse.json({
      matches: filtered,
      total: filtered.length,
      timestamp: new Date().toISOString(),
    });
    res.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    return res;
  } catch (error) {
    console.error('[Results API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch results', matches: [] }, { status: 500 });
  }
}
