import { NextResponse } from 'next/server';
import { getAllMatches } from '@/lib/api/unified-sports-api';
import { castVote, getVoteTotals } from '@/lib/votes-store';
import type { VotePick } from '@/lib/votes-store';

export const dynamic = 'force-dynamic';

interface MemoryVote {
  matchId: string;
  voterId: string;
  pick: VotePick;
  ts: number;
}

const g = globalThis as { __matchVotes?: MemoryVote[]; __fakeVotesSeedTs?: number; __seededMatchIds?: Set<string> };

// Realistic vote counts that tipsters cast — small random pools, not uniform large blocks
const VOTE_POOLS = [3, 6, 9, 10, 12, 15, 20, 25, 30, 35, 40, 50];

// Popular leagues get more votes
const POPULAR_LEAGUE_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 15, 16, 25, 101]);

function getVotePool(leagueId?: number, popularity?: number): number {
  const isPopular = leagueId && POPULAR_LEAGUE_IDS.has(leagueId);
  // Pick a base pool, boosted for popular leagues
  const pools = isPopular
    ? VOTE_POOLS.filter(p => p >= 12)  // min 12 for popular leagues
    : VOTE_POOLS;
  
  // Popularity score (tipsCount) can further boost
  const boost = popularity && popularity > 5 ? Math.min(Math.floor(popularity / 3), 20) : 0;
  const base = pools[Math.floor(Math.random() * pools.length)];
  return Math.max(3, base + boost);
}

// Deterministic seeded RNG for consistent results per matchId
function seededRand(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h ^= h << 13; h ^= h >> 17; h ^= h << 5;
    return ((h >>> 0) / 0xFFFFFFFF);
  };
}

async function seedFakeVotesForMatches(matchData: Array<{ id: string; leagueId?: number; tipsCount?: number; sport?: string }>): Promise<number> {
  if (!g.__seededMatchIds) g.__seededMatchIds = new Set();
  if (!g.__matchVotes) g.__matchVotes = [];

  let added = 0;

  for (const match of matchData) {
    // Only seed if not already seeded for this match
    if (g.__seededMatchIds.has(match.id)) continue;
    g.__seededMatchIds.add(match.id);

    const rand = seededRand(match.id);
    const totalVotes = getVotePool(match.leagueId, match.tipsCount || 0);
    
    // Sports without draws get different distributions
    const hasDraw = !['basketball', 'tennis', 'baseball', 'hockey', 'mma', 'boxing', 'american-football', 'football'].includes(match.sport || '');
    
    // Realistic split — home bias for soccer, more even for others
    const homeShare = 0.38 + rand() * 0.22;  // 38–60%
    const drawShare = hasDraw ? (0.12 + rand() * 0.18) : 0;  // 12–30% if applicable, 0 otherwise
    const awayShare = 1 - homeShare - drawShare;

    const homeVotes = Math.max(1, Math.round(totalVotes * homeShare));
    const drawVotes = hasDraw ? Math.max(0, Math.round(totalVotes * drawShare)) : 0;
    const awayVotes = Math.max(1, totalVotes - homeVotes - drawVotes);

    const picks: Array<[VotePick, number]> = [
      ['home', homeVotes],
      ['draw', drawVotes],
      ['away', awayVotes],
    ].filter(([, count]) => count > 0) as Array<[VotePick, number]>;

    for (const [pick, count] of picks) {
      for (let i = 0; i < count; i++) {
        const voterId = `fv_${pick}_${match.id.slice(-8)}_${i}_${Math.floor(rand() * 99999)}`;

        // Try DB first via castVote, fall back to memory
        try {
          await castVote(match.id, voterId, pick);
        } catch {
          // If DB fails, add to memory
          const existsInMemory = g.__matchVotes!.some(v => v.matchId === match.id && v.voterId === voterId);
          if (!existsInMemory) {
            g.__matchVotes!.push({
              matchId: match.id,
              voterId,
              pick,
              ts: Date.now() - Math.floor(rand() * 24 * 60 * 60 * 1000),
            });
          }
        }
        added++;
      }
    }
  }

  return added;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  if (secret !== (process.env.CRON_SECRET || 'betcheza-cron-2024')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allMatches = await getAllMatches();
    const now = Date.now();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

    const relevantMatches = allMatches
      .filter(m => {
        const t = new Date(m.kickoffTime).getTime();
        return t >= now - 3 * 60 * 60 * 1000 && t <= now + twoDaysMs;
      })
      .slice(0, 100);

    const matchData = relevantMatches.map(m => ({
      id: m.id,
      leagueId: m.leagueId,
      tipsCount: m.tipsCount || 0,
      sport: m.sport?.slug,
    }));

    const added = await seedFakeVotesForMatches(matchData);

    return NextResponse.json({
      ok: true,
      matchesProcessed: matchData.length,
      votesAdded: added,
      totalVotes: g.__matchVotes?.length ?? 0,
    });
  } catch (error) {
    console.error('[fake-votes] Error:', error);
    return NextResponse.json({ error: 'Failed to seed fake votes' }, { status: 500 });
  }
}

// Auto-seed on import — fires once per process, re-seeds every 30 min
if (typeof globalThis !== 'undefined') {
  const lastSeed = g.__fakeVotesSeedTs || 0;
  if (Date.now() - lastSeed > 30 * 60 * 1000) {
    g.__fakeVotesSeedTs = Date.now();
    getAllMatches().then(matches => {
      const now = Date.now();
      const data = matches
        .filter(m => {
          const t = new Date(m.kickoffTime).getTime();
          return t >= now - 3 * 60 * 60 * 1000 && t <= now + 2 * 24 * 60 * 60 * 1000;
        })
        .slice(0, 80)
        .map(m => ({
          id: m.id,
          leagueId: m.leagueId,
          tipsCount: m.tipsCount || 0,
          sport: m.sport?.slug,
        }));
      seedFakeVotesForMatches(data).catch(() => undefined);
    }).catch(() => undefined);
  }
}
