import { NextRequest, NextResponse } from 'next/server';
import { getFullSeasonFixtures, ESPN_LEAGUES } from '@/lib/api/unified-sports-api';
import type { UnifiedMatch } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

// Leagues fetched for the "all upcoming" view — the most popular ones globally.
// Kept to ≤20 to avoid hammering ESPN with too many parallel fetches.
// Each call is independently cached for 1h so repeat requests are instant.
const UPCOMING_LEAGUE_IDS = [
  // European Top 5
  1, 2, 3, 4, 5,
  // European cups + major 2nd divisions
  9, 10, 26,
  8, 6, 7, 16, 15,
  41, 46, 48, 50, 52,
  // Americas
  11, 12, 13, 27, 25,
];

export async function GET(request: NextRequest) {
  const sportIdParam = request.nextUrl.searchParams.get('sportId');
  const sportId = sportIdParam ? parseInt(sportIdParam) : null;

  const now = new Date();

  try {
    // Determine which league IDs to fetch — optionally filtered by sport
    let leagueIds: number[];
    if (sportId) {
      leagueIds = ESPN_LEAGUES
        .filter(l => l.sportId === sportId)
        .map(l => l.leagueId)
        .slice(0, 30);
    } else {
      leagueIds = UPCOMING_LEAGUE_IDS;
    }

    // Fetch all leagues in parallel; each is individually cached for 1h
    const results = await Promise.allSettled(
      leagueIds.map(id => getFullSeasonFixtures(id))
    );

    const allMatches: UnifiedMatch[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') allMatches.push(...r.value);
    }

    // Keep only future scheduled matches
    const upcoming = allMatches.filter(m => {
      if (m.status !== 'scheduled') return false;
      return new Date(m.kickoffTime) > now;
    });

    // De-duplicate by match ID (same match could appear via multiple paths)
    const seen = new Set<string>();
    const deduped = upcoming.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    // Sort by kickoff time ascending
    deduped.sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());

    // Shape to the same format as /api/matches
    const shaped = deduped.map(m => ({
      id: m.id,
      sportId: m.sport.id,
      leagueId: m.league.id,
      homeTeam: {
        id: m.homeTeam.id,
        name: m.homeTeam.name,
        shortName: m.homeTeam.shortName || m.homeTeam.name,
        logo: m.homeTeam.logo,
      },
      awayTeam: {
        id: m.awayTeam.id,
        name: m.awayTeam.name,
        shortName: m.awayTeam.shortName || m.awayTeam.name,
        logo: m.awayTeam.logo,
      },
      kickoffTime: m.kickoffTime instanceof Date
        ? m.kickoffTime.toISOString()
        : m.kickoffTime,
      status: m.status,
      homeScore: m.homeScore ?? null,
      awayScore: m.awayScore ?? null,
      minute: m.minute,
      period: m.period,
      league: {
        id: m.league.id,
        name: m.league.name,
        slug: m.league.slug,
        country: m.league.country,
        countryCode: m.league.countryCode || '',
        tier: m.league.tier || 1,
        logo: m.league.logo,
      },
      sport: {
        id: m.sport.id,
        name: m.sport.name,
        slug: m.sport.slug,
        icon: m.sport.icon,
      },
      odds: m.odds ? { home: m.odds.home, draw: m.odds.draw, away: m.odds.away } : undefined,
      tipsCount: 0,
      source: m.source,
      venue: m.venue,
      roundName: (m as { roundName?: string | null }).roundName ?? null,
    }));

    return NextResponse.json(shaped, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('[API] /api/matches/upcoming error:', error);
    return NextResponse.json([], { status: 200 });
  }
}
