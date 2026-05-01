import { NextResponse } from 'next/server';
import { getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

type VotePick = 'home' | 'draw' | 'away';

interface MemoryVote {
  matchId: string;
  voterId: string;
  pick: VotePick;
  ts: number;
}

const g = globalThis as { __matchVotes?: MemoryVote[]; __fakeVotesSeedTs?: number };

function seedFakeVotesForMatches(matchIds: string[]): number {
  if (!g.__matchVotes) g.__matchVotes = [];

  const existingMatchIds = new Set(g.__matchVotes.map(v => v.matchId));
  let added = 0;

  for (const matchId of matchIds) {
    // Only seed if not already seeded for this match
    if (existingMatchIds.has(matchId)) continue;

    // Generate realistic vote counts: home bias (~45%), draw (~25%), away (~30%)
    const baseVotes = Math.floor(Math.random() * 120) + 20;
    const homeShare = 0.35 + Math.random() * 0.25;  // 35-60%
    const drawShare = 0.10 + Math.random() * 0.20;  // 10-30%
    const awayShare = 1 - homeShare - drawShare;

    const homeVotes = Math.floor(baseVotes * homeShare);
    const drawVotes = Math.floor(baseVotes * drawShare);
    const awayVotes = Math.floor(baseVotes * awayShare);

    const picks: Array<[VotePick, number]> = [
      ['home', homeVotes],
      ['draw', drawVotes],
      ['away', awayVotes],
    ];

    for (const [pick, count] of picks) {
      for (let i = 0; i < count; i++) {
        const voterId = `fake_${pick}_${matchId}_${i}_${Math.random().toString(36).slice(2, 8)}`;
        g.__matchVotes.push({
          matchId,
          voterId,
          pick,
          ts: Date.now() - Math.floor(Math.random() * 24 * 60 * 60 * 1000),
        });
        added++;
      }
    }
    existingMatchIds.add(matchId);
  }

  return added;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  // Require a simple secret to prevent public abuse
  if (secret !== (process.env.CRON_SECRET || 'betcheza-cron-2024')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allMatches = await getAllMatches();
    // Only seed votes for today's and tomorrow's matches
    const now = Date.now();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const relevantMatches = allMatches
      .filter(m => {
        const t = new Date(m.kickoffTime).getTime();
        return t >= now - 3 * 60 * 60 * 1000 && t <= now + twoDaysMs;
      })
      .slice(0, 100); // cap at 100 matches

    const matchIds = relevantMatches.map(m => m.id);
    const added = seedFakeVotesForMatches(matchIds);

    return NextResponse.json({
      ok: true,
      matchesProcessed: matchIds.length,
      votesAdded: added,
      totalVotes: g.__matchVotes?.length ?? 0,
    });
  } catch (error) {
    console.error('[fake-votes] Error:', error);
    return NextResponse.json({ error: 'Failed to seed fake votes' }, { status: 500 });
  }
}

// Auto-seed on import (server-side only, fires once per process)
if (typeof globalThis !== 'undefined') {
  const lastSeed = g.__fakeVotesSeedTs || 0;
  if (Date.now() - lastSeed > 30 * 60 * 1000) { // re-seed every 30 min
    g.__fakeVotesSeedTs = Date.now();
    // Fire-and-forget: seed with placeholder IDs first, real IDs loaded async
    getAllMatches().then(matches => {
      const ids = matches
        .filter(m => {
          const t = new Date(m.kickoffTime).getTime();
          return t >= Date.now() - 3 * 60 * 60 * 1000 && t <= Date.now() + 2 * 24 * 60 * 60 * 1000;
        })
        .slice(0, 80)
        .map(m => m.id);
      seedFakeVotesForMatches(ids);
    }).catch(() => undefined);
  }
}
