import { NextResponse } from 'next/server';
import { getUpcomingMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Returns a slim list of upcoming matches keyed for the predictor's
// team-autocomplete UI. We deliberately strip the heavy fields and
// only ship the four bits the picker needs.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const limit = Math.max(1, Math.min(60, Number(searchParams.get('limit') || 30)));

  let matches: Awaited<ReturnType<typeof getUpcomingMatches>>;
  try {
    matches = await getUpcomingMatches();
  } catch (e) {
    console.warn('[predictor/upcoming] fetch failed', e);
    return NextResponse.json({ matches: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  let filtered = matches;
  if (q) {
    filtered = matches.filter(m =>
      (m.homeTeam?.name || '').toLowerCase().includes(q) ||
      (m.awayTeam?.name || '').toLowerCase().includes(q) ||
      (m.league?.name || '').toLowerCase().includes(q),
    );
  }

  const slim = filtered.slice(0, limit).map(m => ({
    id: String(m.id),
    homeTeam: m.homeTeam?.name || '',
    awayTeam: m.awayTeam?.name || '',
    league: m.league?.name || '',
    kickoffTime: m.kickoffTime,
    sport: m.sport,
  }));

  return NextResponse.json(
    { matches: slim },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
