import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

interface AdminMatchRow {
  id: number | string;
  home_team_name: string;
  home_team_logo?: string | null;
  away_team_name: string;
  away_team_logo?: string | null;
  league_name: string;
  sport_name: string;
  sport_icon: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_time: string;
}

const hasDb = () => !!process.env.DATABASE_URL;

// Get all matches for admin
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');
  const status = searchParams.get('status');
  const sportId = searchParams.get('sportId');
  const search = searchParams.get('search');

  // Try DB first when configured.
  if (hasDb()) {
    try {
      const offset = (page - 1) * limit;
      const conditions: string[] = ['1=1'];
      const params: (string | number)[] = [];
      if (status && status !== 'all') { conditions.push('m.status = ?'); params.push(status); }
      if (sportId && sportId !== 'all') { conditions.push('l.sport_id = ?'); params.push(parseInt(sportId)); }
      if (search) {
        conditions.push('(ht.name LIKE ? OR at.name LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }
      const whereClause = conditions.join(' AND ');
      const result = await query(`
        SELECT m.id, m.kickoff_time, m.status, m.home_score, m.away_score, m.minute,
               ht.name as home_team_name, ht.logo_url as home_team_logo,
               at.name as away_team_name, at.logo_url as away_team_logo,
               l.name as league_name, l.country_id,
               s.name as sport_name, s.icon as sport_icon
          FROM matches m
          JOIN teams ht ON m.home_team_id = ht.id
          JOIN teams at ON m.away_team_id = at.id
          JOIN leagues l ON m.league_id = l.id
          JOIN sports s ON l.sport_id = s.id
         WHERE ${whereClause}
         ORDER BY m.kickoff_time DESC
         LIMIT ? OFFSET ?
      `, [...params, limit, offset]);
      const countResult = await query(
        `SELECT COUNT(*) as total FROM matches m JOIN leagues l ON m.league_id = l.id JOIN teams ht ON m.home_team_id = ht.id JOIN teams at ON m.away_team_id = at.id WHERE ${whereClause}`,
        params,
      );
      const total = (countResult.rows as Array<{ total: number }>)[0]?.total || 0;
      if (result.rows && (result.rows as unknown[]).length > 0) {
        return NextResponse.json({
          source: 'db',
          matches: result.rows,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
      }
    } catch (e) {
      console.warn('[Admin API] DB matches query failed, falling back to live feed', e);
    }
  }

  // Fallback to live unified ESPN feed so admin always sees real matches.
  try {
    const all = await getAllMatches();
    const lc = (s?: string) => (s || '').toLowerCase();
    const filtered = all.filter(m => {
      if (status && status !== 'all' && m.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!lc(m.homeTeam.name).includes(q) && !lc(m.awayTeam.name).includes(q)) return false;
      }
      return true;
    });
    filtered.sort((a, b) => new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime());
    const total = filtered.length;
    const offset = (page - 1) * limit;
    const slice = filtered.slice(offset, offset + limit);
    const matches: AdminMatchRow[] = slice.map(m => ({
      id: m.id,
      home_team_name: m.homeTeam.name,
      home_team_logo: m.homeTeam.logo || null,
      away_team_name: m.awayTeam.name,
      away_team_logo: m.awayTeam.logo || null,
      league_name: m.league?.name || '',
      sport_name: m.sport?.name || '',
      sport_icon: m.sport?.icon || '⚽',
      status: m.status,
      home_score: m.homeScore ?? null,
      away_score: m.awayScore ?? null,
      kickoff_time: m.kickoffTime instanceof Date ? m.kickoffTime.toISOString() : String(m.kickoffTime),
    }));
    return NextResponse.json({
      source: 'live',
      matches,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error('[Admin API] live matches feed failed', e);
    return NextResponse.json({
      source: 'error',
      matches: [],
      pagination: { page: 1, limit, total: 0, totalPages: 0 },
      error: 'Failed to fetch matches',
    }, { status: 200 });
  }
}

// Create a new match
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leagueId, homeTeamId, awayTeamId, kickoffTime, homeOdds, drawOdds, awayOdds } = body;
    
    if (!leagueId || !homeTeamId || !awayTeamId || !kickoffTime) {
      return NextResponse.json(
        { error: 'Missing required fields: leagueId, homeTeamId, awayTeamId, kickoffTime' },
        { status: 400 }
      );
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
          VALUES 
            (?, ?, ?, 'home', ?),
            (?, ?, ?, 'draw', ?),
            (?, ?, ?, 'away', ?)
        `, [
          matchId, bookmakerId, marketId, homeOdds,
          matchId, bookmakerId, marketId, drawOdds || 3.0,
          matchId, bookmakerId, marketId, awayOdds
        ]);
      }
    }
    
    return NextResponse.json({ success: true, matchId, message: 'Match created successfully' });
  } catch (error) {
    console.error('[Admin API] Failed to create match:', error);
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
  }
}

// Update match
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, homeScore, awayScore, minute } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Match ID is required' }, { status: 400 });
    }
    
    const updates: string[] = [];
    const params: (string | number)[] = [];
    
    if (status !== undefined) { updates.push(`status = $${params.length + 1}`); params.push(status); }
    if (homeScore !== undefined) { updates.push(`home_score = $${params.length + 1}`); params.push(homeScore); }
    if (awayScore !== undefined) { updates.push(`away_score = $${params.length + 1}`); params.push(awayScore); }
    if (minute !== undefined) { updates.push(`minute = $${params.length + 1}`); params.push(minute); }
    
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }
    
    params.push(id);
    
    await query(`UPDATE matches SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    
    return NextResponse.json({ success: true, message: 'Match updated successfully' });
  } catch (error) {
    console.error('[Admin API] Failed to update match:', error);
    return NextResponse.json({ error: 'Failed to update match' }, { status: 500 });
  }
}

// Delete match
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Match ID is required' }, { status: 400 });
    }
    
    await query('DELETE FROM matches WHERE id = ?', [id]);
    
    return NextResponse.json({ success: true, message: 'Match deleted successfully' });
  } catch (error) {
    console.error('[Admin API] Failed to delete match:', error);
    return NextResponse.json({ error: 'Failed to delete match' }, { status: 500 });
  }
}
