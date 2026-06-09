import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { execute } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (user.role !== 'tipster' && user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only tipsters can post tips. Apply to become a tipster first.' },
      { status: 403 },
    );
  }

  let body: {
    leagueId?: number;
    leagueName?: string;
    marketName?: string;
    marketKey?: string;
    prediction?: string;
    odds?: number;
    stake?: number;
    confidence?: number;
    analysis?: string;
    isPremium?: boolean;
    matchSlug?: string;
    sport?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { leagueId, leagueName, marketName, marketKey, prediction, odds, stake, confidence, analysis, isPremium, matchSlug, sport } = body;

  if (!prediction || typeof odds !== 'number' || odds < 1.01) {
    return NextResponse.json({ error: 'Missing required fields: prediction, odds' }, { status: 400 });
  }
  if (!analysis || analysis.trim().length < 20) {
    return NextResponse.json({ error: 'Analysis must be at least 20 characters' }, { status: 400 });
  }

  const tipId = `outright-${user.userId}-${Date.now()}`;
  const matchId = `outright:league:${leagueId || 0}`;
  const resolvedStake = Math.min(5, Math.max(1, stake ?? 3));
  const resolvedConfidence = Math.min(100, Math.max(30, confidence ?? 70));

  try {
    await execute(
      `INSERT INTO auto_tips
        (id, tipster_id, match_id, match_slug, home_team, away_team, league, sport,
         market, market_key, prediction, odds, stake, confidence, analysis, is_premium, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        tipId,
        user.userId,
        matchId,
        matchSlug || null,
        leagueName || 'League Outright',
        'Outright Market',
        leagueName || null,
        sport || 'football',
        marketName || 'Outright',
        marketKey || 'outright',
        prediction,
        Math.round(odds * 100) / 100,
        resolvedStake,
        resolvedConfidence,
        analysis.trim(),
        isPremium && (user.role === 'admin' || user.role === 'tipster') ? 1 : 0,
      ],
    );

    return NextResponse.json({
      success: true,
      tip: {
        id: tipId,
        prediction,
        odds,
        market: marketName,
        analysis: analysis.trim(),
      },
    });
  } catch (err) {
    console.error('[outrights/tips] insert failed:', err);
    return NextResponse.json({ error: 'Failed to save tip' }, { status: 500 });
  }
}
