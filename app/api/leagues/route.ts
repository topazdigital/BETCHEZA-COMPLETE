import { NextRequest, NextResponse } from 'next/server';
import { ALL_LEAGUES } from '@/lib/sports-data';

export const dynamic = 'force-static';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sportId = searchParams.get('sportId');

    let leagues = ALL_LEAGUES;

    // Filter by sport if provided
    if (sportId) {
      leagues = leagues.filter(l => l.sportId === parseInt(sportId));
    }

    // Sort by tier
    leagues = [...leagues].sort((a, b) => a.tier - b.tier);

    return NextResponse.json({
      success: true,
      data: leagues,
    });
  } catch (error) {
    console.error('[API] Error fetching leagues:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leagues' },
      { status: 500 }
    );
  }
}
