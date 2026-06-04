// Search real upcoming/live matches for challenge creation.
// Only returns matches with REAL odds (home > 1 AND away > 1).
// For football we generate deterministic fallback odds when API odds are absent,
// since the user wants all football matches available. Non-football with no API
// odds are excluded.
import { NextRequest, NextResponse } from 'next/server';
import { getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

// Deterministic fallback odds for football — consistent per match
function fallbackOdds(matchId: string): { home: number; draw: number; away: number } {
  let h = 0;
  for (let i = 0; i < matchId.length; i++) h = ((h << 5) - h + matchId.charCodeAt(i)) | 0;
  const seed = Math.abs(h) / 0x7fffffff;
  const homeAdv = seed < 0.45 ? 0.15 : seed < 0.75 ? 0 : -0.15;
  const home = parseFloat((1.70 + seed * 0.60 + homeAdv).toFixed(2));
  const away = parseFloat((1.70 + (1 - seed) * 0.60 - homeAdv).toFixed(2));
  const draw = parseFloat((2.90 + (seed - 0.5) * 0.50).toFixed(2));
  return { home, draw, away };
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').toLowerCase().trim();
  const sport = req.nextUrl.searchParams.get('sport') || '';
  const limit = Math.min(20, parseInt(req.nextUrl.searchParams.get('limit') || '14', 10));

  try {
    const all = await getAllMatches();

    // Only upcoming/live — not finished
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

    const results = matches
      .map(m => {
        const leagueName = typeof m.league === 'string' ? m.league : (m.league as { name?: string })?.name || 'Unknown League';
        const sportObj = typeof m.sport === 'object' ? m.sport as { name?: string; slug?: string } : null;
        const sportSlug = sportObj?.slug || String(m.sport || 'football').toLowerCase();
        const sportName = sportObj?.name || 'Football';

        // Real odds from API
        const rawOdds = (m as Record<string, unknown>).odds as Record<string, unknown> | undefined;
        const rawHome = rawOdds?.home ?? rawOdds?.['1'] ?? rawOdds?.homeWin;
        const rawDraw = rawOdds?.draw ?? rawOdds?.['X'] ?? rawOdds?.drawOdds;
        const rawAway = rawOdds?.away ?? rawOdds?.['2'] ?? rawOdds?.awayWin;

        let odds: { home: number; draw: number; away: number };
        const hasRealOdds = !!(rawHome && rawAway && Number(rawHome) > 1 && Number(rawAway) > 1);

        if (hasRealOdds) {
          odds = {
            home: parseFloat(String(rawHome)),
            draw: rawDraw ? parseFloat(String(rawDraw)) : 0,
            away: parseFloat(String(rawAway)),
          };
        } else if (sportSlug.includes('football') || sportSlug.includes('soccer')) {
          // Use deterministic fallback for football so these matches are always available
          odds = fallbackOdds(m.id);
        } else {
          // Non-football with no real odds → exclude
          return null;
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
      })
      .filter(Boolean)
      .slice(0, limit);

    return NextResponse.json({ matches: results });
  } catch (e) {
    console.error('[match-search]', e);
    return NextResponse.json({ matches: [] });
  }
}
