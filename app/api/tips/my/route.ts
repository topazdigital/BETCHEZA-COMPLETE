import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { matchToSlug, matchIdToSlug } from '@/lib/utils/match-url';
import { query } from '@/lib/db';
import { listTipsForTipster } from '@/lib/auto-tips-store';

export const dynamic = 'force-dynamic';

interface DbMyTip {
  id: number;
  match_id: string;
  selection: string;
  market_id: string | null;
  odds_value: number | null;
  stake: number | null;
  status: string;
  analysis: string | null;
  created_at: Date | string;
  home_team: string | null;
  away_team: string | null;
  league: string | null;
  sport: string | null;
  kickoff_time: Date | string | null;
}

export async function GET(request: NextRequest) {
  void request;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ tips: [], authenticated: false });
  }

  type OutTip = {
    id: string; matchId: string; matchSlug: string; homeTeam: string; awayTeam: string;
    league: string; sport: string; kickoff: string | null; prediction: string;
    market: string; odds: number; stake: number; confidence: number;
    status: string; analysis: string; isPremium: boolean; createdAt: string;
  };
  const tips: OutTip[] = [];

  // Real DB tips
  try {
    const result = await query<DbMyTip>(
      `SELECT t.id, t.match_id, t.selection, t.market_id, t.odds_value, t.stake,
              t.status, t.analysis, t.created_at,
              m.home_team, m.away_team, m.league, m.sport, m.kickoff_time
         FROM tips t
         LEFT JOIN matches m ON m.external_id = t.match_id
        WHERE t.user_id = ?
        ORDER BY t.created_at DESC
        LIMIT 50`,
      [user.userId],
    );
    const rows = (result as unknown as { rows?: DbMyTip[] }).rows ?? (result as unknown as DbMyTip[]);
    for (const row of (rows || [])) {
      const home = row.home_team || '';
      const away = row.away_team || '';
      const slug = home && away ? matchToSlug(row.match_id, home, away) : matchIdToSlug(row.match_id);
      tips.push({
        id: `db-${row.id}`,
        matchId: row.match_id,
        matchSlug: slug,
        homeTeam: home,
        awayTeam: away,
        league: row.league || '',
        sport: row.sport || 'Football',
        kickoff: row.kickoff_time ? new Date(row.kickoff_time as string).toISOString() : null,
        prediction: row.selection,
        market: row.market_id || 'h2h',
        odds: Number(row.odds_value ?? 1.5),
        stake: Number(row.stake ?? 1),
        confidence: 70,
        status: row.status,
        analysis: row.analysis || '',
        isPremium: false,
        createdAt: new Date(row.created_at as string).toISOString(),
      });
    }
  } catch { /* DB unavailable */ }

  // In-memory auto-tips fallback
  if (tips.length === 0) {
    const autoTips = listTipsForTipster(user.userId, 50);
    for (const t of autoTips) {
      const slug = matchToSlug(t.matchId, t.homeTeam, t.awayTeam);
      tips.push({
        id: t.id,
        matchId: t.matchId,
        matchSlug: slug,
        homeTeam: t.homeTeam,
        awayTeam: t.awayTeam,
        league: t.league || '',
        sport: t.sport || 'Football',
        kickoff: t.kickoff || null,
        prediction: t.prediction,
        market: t.market,
        odds: t.odds,
        stake: t.stake,
        confidence: t.confidence,
        status: t.status,
        analysis: t.analysis,
        isPremium: t.isPremium,
        createdAt: t.createdAt,
      });
    }
  }

  tips.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json({ tips: tips.slice(0, 50), authenticated: true });
}
