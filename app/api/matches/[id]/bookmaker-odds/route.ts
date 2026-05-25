import { NextRequest, NextResponse } from 'next/server';
import { getMatchById } from '@/lib/api/unified-sports-api';
import { getSgoBookmakerLines } from '@/lib/api/sportsgameodds';

const NO_DRAW_SPORTS = new Set([
  'basketball', 'baseball', 'tennis', 'mma', 'boxing', 'golf',
  'formula-1', 'racing', 'horse-racing', 'darts', 'snooker',
  'american-football', 'ice-hockey',
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const match = await getMatchById(id);
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const hasDraw = !NO_DRAW_SPORTS.has(match.sport?.slug || '');
    const isoKickoff =
      typeof match.kickoffTime === 'string'
        ? match.kickoffTime
        : match.kickoffTime instanceof Date
        ? match.kickoffTime.toISOString()
        : new Date().toISOString();

    const lines = await getSgoBookmakerLines(
      match.homeTeam.name,
      match.awayTeam.name,
      isoKickoff,
      hasDraw,
    );

    return NextResponse.json(
      { lines, hasDraw },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      },
    );
  } catch (err) {
    console.error('[bookmaker-odds]', err);
    return NextResponse.json({ lines: [], hasDraw: true });
  }
}
