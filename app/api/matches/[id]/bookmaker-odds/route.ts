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

    // Primary: SGO per-bookmaker lines (uses bulk cache first, then live lookup)
    let lines = await getSgoBookmakerLines(
      match.homeTeam.name,
      match.awayTeam.name,
      isoKickoff,
      hasDraw,
    );

    // Secondary: ESPN-sourced bookmaker odds already embedded in the match.
    // ESPN's scoreboard attributes odds to a real bookmaker (DraftKings,
    // FanDuel, etc.) — use it as a single guaranteed line when SGO is empty.
    if (lines.length === 0 && match.odds && match.odds.bookmaker &&
        typeof match.odds.home === 'number' && typeof match.odds.away === 'number') {
      lines = [{
        bookmaker: match.odds.bookmaker.toLowerCase().replace(/\s+/g, ''),
        display: match.odds.bookmaker,
        home: match.odds.home,
        draw: hasDraw && typeof match.odds.draw === 'number' ? match.odds.draw : undefined,
        away: match.odds.away,
      }];
    }

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
