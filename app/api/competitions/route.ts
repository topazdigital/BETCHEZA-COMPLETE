import { NextResponse } from 'next/server';
import { getCompetitions, publicCompetitionSummary } from '@/lib/competitions-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const all = getCompetitions().map(publicCompetitionSummary);
  return NextResponse.json({
    success: true,
    competitions: all,
    stats: {
      active: all.filter(c => c.status === 'active').length,
      upcoming: all.filter(c => c.status === 'upcoming').length,
      totalParticipants: all.reduce((s, c) => s + c.currentParticipants, 0),
      totalPrizePool: all.reduce((s, c) => s + c.prizePool, 0),
    },
  });
}
