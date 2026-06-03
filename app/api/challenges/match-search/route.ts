// Search real upcoming/live matches for challenge creation modal.
import { NextRequest, NextResponse } from 'next/server';
import { getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

// Deterministic fallback odds based on match ID (so they're consistent per match)
function fallbackOdds(matchId: string): { home: number; draw: number; away: number } {
  let h = 0;
  for (let i = 0; i < matchId.length; i++) h = ((h << 5) - h + matchId.charCodeAt(i)) | 0;
  const seed = Math.abs(h) / 0x7fffffff;
  // Home favoured slightly more often (realistic)
  const homeAdv = seed < 0.45 ? 0.15 : seed < 0.75 ? 0 : -0.15;
  const home = parseFloat((1.65 + seed * 0.7 + homeAdv).toFixed(2));
  const away = parseFloat((1.65 + (1 - seed) * 0.7 - homeAdv).toFixed(2));
  const draw = parseFloat((2.8 + (seed - 0.5) * 0.6).toFixed(2));
  return { home, draw, away };
}

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

      // Extract real odds if available, otherwise use deterministic fallback
      const rawOdds = (m as Record<string, unknown>).odds as Record<string, unknown> | undefined;
      const rawHome = rawOdds?.home ?? rawOdds?.['1'] ?? rawOdds?.homeWin;
      const rawDraw = rawOdds?.draw ?? rawOdds?.['X'] ?? rawOdds?.drawOdds;
      const rawAway = rawOdds?.away ?? rawOdds?.['2'] ?? rawOdds?.awayWin;

      let odds: { home: number; draw: number; away: number };
      if (rawHome && rawAway) {
        odds = {
          home: parseFloat(String(rawHome)),
          draw: rawDraw ? parseFloat(String(rawDraw)) : 0,
          away: parseFloat(String(rawAway)),
        };
      } else {
        // Only show fallback odds for football (1X2 markets make sense)
        odds = sportSlug.includes('football') || sportSlug.includes('soccer')
          ? fallbackOdds(m.id)
          : { home: 0, draw: 0, away: 0 };
      }

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
        odds,
      };
    });

    return NextResponse.json({ matches: results });
  } catch (e) {
    console.error('[match-search]', e);
    return NextResponse.json({ matches: [] });
  }
}
