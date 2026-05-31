import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await query<{
      id: number; league_id: string; home_team_id: string; away_team_id: string;
      home_team_name?: string; away_team_name?: string;
      league_name?: string; sport_name?: string; sport_icon?: string;
      kickoff_time: string; status: string; home_score: number | null; away_score: number | null; minute: number | null;
    }>('SELECT * FROM matches ORDER BY kickoff_time DESC LIMIT 200');

    if (result.rows.length > 0) {
      return NextResponse.json({ matches: result.rows, source: 'db' });
    }
  } catch {
    // DB unavailable — fall through to live feed
  }

  // Fall back to the in-memory ESPN cache so the admin can always see matches
  try {
    const liveMatches = await getAllMatches();
    const mapped = liveMatches.slice(0, 300).map(m => ({
      id: m.id,
      home_team_name: m.homeTeam.name,
      away_team_name: m.awayTeam.name,
      home_team_logo: m.homeTeam.logo ?? null,
      away_team_logo: m.awayTeam.logo ?? null,
      league_name: m.league.name,
      sport_name: m.sport.name,
      sport_icon: m.sport.icon,
      status: m.status === 'halftime' ? 'live' : m.status,
      home_score: m.homeScore,
      away_score: m.awayScore,
      kickoff_time: m.kickoffTime instanceof Date
        ? m.kickoffTime.toISOString()
        : String(m.kickoffTime),
      minute: m.minute ?? null,
    }));
    return NextResponse.json({ matches: mapped, source: 'live' });
  } catch (error) {
    console.error('[Admin API] Failed to get matches from live feed:', error);
    return NextResponse.json({ matches: [], source: 'unavailable' });
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
