import { NextRequest, NextResponse } from 'next/server';
import { getFakeTipsters, pickTipstersForMatch } from '@/lib/fake-tipsters';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Auto-tips cron — invoked periodically (or by the admin "post sample tips"
 * button). Picks a deterministic-but-varied subset of fake tipsters per
 * upcoming match and posts plausible tips, weighted by league popularity so
 * top-tier matches always have more action than obscure fixtures.
 *
 * GET /api/cron/auto-tips?dry=1 — preview without posting.
 *
 * NB: this never INVENTS odds. It only picks an outcome from the real markets
 * already attached to the match. Matches without real odds are skipped.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dry = searchParams.get('dry') === '1';
  const limit = Math.min(40, Math.max(5, Number(searchParams.get('limit')) || 20));

  const fake = getFakeTipsters();
  if (fake.length === 0) {
    return NextResponse.json({ success: false, error: 'no fake tipsters seeded' }, { status: 400 });
  }

  // Pull the current match list from our own API so we stay in sync with the
  // exact same source the homepage uses.
  const origin = new URL(request.url).origin;
  let matches: any[] = [];
  try {
    const r = await fetch(`${origin}/api/matches?status=upcoming`, { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      matches = (j?.matches || []).slice(0, limit);
    }
  } catch {
    matches = [];
  }

  const planned: Array<{ matchId: string; tipsters: number[]; outcomes: string[] }> = [];
  let postedCount = 0;

  for (const m of matches) {
    const realMarkets = (m.markets || []).filter((mk: any) => mk?.outcomes?.length);
    if (realMarkets.length === 0) continue; // never invent odds

    const tipsters = pickTipstersForMatch(String(m.id), m.league?.tier || 3, m.tipsCount > 0 ? 1.2 : 0.6);
    const outcomes: string[] = [];

    for (const tipster of tipsters) {
      const market = realMarkets[Math.floor(Math.random() * realMarkets.length)];
      const outcome = market.outcomes[Math.floor(Math.random() * market.outcomes.length)];
      outcomes.push(`${tipster.username}: ${market.name} → ${outcome.name} @ ${outcome.price}`);

      if (!dry) {
        try {
          // Best-effort POST. We don't block on individual failures.
          await fetch(`${origin}/api/matches/${encodeURIComponent(m.id)}/tips`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-fake-tipster-id': String(tipster.id),
            },
            body: JSON.stringify({
              prediction: `${market.key}:${outcome.name}`,
              predictionLabel: outcome.name,
              odds: outcome.price,
              stake: 2 + Math.floor(Math.random() * 3),
              confidence: 55 + Math.floor(Math.random() * 30),
              analysis: `Auto-generated angle on ${m.homeTeam?.name} vs ${m.awayTeam?.name}. Following ${tipster.specialties.join(' & ')} model. Stake light.`,
              isPremium: false,
              marketKey: market.key,
              homeTeam: m.homeTeam?.name,
              awayTeam: m.awayTeam?.name,
              fakeTipsterId: tipster.id,
            }),
          });
          postedCount++;
        } catch { /* ignore */ }
      }
    }
    planned.push({ matchId: String(m.id), tipsters: tipsters.map(t => t.id), outcomes });
  }

  return NextResponse.json({
    success: true,
    dry,
    matchesScanned: matches.length,
    matchesEligible: planned.length,
    tipsPosted: dry ? 0 : postedCount,
    plan: planned.slice(0, 20),
  });
}
