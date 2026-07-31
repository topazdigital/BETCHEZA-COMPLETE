import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  validateCompetitionLeague,
  detectSportFocusFromName,
  KNOWN_LEAGUES,
} from '@/lib/competition-league-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { name?: string } = {};
  try { body = await req.json(); } catch {}

  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const result = validateCompetitionLeague(name);
  const sportFocus = detectSportFocusFromName(name);

  return NextResponse.json({
    valid: result.valid,
    warning: result.warning,
    detected: result.detected ? {
      leagueId: result.detected.leagueId,
      leagueName: result.detected.leagueName,
      sportFocus: result.detected.sportFocus,
      espnKey: result.detected.espnKey,
    } : null,
    sportFocus,
    isGeneral: !result.detected,
    suggestedNames: result.detected ? [] : [
      `Weekly Tipster Challenge`,
      `Daily Football Showdown`,
      `Premier League Weekly`,
      `La Liga Weekly`,
      `NBA Daily`,
      `Multi-Sport Monthly`,
    ],
    availableLeagues: KNOWN_LEAGUES.map(l => ({
      leagueId: l.leagueId,
      leagueName: l.leagueName,
      sportFocus: l.sportFocus,
    })),
  });
}
