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

// Realistic vote counts — small random pools, not uniform large blocks
const VOTE_POOLS = [3, 6, 9, 10, 12, 15, 20, 25, 30, 35, 40, 50];

// Popular leagues get more votes
const POPULAR_LEAGUE_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 15, 16, 25, 101]);

function getVotePool(leagueId?: number, popularity?: number): number {
  const isPopular = leagueId && POPULAR_LEAGUE_IDS.has(leagueId);
  const pools = isPopular
    ? VOTE_POOLS.filter(p => p >= 12)
    : VOTE_POOLS;
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

/**
 * Compute realistic human vote shares from bookmaker odds.
 *
 * Logic:
 * 1. Convert odds → implied probability (1/odds).
 * 2. Normalise away the bookmaker margin so probabilities sum to 1.
 * 3. Apply "crowd amplification" (power 1.6) — people vote even more heavily
 *    for the favourite than the raw implied odds suggest (favourite-longshot
 *    bias in reverse: punters massively overback favourites).
 * 4. Add a small home-crowd bias (+4 pp to home, taken equally from draw/away).
 * 5. Blend in a tiny deterministic jitter (±3 pp) for match-to-match variety.
 *
 * Example: home 1.34 / draw 5.00 / away 8.50
 *   Implied:       71% / 20% / 12%  (after removing ~5% margin)
 *   After power:   ~84% / ~10% / ~6%
 *   After home bias: ~88% / ~7% / ~5%
 *   → Away team with 8.50 odds gets only ~5% of votes. ✓
 */
function computeVoteShares(
  homeOdds: number | null,
  drawOdds: number | null,
  awayOdds: number | null,
  hasDraw: boolean,
  rand: () => number,
): { homeShare: number; drawShare: number; awayShare: number } {
  const AMPLIFICATION = 1.6; // crowd over-weights favourites
  const HOME_BIAS     = 0.04; // home-team crowd advantage

  // --- Fallback when odds are missing: use a sensible home-leaning default ---
  if (!homeOdds || !awayOdds || homeOdds <= 1 || awayOdds <= 1) {
    const homeShare = 0.45 + rand() * 0.12; // 45–57%
    const drawShare = hasDraw ? 0.20 + rand() * 0.08 : 0;
    const awayShare = 1 - homeShare - drawShare;
    return { homeShare, drawShare, awayShare: Math.max(0.05, awayShare) };
  }

  // 1. Implied probabilities
  const iHome = 1 / homeOdds;
  const iDraw = hasDraw && drawOdds && drawOdds > 1 ? 1 / drawOdds : 0;
  const iAway = 1 / awayOdds;
  const totalImplied = iHome + iDraw + iAway;

  // 2. Normalise (remove bookmaker margin)
  const pHome = iHome / totalImplied;
  const pDraw = iDraw / totalImplied;
  const pAway = iAway / totalImplied;

  // 3. Crowd amplification — humans over-bet favourites
  const aHome = Math.pow(pHome, AMPLIFICATION);
  const aDraw = Math.pow(pDraw, AMPLIFICATION);
  const aAway = Math.pow(pAway, AMPLIFICATION);
  const totalA = aHome + aDraw + aAway;

  let homeShare = aHome / totalA;
  let drawShare = aDraw / totalA;
  let awayShare = aAway / totalA;

  // 4. Home-crowd bias: shift HOME_BIAS from away/draw equally
  const homeBias = HOME_BIAS;
  const awayPenalty = hasDraw ? homeBias / 2 : homeBias;
  const drawPenalty = hasDraw ? homeBias / 2 : 0;

  homeShare = Math.min(homeShare + homeBias, 0.92);
  awayShare = Math.max(awayShare - awayPenalty, 0.03);
  drawShare = hasDraw ? Math.max(drawShare - drawPenalty, 0.03) : 0;

  // Re-balance so shares sum to 1
  const total = homeShare + drawShare + awayShare;
  homeShare /= total;
  drawShare /= total;
  awayShare /= total;

  // 5. Small deterministic jitter (±3 pp) for match-to-match variety
  const jH = (rand() - 0.5) * 0.06;
  const jD = hasDraw ? (rand() - 0.5) * 0.04 : 0;
  homeShare = Math.max(0.05, homeShare + jH);
  drawShare = hasDraw ? Math.max(0.03, drawShare + jD) : 0;
  awayShare = Math.max(0.02, 1 - homeShare - drawShare);

  // Final normalise
  const finalTotal = homeShare + drawShare + awayShare;
  return {
    homeShare: homeShare / finalTotal,
    drawShare: drawShare / finalTotal,
    awayShare: awayShare / finalTotal,
  };
}

/** Extract home/draw/away odds from a match's 1X2/h2h market. */
function extractH2HOdds(markets: Array<{ key: string; name: string; outcomes: Array<{ name: string; price: number }> }> | undefined): {
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
} {
  if (!markets) return { homeOdds: null, drawOdds: null, awayOdds: null };

  const h2h = markets.find(m => {
    const k = (m.key || '').toLowerCase();
    const n = (m.name || '').toLowerCase();
    return k.includes('h2h') || k.includes('1x2') || k === 'match_winner' ||
           n.includes('1x2') || n.includes('match result') || n.includes('match winner');
  });

  if (!h2h) return { homeOdds: null, drawOdds: null, awayOdds: null };

  let homeOdds: number | null = null;
  let drawOdds: number | null = null;
  let awayOdds: number | null = null;

  for (const o of h2h.outcomes || []) {
    const n = (o.name || '').toLowerCase();
    if (n === 'home' || n === '1' || n === 'home win') homeOdds = o.price;
    else if (n === 'draw' || n === 'x') drawOdds = o.price;
    else if (n === 'away' || n === '2' || n === 'away win') awayOdds = o.price;
  }

  return { homeOdds, drawOdds, awayOdds };
}

async function seedFakeVotesForMatches(matchData: Array<{
  id: string;
  leagueId?: number;
  tipsCount?: number;
  sport?: string;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
}>): Promise<number> {
  if (!g.__seededMatchIds) g.__seededMatchIds = new Set();
  if (!g.__matchVotes) g.__matchVotes = [];

  let added = 0;

  for (const match of matchData) {
    if (g.__seededMatchIds.has(match.id)) continue;
    g.__seededMatchIds.add(match.id);

    const rand = seededRand(match.id);
    const totalVotes = getVotePool(match.leagueId, match.tipsCount || 0);

    const hasDraw = !['basketball', 'tennis', 'baseball', 'hockey', 'mma', 'boxing', 'american-football'].includes(match.sport || '');

    const { homeShare, drawShare, awayShare } = computeVoteShares(
      match.homeOdds,
      match.drawOdds,
      match.awayOdds,
      hasDraw,
      rand,
    );

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

        try {
          await castVote(match.id, voterId, pick);
        } catch {
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

    const matchData = relevantMatches.map(m => {
      const { homeOdds, drawOdds, awayOdds } = extractH2HOdds(
        (m.markets as Array<{ key: string; name: string; outcomes: Array<{ name: string; price: number }> }>) ?? undefined,
      );
      return {
        id: m.id,
        leagueId: m.leagueId,
        tipsCount: m.tipsCount || 0,
        sport: m.sport?.slug,
        homeOdds,
        drawOdds,
        awayOdds,
      };
    });

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
