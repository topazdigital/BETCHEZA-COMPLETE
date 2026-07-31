// Returns live score + odds for a set of match IDs.
// Used by the challenges page to show real-time data on active challenge cards.
import { NextRequest, NextResponse } from 'next/server';
import { getMatchById } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

function oddsForPick(pick: string, odds: { home?: number; draw?: number; away?: number } | null): number | null {
  if (!odds) return null;
  const p = pick.toLowerCase();
  if (p === 'home win') return odds.home && odds.home > 1 ? odds.home : null;
  if (p === 'away win') return odds.away && odds.away > 1 ? odds.away : null;
  if (p === 'draw') return odds.draw && odds.draw > 1 ? odds.draw : null;
  return null;
}

export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get('matchIds') || '').split(',').filter(Boolean).slice(0, 20);
  if (!ids.length) return NextResponse.json({ data: {} });

  const results: Record<string, {
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    minute: number | null;
    odds: { home: number; draw: number; away: number } | null;
  }> = {};

  await Promise.allSettled(ids.map(async id => {
    try {
      const m = await getMatchById(id);
      if (!m) return;
      const rawOdds = (m as Record<string, unknown>).odds as Record<string, unknown> | undefined;
      let odds: { home: number; draw: number; away: number } | null = null;
      if (rawOdds?.home || rawOdds?.away) {
        odds = {
          home: Number(rawOdds?.home ?? rawOdds?.['1'] ?? 0),
          draw: Number(rawOdds?.draw ?? rawOdds?.['X'] ?? 0),
          away: Number(rawOdds?.away ?? rawOdds?.['2'] ?? 0),
        };
      }
      const minute = typeof (m as Record<string, unknown>).minute === 'number'
        ? (m as Record<string, unknown>).minute as number
        : null;
      results[id] = {
        homeScore: m.homeScore ?? null,
        awayScore: m.awayScore ?? null,
        status: m.status || 'scheduled',
        minute,
        odds,
      };
    } catch { /* ignore individual failures */ }
  }));

  return NextResponse.json({ data: results });
}

export { oddsForPick };
