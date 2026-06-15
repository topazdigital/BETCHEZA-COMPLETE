import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { slugToMatchId } from '@/lib/utils/match-url';
import { seedTipsForMatch, listTipsForMatch, settleTipWithResult, settleTipsByTeamNames, type GeneratedTip } from '@/lib/auto-tips-store';
import { getFakeTipsterById, getFakeTipsters } from '@/lib/fake-tipsters';
import { getMatchById } from '@/lib/api/unified-sports-api';
import { setBaselineLikes, getLikeCount, getCommentCount } from '@/lib/tip-engagement-store';
import { query } from '@/lib/db';
import { sendMail } from '@/lib/mailer';
import { tipsterNewTipsEmail } from '@/lib/email-templates';

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
    settledByProb: tip.settledByProb ?? false,
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
  let matchStatus = '';
  let finalHomeScore: number | undefined;
  let finalAwayScore: number | undefined;

  try {
    const match = await getMatchById(matchId);
    if (match) {
      leagueTier = match.league?.tier ?? 3;
      leagueName = match.league?.name;
      sportName = match.sport?.name;
      kickoff = match.kickoffTime instanceof Date ? match.kickoffTime.toISOString() : String(match.kickoffTime);
      realHome = match.homeTeam?.name || realHome;
      realAway = match.awayTeam?.name || realAway;
      matchStatus = match.status || '';
      finalHomeScore = typeof match.homeScore === 'number' ? match.homeScore : undefined;
      finalAwayScore = typeof match.awayScore === 'number' ? match.awayScore : undefined;
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

  // If match is finished and we have real scores, settle all pending tips now.
  // Also settle by team names as a fallback in case matchId differs from stored ID.
  // IMPORTANT: always pass matchData so HT-Result, corners, cards markets settle correctly.
  if (
    matchStatus === 'finished' &&
    typeof finalHomeScore === 'number' &&
    typeof finalAwayScore === 'number'
  ) {
    let matchData: { htHomeScore?: number | null; htAwayScore?: number | null; corners?: { home: number; away: number }; yellowCards?: { home: number; away: number }; redCards?: { home: number; away: number } } | undefined;
    try {
      const fullMatch = await getMatchById(matchId);
      if (fullMatch) {
        matchData = {
          htHomeScore: fullMatch.htHomeScore ?? null,
          htAwayScore: fullMatch.htAwayScore ?? null,
          corners: fullMatch.sportSpecificData?.corners,
          yellowCards: fullMatch.sportSpecificData?.yellowCards,
          redCards: fullMatch.sportSpecificData?.redCards,
        };
      }
    } catch { /* best-effort */ }
    settleTipWithResult(matchId, finalHomeScore, finalAwayScore, matchData);
    settleTipsByTeamNames(realHome, realAway, finalHomeScore, finalAwayScore, matchData);
  }

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
      // Use MAX to avoid double-counting when in-memory and auto_tips.comments are
      // both seeded from the same baseline value.
      const baseComments = tip.comments || 0;
      const finalComments = commentCount > baseComments ? commentCount : baseComments;
      return { ...tip, likes: like.count, liked: like.liked, comments: finalComments };
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
  const { onReferralFirstBet } = await import('@/lib/referral-store');
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

  // Persist to DB tips table (best-effort, non-blocking)
  setImmediate(async () => {
    try {
      await query(
        `INSERT INTO tips (user_id, match_id, market_id, selection, odds_value, stake, analysis, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [
          user.userId,
          matchId,
          newTip.market,
          newTip.prediction,
          newTip.odds,
          newTip.stake,
          newTip.analysis,
        ],
      );
    } catch (e) {
      console.warn('[tips] DB insert failed (in-memory fallback active):', (e as Error).message);
    }
  });

  // Track first bet for referral system (fire-and-forget)
  onReferralFirstBet(user.userId).catch(() => {});

  // Email all active subscribers of this tipster (non-blocking)
  setImmediate(async () => {
    try {
      const tipsterRow = await query<{ email: string; username: string; display_name: string | null }>(
        `SELECT u.email, u.username, COALESCE(up.display_name, u.username) AS display_name
         FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id
         WHERE u.id = ? LIMIT 1`,
        [user.userId]
      );
      const tipster = tipsterRow.rows[0];
      if (!tipster) return;

      const subsRes = await query<{ email: string; username: string; display_name: string | null }>(
        `SELECT u.email, u.username, COALESCE(up.display_name, u.username) AS display_name
         FROM tipster_subscriptions ts
         JOIN users u ON u.id = ts.user_id
         LEFT JOIN user_profiles up ON up.user_id = ts.user_id
         WHERE ts.tipster_id = ? AND ts.status = 'active' AND ts.expires_at > NOW()
           AND u.email IS NOT NULL AND u.email != ''`,
        [user.userId]
      );

      if (subsRes.rows.length === 0) return;

      // Resolve match details for the email
      let homeTeam = 'Home Team';
      let awayTeam = 'Away Team';
      let league = '';
      try {
        const match = await getMatchById(matchId);
        if (match) {
          homeTeam = match.homeTeam;
          awayTeam = match.awayTeam;
          league = match.league || '';
        }
      } catch { /* use defaults */ }

      for (const sub of subsRes.rows) {
        try {
          const tpl = tipsterNewTipsEmail({
            subscriberName: sub.display_name || sub.username,
            tipsterName: tipster.display_name || tipster.username,
            tipsterUsername: tipster.username,
            tips: [{
              homeTeam,
              awayTeam,
              league,
              pick: newTip.prediction,
              market: newTip.market,
              odds: newTip.odds,
              reasoning: newTip.analysis,
            }],
          });
          await sendMail({ to: sub.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
        } catch { /* skip one failed recipient */ }
      }
    } catch (e) {
      console.error('[tips] subscriber email blast failed:', e);
    }
  });

  return NextResponse.json({ tip: newTip, ok: true });
}

// Touch import to silence unused warning when getFakeTipsters not needed elsewhere
void getFakeTipsters;
