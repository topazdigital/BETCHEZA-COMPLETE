import { NextRequest, NextResponse } from 'next/server';
import { getTransferOddsForLeague } from '@/lib/api/static-transfers';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const leagueId = parseInt(id);

  if (isNaN(leagueId)) {
    return NextResponse.json({ error: 'Invalid league ID' }, { status: 400 });
  }

  const transfers = getTransferOddsForLeague(leagueId);

  const res = NextResponse.json({
    success: true,
    leagueId,
    transfers,
  });
  res.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
  return res;
}
