import { NextRequest, NextResponse } from 'next/server';
import { getLeagueStandings, ESPN_LEAGUES } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';
export const revalidate = 900; // Revalidate every 15 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leagueId = parseInt(id);
    const seasonParam = request.nextUrl.searchParams.get('season');
    const seasonYear = seasonParam ? parseInt(seasonParam) : undefined;

    if (isNaN(leagueId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid league ID' },
        { status: 400 }
      );
    }

    const standings = await getLeagueStandings(leagueId, seasonYear);

    // Resolve the ESPN league key (e.g. "eng.1" → "eng1") so each row can
    // expose a fully-qualified team page URL the client can link to.
    const cfg = ESPN_LEAGUES.find(l => l.leagueId === leagueId);
    const leagueSlug = cfg?.league.replace(/[^a-z0-9]/gi, '') ?? '';

    const data = standings.map(s => ({
      ...s,
      team: {
        ...s.team,
        href: leagueSlug && s.team.id ? `/teams/espn_${leagueSlug}_${s.team.id}` : null,
      },
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[API] Error fetching standings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch standings' },
      { status: 500 }
    );
  }
}
