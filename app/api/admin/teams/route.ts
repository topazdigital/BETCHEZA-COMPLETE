import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Get all teams for admin
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const sportId = searchParams.get('sportId');
    const leagueId = searchParams.get('leagueId');
    const search = searchParams.get('search');
    
    const offset = (page - 1) * limit;
    
    const conditions: string[] = ['1=1'];
    const params: (string | number)[] = [];
    
    if (sportId && sportId !== 'all') {
      conditions.push(`t.sport_id = $${params.length + 1}`);
      params.push(parseInt(sportId));
    }
    
    if (leagueId && leagueId !== 'all') {
      conditions.push(`t.league_id = $${params.length + 1}`);
      params.push(parseInt(leagueId));
    }
    
    if (search) {
      conditions.push(`t.name ILIKE $${params.length + 1}`);
      params.push(`%${search}%`);
    }
    
    const whereClause = conditions.join(' AND ');

    const result = await query(`
      SELECT 
        t.id,
        t.name,
        t.slug,
        t.logo_url,
        t.api_id,
        c.name as country_name,
        c.code as country_code,
        s.name as sport_name,
        s.icon as sport_icon
      FROM teams t
      LEFT JOIN countries c ON t.country_id = c.id
      LEFT JOIN sports s ON t.sport_id = s.id
      WHERE ${whereClause}
      ORDER BY t.name
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);
    
    const countResult = await query(`
      SELECT COUNT(*) as total FROM teams t WHERE ${whereClause}
    `, params);
    
    const total = (countResult.rows as Array<{ total: number }>)[0]?.total || 0;
    
    return NextResponse.json({
      teams: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('[Admin API] Failed to get teams:', error);
    return NextResponse.json(
      { error: 'Failed to get teams', teams: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } },
      { status: 500 }
    );
  }
}

// Create a new team
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, sportId, countryId, logoUrl } = body;
    
    if (!name || !sportId || !countryId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, sportId, countryId' },
        { status: 400 }
      );
    }
    
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    const result = await execute(
      `INSERT INTO teams (name, slug, sport_id, country_id, logo_url) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, slug, sportId, countryId, logoUrl || null]
    );
    
    return NextResponse.json({ success: true, teamId: result.insertId, message: 'Team created successfully' });
  } catch (error) {
    console.error('[Admin API] Failed to create team:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}

// Update team
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, logoUrl } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }
    
    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    
    if (name !== undefined) {
      updates.push(`name = $${params.length + 1}`);
      params.push(name);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      updates.push(`slug = $${params.length + 1}`);
      params.push(slug);
    }
    
    if (logoUrl !== undefined) {
      updates.push(`logo_url = $${params.length + 1}`);
      params.push(logoUrl);
    }
    
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }
    
    params.push(id);
    
    await query(`UPDATE teams SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    
    return NextResponse.json({ success: true, message: 'Team updated successfully' });
  } catch (error) {
    console.error('[Admin API] Failed to update team:', error);
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

// Delete team
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }
    
    await query('DELETE FROM teams WHERE id = $1', [id]);
    
    return NextResponse.json({ success: true, message: 'Team deleted successfully' });
  } catch (error) {
    console.error('[Admin API] Failed to delete team:', error);
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}
