import { NextRequest, NextResponse } from 'next/server';
import { ALL_LEAGUES } from '@/lib/sports-data';
import { getLeagueTopScorers } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';
export const revalidate = 1800;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season') || '2025-26';
  const limit = parseInt(searchParams.get('limit') || '10');

  const leagueId = parseInt(id);
  if (isNaN(leagueId)) {
    return NextResponse.json({ error: 'Invalid league ID' }, { status: 400 });
  }

  try {
    const scorers = await getLeagueTopScorers(leagueId, limit);
    const league = ALL_LEAGUES.find(l => l.id === leagueId);

    return NextResponse.json({
      leagueId,
      leagueName: league?.name || 'Unknown League',
      country: league?.country || 'Unknown',
      season,
      scorers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching scorers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top scorers' },
      { status: 500 }
    );
  }
}
