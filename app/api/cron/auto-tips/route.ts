import { NextRequest, NextResponse } from 'next/server';
import { getFakeTipsters, pickTipstersForMatch } from '@/lib/fake-tipsters';
import { castVote, type VotePick } from '@/lib/votes-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Auto-tips cron — invoked periodically (or by the admin "post sample tips"
 * button). Picks a deterministic-but-varied subset of fake tipsters per
 * upcoming match and posts plausible tips, weighted by league popularity so
 * top-tier matches always have more action than obscure fixtures.
 *
 * After posting tips, fake tipsters also cast a crowd "Who Will Win?" vote
 * that matches their tip direction:
 *   - home win tip   → "home" vote
 *   - away win tip   → "away" vote
 *   - draw tip       → "draw" vote
 *   - other markets  → random pick (or skip ~30% of the time for realism)
 */

/** Derive a crowd-vote pick from a market key + outcome name */
function derivePick(marketKey: string, outcomeName: string): VotePick | null {
  const mk = (marketKey || '').toLowerCase();
  const on = (outcomeName || '').toLowerCase();

  // h2h / match winner market
  if (mk.includes('h2h') || mk.includes('winner') || mk.includes('1x2') || mk === 'match_winner') {
    if (on === 'home' || on.includes('home')) return 'home';
    if (on === 'away' || on.includes('away')) return 'away';
    if (on === 'draw' || on.includes('draw')) return 'draw';
    // some APIs return team names — we can't resolve without match context; skip
    return null;
  }

  // asian handicap / spreads often favour a side
  if (mk.includes('handicap') || mk.includes('spread')) {
    if (on.includes('home') || on.startsWith('1')) return 'home';
    if (on.includes('away') || on.startsWith('2')) return 'away';
    return null;
  }

  // Goals, BTTS, corners — no direction, cast random with 40% skip rate
  if (Math.random() < 0.40) return null;
  const picks: VotePick[] = ['home', 'draw', 'away'];
  return picks[Math.floor(Math.random() * picks.length)];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dry = searchParams.get('dry') === '1';
  const limit = Math.min(40, Math.max(5, Number(searchParams.get('limit')) || 20));

  const fake = getFakeTipsters();
  if (fake.length === 0) {
    return NextResponse.json({ success: false, error: 'no fake tipsters seeded' }, { status: 400 });
  }

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
  let votesCount = 0;

  for (const m of matches) {
    const realMarkets = (m.markets || []).filter((mk: any) => mk?.outcomes?.length);
    if (realMarkets.length === 0) continue;

    const tipsters = pickTipstersForMatch(String(m.id), m.league?.tier || 3, m.tipsCount > 0 ? 1.2 : 0.6);
    const outcomes: string[] = [];

    for (const tipster of tipsters) {
      const market = realMarkets[Math.floor(Math.random() * realMarkets.length)];
      const outcome = market.outcomes[Math.floor(Math.random() * market.outcomes.length)];
      outcomes.push(`${tipster.username}: ${market.name} → ${outcome.name} @ ${outcome.price}`);

      if (!dry) {
        try {
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

        // Cast a crowd vote matching this tipster's prediction
        try {
          const pick = derivePick(market.key, outcome.name);
          if (pick) {
            // Use a deterministic fake voter ID so the same tipster doesn't
            // vote twice on the same match across cron runs.
            const voterId = `fake_tipster_${tipster.id}_${m.id}`;
            const voteResult = await castVote(String(m.id), voterId, pick);
            if (voteResult.ok) votesCount++;
          }
        } catch { /* ignore — votes are best-effort */ }
      }
    }
    planned.push({ matchId: String(m.id), tipsters: tipsters.map(t => t.id), outcomes });
  }

  // Also seed random votes from "background fans" (non-tipster crowd) for
  // matches that have very few votes, to make the widget look active.
  if (!dry) {
    for (const m of matches.slice(0, 10)) {
      const fanCount = 3 + Math.floor(Math.random() * 8);
      const picks: VotePick[] = ['home', 'draw', 'away'];
      for (let i = 0; i < fanCount; i++) {
        try {
          const voterId = `fan_seed_${m.id}_${i}_${Math.floor(Date.now() / 86400000)}`;
          const pick = picks[Math.floor(Math.random() * picks.length)];
          const result = await castVote(String(m.id), voterId, pick);
          if (result.ok) votesCount++;
        } catch { /* ignore */ }
      }
    }
  }

  return NextResponse.json({
    success: true,
    dry,
    matchesScanned: matches.length,
    matchesEligible: planned.length,
    tipsPosted: dry ? 0 : postedCount,
    votesAdded: dry ? 0 : votesCount,
    plan: planned.slice(0, 20),
  });
}
