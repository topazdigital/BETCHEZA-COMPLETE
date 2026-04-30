import { NextRequest, NextResponse } from 'next/server';
import { getLeagueOutrights } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';
export const revalidate = 1800; // Revalidate every 30 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leagueId = parseInt(id);

    if (isNaN(leagueId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid league ID' },
        { status: 400 }
      );
    }

    const outrights = await getLeagueOutrights(leagueId);

    return NextResponse.json({
      success: true,
      data: outrights,
    });
  } catch (error) {
    console.error('[API] Error fetching outrights:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch outrights' },
      { status: 500 }
    );
  }
}
