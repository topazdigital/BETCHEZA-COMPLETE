import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { slugToMatchId } from '@/lib/utils/match-url';
import { seedTipsForMatch, listTipsForMatch, type GeneratedTip } from '@/lib/auto-tips-store';
import { getFakeTipsterById, getFakeTipsters } from '@/lib/fake-tipsters';
import { getMatchById } from '@/lib/api/unified-sports-api';
import { setBaselineLikes, getLikeCount, getCommentCount } from '@/lib/tip-engagement-store';

export const dynamic = 'force-dynamic';

// ─── In-memory store of user-submitted tips, keyed by matchId ───
interface SubmittedTip {
  id: string;
  matchId: string;
  prediction: string;
  market: string;
  odds: number;
  stake: number;
  confidence: number;
  analysis: string;
  isPremium: boolean;
  status: string;
  likes: number;
  dislikes: number;
  comments: number;
  createdAt: string;
  tipster: {
    id: string;
    displayName: string;
    totalTips: number;
    wonTips: number;
    winRate: number;
    roi: number;
    streak: number;
    rank: number;
    isPremium: boolean;
    monthlyPrice: number;
    followers: number;
    verified: boolean;
  };
}
const submittedTipsStore: Map<string, SubmittedTip[]> =
  (globalThis as { __tipsStore?: Map<string, SubmittedTip[]> }).__tipsStore
  || new Map<string, SubmittedTip[]>();
(globalThis as { __tipsStore?: Map<string, SubmittedTip[]> }).__tipsStore = submittedTipsStore;

function autoTipToWire(tip: GeneratedTip) {
  const t = getFakeTipsterById(tip.tipsterId);
  return {
    id: tip.id,
    matchId: tip.matchId,
    prediction: tip.prediction,
    market: tip.market,
    marketKey: tip.marketKey,
    odds: tip.odds,
    stake: tip.stake,
    confidence: tip.confidence,
    analysis: tip.analysis,
    isPremium: tip.isPremium,
    status: tip.status,
    likes: tip.likes,
    dislikes: tip.dislikes,
    comments: tip.comments,
    createdAt: tip.createdAt,
    tipster: {
      id: String(tip.tipsterId),
      displayName: t?.displayName || `Tipster ${tip.tipsterId}`,
      username: t?.username,
      avatar: t?.avatar,
      totalTips: t?.totalTips ?? 0,
      wonTips: t?.wonTips ?? 0,
      winRate: t?.winRate ?? 0,
      roi: t?.roi ?? 0,
      streak: t?.streak ?? 0,
      rank: 0,
      isPremium: !!t?.isPro,
      monthlyPrice: t?.subscriptionPrice ?? 0,
      followers: t?.followersCount ?? 0,
      verified: !!t?.isVerified,
      isFake: true,
    },
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const matchId = slugToMatchId(decodeURIComponent(rawId));
  const { searchParams } = new URL(request.url);
  const homeTeam = searchParams.get('home') || 'Home Team';
  const awayTeam = searchParams.get('away') || 'Away Team';

  // Try to enrich with the real match (league tier, kickoff, real markets) so
  // fake-tipster picks reference the same odds/markets the user is browsing.
  let leagueTier = 3;
  let leagueName: string | undefined;
  let sportName: string | undefined;
  let kickoff: string | undefined;
  let markets: { key?: string; name: string; selections: { label: string; odds: number }[] }[] | undefined;
  let realHome = homeTeam;
  let realAway = awayTeam;

  try {
    const match = await getMatchById(matchId);
    if (match) {
      leagueTier = match.league?.tier ?? 3;
      leagueName = match.league?.name;
      sportName = match.sport?.name;
      kickoff = match.kickoffTime instanceof Date ? match.kickoffTime.toISOString() : String(match.kickoffTime);
      realHome = match.homeTeam?.name || realHome;
      realAway = match.awayTeam?.name || realAway;
      if (match.markets && match.markets.length > 0) {
        markets = match.markets.map(m => ({
          key: m.key,
          name: m.name,
          selections: (m.outcomes || []).map(o => ({
            label: o.name,
            odds: typeof o.price === 'number' ? o.price : 2,
          })),
        })).filter(m => m.selections.length > 0);
      }
    }
  } catch { /* best-effort enrichment */ }

  // Generate (or return cached) auto-tips for this match.
  seedTipsForMatch({
    matchId,
    homeTeam: realHome,
    awayTeam: realAway,
    league: leagueName,
    sport: sportName,
    kickoff,
    leagueTier,
    popularity: leagueTier <= 2 ? 1.2 : 0.8,
    markets,
  });

  const autoTipsRaw = listTipsForMatch(matchId);
  // Lock in the auto-generated like counts as the baseline so any subsequent
  // real likes are added on top.
  for (const t of autoTipsRaw) setBaselineLikes(t.id, t.likes);
  const autoTips = autoTipsRaw.map(autoTipToWire);
  const userTips = submittedTipsStore.get(matchId) || [];

  const merged = [...userTips, ...autoTips];
  merged.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  // Hydrate live likes + comment counts (best-effort).
  const viewer = await getCurrentUser().catch(() => null);
  const hydrated = await Promise.all(merged.map(async (tip) => {
    try {
      const [like, commentCount] = await Promise.all([
        getLikeCount(tip.id, viewer?.userId ?? null),
        getCommentCount(tip.id),
      ]);
      return { ...tip, likes: like.count, liked: like.liked, comments: commentCount + (tip.comments || 0) };
    } catch { return tip; }
  }));

  return NextResponse.json({ tips: hydrated, total: hydrated.length });
}

// ─── POST: tipsters submit a new tip on this match ───
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: matchId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: {
    prediction?: string;
    predictionLabel?: string;
    odds?: number;
    stake?: number;
    confidence?: number;
    analysis?: string;
    isPremium?: boolean;
    marketKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.predictionLabel || typeof body.odds !== 'number' || typeof body.confidence !== 'number') {
    return NextResponse.json({ error: 'Missing required fields: predictionLabel, odds, confidence' }, { status: 400 });
  }
  if (!body.analysis || body.analysis.length < 20) {
    return NextResponse.json({ error: 'Analysis must be at least 20 characters' }, { status: 400 });
  }

  const newTip: SubmittedTip = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    matchId,
    prediction: body.predictionLabel,
    market: body.marketKey || 'h2h',
    odds: Math.round(body.odds * 100) / 100,
    stake: body.stake || 3,
    confidence: body.confidence,
    analysis: body.analysis,
    isPremium: !!body.isPremium && (user.role === 'admin' || user.role === 'tipster'),
    status: 'pending',
    likes: 0,
    dislikes: 0,
    comments: 0,
    createdAt: new Date().toISOString(),
    tipster: {
      id: String(user.userId),
      displayName: user.email.split('@')[0],
      totalTips: 1,
      wonTips: 0,
      winRate: 0,
      roi: 0,
      streak: 0,
      rank: 999,
      isPremium: user.role === 'admin' || user.role === 'tipster',
      monthlyPrice: 0,
      followers: 0,
      verified: user.role === 'admin',
    },
  };

  const existing = submittedTipsStore.get(matchId) || [];
  existing.unshift(newTip);
  submittedTipsStore.set(matchId, existing);

  return NextResponse.json({ tip: newTip, ok: true });
}

// Touch import to silence unused warning when getFakeTipsters not needed elsewhere
void getFakeTipsters;
