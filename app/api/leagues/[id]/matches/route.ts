import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalLeagueMatches, ESPN_LEAGUES } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leagueId = parseInt(id);
    const seasonParam = request.nextUrl.searchParams.get('season');
    const seasonYear = seasonParam ? parseInt(seasonParam) : null;

    if (isNaN(leagueId)) {
      return NextResponse.json({ success: false, error: 'Invalid league ID' }, { status: 400 });
    }

    if (!seasonYear || isNaN(seasonYear)) {
      return NextResponse.json({ success: false, error: 'season query param required (e.g. ?season=2024)' }, { status: 400 });
    }

    const cfg = ESPN_LEAGUES.find(l => l.leagueId === leagueId);
    if (!cfg) {
      return NextResponse.json({ success: false, error: 'League not found' }, { status: 404 });
    }

    const matches = await getHistoricalLeagueMatches(leagueId, seasonYear);

    return NextResponse.json({
      success: true,
      season: seasonYear,
      leagueId,
      total: matches.length,
      matches,
    });
  } catch (error) {
    console.error('[API] Error fetching historical league matches:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch matches' }, { status: 500 });
  }
}
