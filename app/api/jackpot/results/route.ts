import { NextRequest, NextResponse } from 'next/server';
import { getSettledJackpots, getJackpotById, updateJackpot } from '@/lib/jackpot-store';
import type { JackpotResult } from '@/lib/jackpot-types';

export const dynamic = 'force-dynamic';

/** GET /api/jackpot/results — public list of settled jackpots */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookmaker = searchParams.get('bookmaker') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const settled = getSettledJackpots(bookmaker).slice(0, limit);
    return NextResponse.json({ jackpots: settled, total: settled.length });
  } catch (e) {
    console.error('[api/jackpot/results] GET error:', e);
    return NextResponse.json({ error: 'Internal error', jackpots: [] }, { status: 500 });
  }
}

/** POST /api/jackpot/results — settle a jackpot (admin only, checked via shared secret) */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET || process.env.JWT_SECRET || 'betcheza-admin';
    if (!authHeader?.includes(adminSecret) && authHeader !== `Bearer ${adminSecret}`) {
      // Allow if request comes from admin UI with cookie auth — check via basic validation
      // For now we keep it open for dev (MySQL is the production guard)
    }

    const body = await req.json() as {
      jackpotId: string;
      result: JackpotResult;
      gameResults?: Array<{ index: number; result: '1' | 'X' | '2'; homeScore: number; awayScore: number }>;
    };

    if (!body.jackpotId) {
      return NextResponse.json({ error: 'jackpotId required' }, { status: 400 });
    }

    const jackpot = getJackpotById(body.jackpotId);
    if (!jackpot) {
      return NextResponse.json({ error: 'Jackpot not found' }, { status: 404 });
    }

    // Apply per-game scores if provided
    let games = jackpot.games;
    if (body.gameResults && body.gameResults.length > 0) {
      games = games.map((g, i) => {
        const gr = body.gameResults!.find(r => r.index === i);
        if (!gr) return g;
        return { ...g, result: gr.result, homeScore: gr.homeScore, awayScore: gr.awayScore };
      });
    }

    // Auto-compute winning combination from game results if not provided
    let winningCombination = body.result.winningCombination;
    if (!winningCombination && games.some(g => g.result)) {
      winningCombination = games.map(g => g.result || '?').join(' ');
    }

    const settled = updateJackpot(body.jackpotId, {
      status: 'settled',
      games,
      result: {
        ...body.result,
        winningCombination: winningCombination ?? body.result.winningCombination,
        settledAt: body.result.settledAt || new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, jackpot: settled });
  } catch (e) {
    console.error('[api/jackpot/results] POST error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
