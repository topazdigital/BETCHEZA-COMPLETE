import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await query<{
      id: number; league_id: string; home_team_id: string; away_team_id: string;
      kickoff_time: string; status: string; home_score: number | null; away_score: number | null; minute: number | null;
    }>('SELECT * FROM matches ORDER BY kickoff_time DESC LIMIT 100');
    return NextResponse.json({ matches: result.rows });
  } catch (error) {
    console.error('[Admin API] Failed to get matches:', error);
    return NextResponse.json({ error: 'Failed to get matches' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { leagueId, homeTeamId, awayTeamId, kickoffTime, homeOdds, drawOdds, awayOdds } = body;

    if (!leagueId || !homeTeamId || !awayTeamId || !kickoffTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await execute(
      `INSERT INTO matches (league_id, home_team_id, away_team_id, kickoff_time, status)
       VALUES (?, ?, ?, ?, 'scheduled')`,
      [leagueId, homeTeamId, awayTeamId, kickoffTime]
    );

    const matchId = result.insertId;

    if (homeOdds && awayOdds) {
      const bookmakerResult = await query(`SELECT id FROM bookmakers LIMIT 1`);
      const bookmakerId = (bookmakerResult.rows as Array<{ id: number }>)[0]?.id;
      if (bookmakerId) {
        const marketResult = await query(`SELECT id FROM markets WHERE slug = 'h2h' LIMIT 1`);
        const marketId = (marketResult.rows as Array<{ id: number }>)[0]?.id || 1;
        await query(`
          INSERT INTO odds (match_id, bookmaker_id, market_id, selection, value)
          VALUES (?, ?, ?, 'home', ?), (?, ?, ?, 'draw', ?), (?, ?, ?, 'away', ?)
        `, [matchId, bookmakerId, marketId, homeOdds, matchId, bookmakerId, marketId, drawOdds || 3.0, matchId, bookmakerId, marketId, awayOdds]);
      }
    }

    return NextResponse.json({ success: true, matchId, message: 'Match created successfully' });
  } catch (error) {
    console.error('[Admin API] Failed to create match:', error);
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { id, status, homeScore, awayScore, minute } = body;

    if (!id) return NextResponse.json({ error: 'Match ID is required' }, { status: 400 });

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (status !== undefined) { updates.push(`status = ?`); params.push(status); }
    if (homeScore !== undefined) { updates.push(`home_score = ?`); params.push(homeScore); }
    if (awayScore !== undefined) { updates.push(`away_score = ?`); params.push(awayScore); }
    if (minute !== undefined) { updates.push(`minute = ?`); params.push(minute); }

    if (updates.length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 });

    params.push(id);
    await query(`UPDATE matches SET ${updates.join(', ')} WHERE id = ?`, params);

    return NextResponse.json({ success: true, message: 'Match updated successfully' });
  } catch (error) {
    console.error('[Admin API] Failed to update match:', error);
    return NextResponse.json({ error: 'Failed to update match' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Match ID is required' }, { status: 400 });
    await query('DELETE FROM matches WHERE id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Match deleted successfully' });
  } catch (error) {
    console.error('[Admin API] Failed to delete match:', error);
    return NextResponse.json({ error: 'Failed to delete match' }, { status: 500 });
  }
}
