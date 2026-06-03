// Search real upcoming/live matches for challenge creation modal.
import { NextRequest, NextResponse } from 'next/server';
import { getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').toLowerCase().trim();
  const sport = req.nextUrl.searchParams.get('sport') || '';
  const limit = Math.min(20, parseInt(req.nextUrl.searchParams.get('limit') || '12', 10));

  try {
    const all = await getAllMatches();

    // Only show upcoming or live — not finished
    let matches = all.filter(m => {
      const s = (m.status || '').toLowerCase();
      return s === 'scheduled' || s === 'upcoming' || s === 'live' || s === 'halftime' || s === 'extra_time' || s === '';
    });

    if (sport) {
      const sl = sport.toLowerCase();
      matches = matches.filter(m => {
        const mSport = typeof m.sport === 'object'
          ? ((m.sport as { slug?: string })?.slug || (m.sport as { name?: string })?.name || '').toLowerCase()
          : String(m.sport || '').toLowerCase();
        return mSport.includes(sl) || sl.includes(mSport.replace(/\/.*/, ''));
      });
    }

    if (q) {
      matches = matches.filter(m => {
        const home = (m.homeTeam?.name || '').toLowerCase();
        const away = (m.awayTeam?.name || '').toLowerCase();
        const league = (typeof m.league === 'string' ? m.league : (m.league as { name?: string })?.name || '').toLowerCase();
        return home.includes(q) || away.includes(q) || league.includes(q);
      });
    }

    const results = matches.slice(0, limit).map(m => {
      const leagueName = typeof m.league === 'string' ? m.league : (m.league as { name?: string })?.name || 'Unknown League';
      const sportObj = typeof m.sport === 'object' ? m.sport as { name?: string; slug?: string } : null;
      const sportSlug = sportObj?.slug || String(m.sport || 'football').toLowerCase();
      const sportName = sportObj?.name || 'Football';

      return {
        id: m.id,
        homeTeam: m.homeTeam?.name || 'Home',
        awayTeam: m.awayTeam?.name || 'Away',
        homeLogo: m.homeTeam?.logo || null,
        awayLogo: m.awayTeam?.logo || null,
        league: leagueName,
        sport: sportSlug,
        sportName,
        kickoff: m.kickoffTime || m.date || null,
        status: m.status || 'scheduled',
        homeScore: m.homeScore ?? null,
        awayScore: m.awayScore ?? null,
      };
    });

    return NextResponse.json({ matches: results });
  } catch (e) {
    console.error('[match-search]', e);
    return NextResponse.json({ matches: [] });
  }
}
