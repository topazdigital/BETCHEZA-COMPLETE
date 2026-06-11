import { NextRequest, NextResponse } from 'next/server';
import { listFollowersOfTipster, listFollowedTipsters } from '@/lib/follows-store';
import { getFakeTipsterById, getFakeTipsterByUsername, getFakeTipsterBySlug, getFakeTipsters, type FakeTipster } from '@/lib/fake-tipsters';
import { query as dbQuery } from '@/lib/db';
import {
  listTipsForTipster,
  seedTipsForMatch,
  settleStaleAutoTips,
  bulkResettleWithRealData,
  computeRealTipsterStats,
  computeRealRoi,
  computeRealStreak,
  type GeneratedTip,
  type TipMatchData,
} from '@/lib/auto-tips-store';
import { getAllMatches, type UnifiedMatch } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface TipsterShape {
  id: number;
  username: string;
  displayName: string;
  avatar: string | null;
  bio: string;
  winRate: number;
  roi: number;
  totalTips: number;
  wonTips: number;
  lostTips: number;
  pendingTips: number;
  avgOdds: number;
  streak: number;
  rank: number;
  followers: number;
  following: number;
  isPro: boolean;
  subscriptionPrice: number | null;
  currency: string;
  specialties: string[];
  verified: boolean;
  country: string;
  countryCode: string;
  joinedAt: string;
  lastActive: string;
  socials: Record<string, string>;
  performanceVerified: boolean;
}

// Country code → human label.
const COUNTRY_NAMES: Record<string, string> = {
  KE: 'Kenya', NG: 'Nigeria', GH: 'Ghana', TZ: 'Tanzania', UG: 'Uganda',
  ZA: 'South Africa', GB: 'United Kingdom', ES: 'Spain', DE: 'Germany',
  IT: 'Italy', FR: 'France', BR: 'Brazil', AR: 'Argentina', PT: 'Portugal',
  US: 'United States', IN: 'India',
};

function fakeToShape(fake: FakeTipster): TipsterShape {
  return {
    id: fake.id,
    username: fake.username,
    displayName: fake.displayName,
    avatar: fake.avatar,
    bio: fake.bio,
    winRate: fake.winRate,
    roi: fake.roi,
    totalTips: fake.totalTips,
    wonTips: fake.wonTips,
    lostTips: fake.lostTips,
    pendingTips: fake.pendingTips,
    avgOdds: fake.avgOdds,
    streak: fake.streak,
    rank: 0,
    followers: fake.followersCount,
    following: 0,
    isPro: fake.isPro,
    subscriptionPrice: fake.subscriptionPrice,
    currency: 'KES',
    specialties: fake.specialties,
    verified: fake.isVerified,
    country: COUNTRY_NAMES[fake.countryCode] || fake.countryCode,
    countryCode: fake.countryCode,
    joinedAt: fake.joinedAt,
    lastActive: new Date().toISOString(),
    socials: {},
    performanceVerified: false,
  };
}

interface DbUserRow {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country_code: string | null;
  is_verified: number | null;
  created_at: Date | string | null;
  win_rate: number | null;
  roi: number | null;
  total_tips: number | null;
  won_tips: number | null;
  lost_tips: number | null;
  pending_tips: number | null;
  avg_odds: number | null;
  streak: number | null;
  rank: number | null;
  followers_count: number | null;
  is_pro: number | null;
  subscription_price: number | null;
}

function dbUserToShape(row: DbUserRow): TipsterShape {
  const countryCode = row.country_code || 'KE';
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    avatar: row.avatar_url,
    bio: row.bio || '',
    winRate: Number(row.win_rate ?? 0),
    roi: Number(row.roi ?? 0),
    totalTips: Number(row.total_tips ?? 0),
    wonTips: Number(row.won_tips ?? 0),
    lostTips: Number(row.lost_tips ?? 0),
    pendingTips: Number(row.pending_tips ?? 0),
    avgOdds: Number(row.avg_odds ?? 0),
    streak: Number(row.streak ?? 0),
    rank: Number(row.rank ?? 0),
    followers: Number(row.followers_count ?? 0),
    following: 0,
    isPro: !!row.is_pro,
    subscriptionPrice: row.subscription_price != null ? Number(row.subscription_price) : null,
    currency: 'KES',
    specialties: ['Football', 'Premier League', 'KPL'],
    verified: !!row.is_verified,
    country: COUNTRY_NAMES[countryCode] || countryCode,
    countryCode,
    joinedAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    lastActive: new Date().toISOString(),
    socials: {},
    performanceVerified: false,
  };
}

async function getRealTipsterFromDb(id: string): Promise<TipsterShape | null> {
  try {
    const numericId = /^\d+$/.test(id) ? parseInt(id, 10) : null;
    const result = await dbQuery<DbUserRow>(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.country_code,
              u.is_verified, u.created_at,
              t.win_rate, t.roi, t.total_tips, t.won_tips, t.lost_tips, t.pending_tips,
              t.avg_odds, t.streak, t.rank_position AS rank, t.followers_count, t.is_pro, t.subscription_price
       FROM users u
       LEFT JOIN tipster_profiles t ON t.user_id = u.id
       WHERE u.role = 'tipster' AND (${numericId != null ? 'u.id = ? OR ' : ''}u.username = ?)
       LIMIT 1`,
      numericId != null ? [numericId, id] : [id]
    );
    if (!result.rows.length) return null;
    return dbUserToShape(result.rows[0]);
  } catch {
    return null;
  }
}

// Deterministic small RNG for derived charts (sparkline/monthly).
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

// Build a 14-point ROI sparkline that lands on the tipster's published ROI.
function generateRoiSparkline(tipsterId: number, finalRoi: number, points = 14) {
  const r = rng(hashStr(`roi-${tipsterId}`));
  const out: { day: number; roi: number }[] = [];
  // Wander from a starting baseline towards finalRoi over `points` steps.
  let cur = finalRoi - 6 + r() * 4;
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const target = (1 - t) * cur + t * finalRoi;
    const noise = (r() - 0.5) * 4;
    cur = target + noise * (1 - t * 0.6);
    out.push({ day: i + 1, roi: Math.round(cur * 10) / 10 });
  }
  // Snap last point to the final ROI so the chart matches the headline number.
  out[out.length - 1] = { day: points, roi: Math.round(finalRoi * 10) / 10 };
  return out;
}

function generateMonthlyStats(tipster: TipsterShape) {
  // Real tipsters with no actual tips should never show fabricated monthly data
  if (!tipster.isFake && tipster.totalTips === 0) return [];

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();
  const r = rng(hashStr(`monthly-${tipster.id}`));
  return months.slice(0, currentMonth + 1).map((month, i) => {
    const tips = Math.max(3, Math.floor(tipster.totalTips / 12 + r() * 10));
    const won = Math.min(tips, Math.floor(tips * (tipster.winRate / 100) + (r() - 0.5) * 4));
    const lost = Math.max(0, tips - won - Math.floor(r() * 2));
    const profit = +(tipster.roi / 12 * (1 + (r() - 0.5) * 0.6) * (i + 1) / 6).toFixed(1);
    const winRate = +Math.max(35, Math.min(95, tipster.winRate + (r() - 0.5) * 12)).toFixed(1);
    return { month, tips, won, lost, profit, winRate };
  });
}

/**
 * Compute win rate per market type from actual settled tips.
 * Groups tips into canonical market buckets and returns stats per bucket.
 */
function generateMarketBreakdown(tipsterId: number, baseWinRate: number) {
  const tips = listTipsForTipster(tipsterId, 200);
  const settled = tips.filter(t => t.status === 'won' || t.status === 'lost');

  // Market key → canonical display name
  const MARKET_NAMES: Record<string, string> = {
    h2h: '1X2 (Match Result)',
    'match_result': '1X2 (Match Result)',
    btts: 'Both Teams to Score',
    btts_and_result: 'BTTS & Result',
    totals: 'Over/Under Goals',
    totals_2_5: 'Over/Under 2.5',
    totals_1_5: 'Over/Under 1.5',
    totals_3_5: 'Over/Under 3.5',
    dc: 'Double Chance',
    double_chance: 'Double Chance',
    dnb: 'Draw No Bet',
    asian_handicap: 'Asian Handicap',
    ht_result: 'Half-Time Result',
    correct_score: 'Correct Score',
  };

  function canonicalize(market: string, marketKey?: string): string {
    const key = (marketKey || '').toLowerCase();
    if (MARKET_NAMES[key]) return MARKET_NAMES[key];
    // Normalize market display name
    const m = market.toLowerCase();
    if (m.includes('1x2') || m.includes('match result') || m.includes('home win') || m.includes('away win') || m.includes('draw')) return '1X2 (Match Result)';
    if (m.includes('btts') || m.includes('both teams')) return 'Both Teams to Score';
    if (m.includes('over') || m.includes('under') || m.includes('total')) return 'Over/Under Goals';
    if (m.includes('double chance')) return 'Double Chance';
    if (m.includes('asian handicap') || m.includes('handicap')) return 'Asian Handicap';
    if (m.includes('half') || m.includes('ht')) return 'Half-Time';
    if (m.includes('correct score')) return 'Correct Score';
    return market;
  }

  // Aggregate by canonical market name
  const buckets = new Map<string, { won: number; lost: number }>();
  for (const tip of settled) {
    const name = canonicalize(tip.market, tip.marketKey);
    const b = buckets.get(name) || { won: 0, lost: 0 };
    if (tip.status === 'won') b.won++;
    else b.lost++;
    buckets.set(name, b);
  }

  // If no real data, derive plausible breakdown from winRate seed
  if (buckets.size === 0) {
    const r = rng(hashStr(`mkts-${tipsterId}`));
    const defaults = ['1X2 (Match Result)', 'Over/Under Goals', 'Both Teams to Score', 'Double Chance'];
    return defaults.map((name, i) => {
      const total = Math.max(5, Math.floor(20 - i * 4 + r() * 8));
      const noise = (r() - 0.5) * 14;
      const wr = Math.round(Math.max(30, Math.min(95, baseWinRate + noise)));
      const won = Math.round(total * wr / 100);
      return { market: name, won, lost: total - won, total, winRate: wr };
    });
  }

  return Array.from(buckets.entries())
    .map(([market, { won, lost }]) => {
      const total = won + lost;
      const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
      return { market, won, lost, total, winRate };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}

function generateSportBreakdown(specialties: string[], totalTips: number) {
  const sportMapping: Record<string, string> = {
    'Football': 'football', 'Premier League': 'football', 'La Liga': 'football',
    'Bundesliga': 'football', 'Serie A': 'football', 'African Football': 'football',
    'CAF': 'football', 'KPL': 'football',
    'Basketball': 'basketball', 'NBA': 'basketball', 'EuroLeague': 'basketball',
    'Tennis': 'tennis', 'ATP': 'tennis', 'WTA': 'tennis',
    'MMA': 'mma', 'UFC': 'mma',
    'Cricket': 'cricket', 'IPL': 'cricket', 'T20': 'cricket',
  };
  const sports = new Set<string>();
  specialties.forEach(s => sports.add(sportMapping[s] || s.toLowerCase()));
  const arr = Array.from(sports);
  let remaining = 100;
  let tipsRemaining = totalTips;
  const out: { sport: string; percentage: number; tips: number }[] = [];
  arr.forEach((sport, i) => {
    const last = i === arr.length - 1;
    const pct = last ? remaining : Math.max(8, Math.floor(remaining / (arr.length - i)));
    // Allocate a proportional share of the real totalTips to this sport
    const sportTips = last ? tipsRemaining : Math.round((pct / 100) * totalTips);
    remaining -= pct;
    tipsRemaining -= sportTips;
    out.push({ sport: sport.charAt(0).toUpperCase() + sport.slice(1), percentage: pct, tips: Math.max(1, sportTips) });
  });
  return out.sort((a, b) => b.percentage - a.percentage);
}

// Convert auto-tip → recentTips wire shape used by the tipster profile UI.
// When a real match record is supplied we prefer its actual scores so
// finished games surface their real result (not a fake 2-1).
function syntheticScore(prediction: string, status: 'won' | 'lost' | 'void' | 'pending'): { homeScore: number | null; awayScore: number | null } {
  if (status === 'pending') return { homeScore: null, awayScore: null };
  if (status === 'void') return { homeScore: 1, awayScore: 1 };

  const pred = prediction.toLowerCase();
  const isHomeWin = pred.includes('home win') || pred.includes('home or draw') || pred === '1' || pred === '1x';
  const isAwayWin = pred.includes('away win') || pred.includes('away or draw') || pred === '2' || pred === 'x2';
  const isDraw = pred === 'draw' || pred === 'x';
  const isOver = pred.includes('over');
  const isUnder = pred.includes('under');
  const isBttsYes = pred.includes('btts - yes') || pred.includes('both teams to score - yes') || pred === 'yes';
  const isBttsNo = pred.includes('btts - no') || pred.includes('both teams to score - no') || pred === 'no';

  if (status === 'won') {
    if (isHomeWin) return { homeScore: 2, awayScore: 1 };
    if (isAwayWin) return { homeScore: 0, awayScore: 1 };
    if (isDraw) return { homeScore: 1, awayScore: 1 };
    if (isOver) return { homeScore: 2, awayScore: 2 };
    if (isUnder) return { homeScore: 1, awayScore: 0 };
    if (isBttsYes) return { homeScore: 1, awayScore: 1 };
    if (isBttsNo) return { homeScore: 1, awayScore: 0 };
    return { homeScore: 2, awayScore: 1 };
  }
  if (status === 'lost') {
    if (isHomeWin) return { homeScore: 0, awayScore: 1 };
    if (isAwayWin) return { homeScore: 2, awayScore: 0 };
    if (isDraw) return { homeScore: 2, awayScore: 1 };
    if (isOver) return { homeScore: 1, awayScore: 0 };
    if (isUnder) return { homeScore: 2, awayScore: 2 };
    if (isBttsYes) return { homeScore: 1, awayScore: 0 };
    if (isBttsNo) return { homeScore: 1, awayScore: 1 };
    return { homeScore: 0, awayScore: 1 };
  }
  return { homeScore: null, awayScore: null };
}

function autoTipToRecent(t: GeneratedTip, realMatch?: UnifiedMatch) {
  // Only show real verified scores — never fabricate them from prediction type
  let homeScore: number | null = null;
  let awayScore: number | null = null;
  if (
    realMatch?.homeScore != null &&
    realMatch?.awayScore != null &&
    realMatch.status === 'finished' &&
    !t.settledByProb
  ) {
    homeScore = Number(realMatch.homeScore);
    awayScore = Number(realMatch.awayScore);
  }
  return {
    id: t.id,
    settledByProb: !!t.settledByProb,
    match: {
      id: t.matchId,
      homeTeam: t.homeTeam,
      awayTeam: t.awayTeam,
      kickoffTime: t.kickoff || t.createdAt,
      league: t.league || '—',
      sport: t.sport || 'Football',
      homeScore,
      awayScore,
      status: realMatch?.status || (t.status === 'pending' ? 'scheduled' : 'finished'),
    },
    market: t.market,
    selection: t.prediction,
    odds: t.odds,
    stake: t.stake,
    analysis: t.analysis,
    status: t.status,
    confidence: t.confidence,
    likes: t.likes,
    createdAt: t.createdAt,
  };
}

// Best-effort: ensure this tipster has *some* recent tips on real matches.
// Accepts a pre-fetched matches array so we don't call getAllMatches() twice.
function bootstrapTipsterTipsFromMatches(
  tipsterId: number,
  matches: UnifiedMatch[],
  target = 12,
): void {
  const existing = listTipsForTipster(tipsterId, 1);
  if (existing.length >= target) return;
  if (!matches || matches.length === 0) return;
  // Cap to keep the work bounded.
  const slice = matches.slice(0, 80);
  for (const m of slice) {
    seedTipsForMatch({
      matchId: m.id,
      homeTeam: m.homeTeam?.name || 'Home',
      awayTeam: m.awayTeam?.name || 'Away',
      league: m.league?.name,
      sport: m.sport?.name,
      kickoff: m.kickoffTime instanceof Date ? m.kickoffTime.toISOString() : String(m.kickoffTime),
      leagueTier: m.league?.tier ?? 3,
      popularity: (m.league?.tier ?? 3) <= 2 ? 1.2 : 0.8,
      markets: m.markets?.map(mk => ({
        key: mk.key,
        name: mk.name,
        selections: (mk.outcomes || []).map(o => ({ label: o.name, odds: o.price })),
      })),
    });
    if (listTipsForTipster(tipsterId, 1).length >= target) break;
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
  const { id } = await context.params;

  // Resolve tipster: check fake catalogue first (id 1000+), then fall back to real DB users.
  const fake = getFakeTipsterById(id) || getFakeTipsterByUsername(id) || getFakeTipsterBySlug(id);
  let baseTipster: TipsterShape;
  let isRealUser = false;
  if (fake) {
    baseTipster = fakeToShape(fake);
  } else {
    const realUser = await getRealTipsterFromDb(id);
    if (!realUser) {
      return NextResponse.json({ error: 'Tipster not found' }, { status: 404 });
    }
    baseTipster = realUser;
    isRealUser = true;
  }

  // Compute rank based on sorted position among all fake tipsters by win rate.
  // Real DB users may already have a rank from tipster_profiles; only compute
  // a fallback rank if missing (rank = 0) AND the tipster is a fake entry.
  if (baseTipster.rank === 0 && !isRealUser) {
    const allFake = getFakeTipsters()
      .slice()
      .sort((a, b) => b.winRate - a.winRate || b.roi - a.roi || b.totalTips - a.totalTips);
    const pos = allFake.findIndex(t => t.id === baseTipster.id);
    baseTipster.rank = pos >= 0 ? pos + 1 : allFake.length;
  }

  const tipsterId = baseTipster.id;
  const [realFollowers, realFollowing] = await Promise.all([
    listFollowersOfTipster(tipsterId).catch(() => null),
    listFollowedTipsters(tipsterId).catch(() => null),
  ]);

  const tipster = {
    ...baseTipster,
    followers: (realFollowers?.length ?? 0) + baseTipster.followers,
    following: (realFollowing?.length ?? 0) + baseTipster.following,
    realFollowers: realFollowers?.length ?? 0,
    realFollowing: realFollowing?.length ?? 0,
  };

  const { searchParams } = new URL(request.url);
  const includeTips = searchParams.get('includeTips') !== 'false';
  const includeStats = searchParams.get('includeStats') !== 'false';

  const response: {
    tipster: typeof tipster;
    recentTips?: ReturnType<typeof autoTipToRecent>[];
    monthlyStats?: ReturnType<typeof generateMonthlyStats>;
    sportBreakdown?: ReturnType<typeof generateSportBreakdown>;
    marketBreakdown?: ReturnType<typeof generateMarketBreakdown>;
    roiSparkline?: ReturnType<typeof generateRoiSparkline>;
  } = { tipster };

  if (includeTips) {
    // Fetch matches ONCE and share the result for both bootstrap + matchIndex.
    // Use a 7-second timeout so the profile API never hangs if external APIs are slow.
    let allMatchesCached: UnifiedMatch[] = [];
    try {
      const matchPromise = getAllMatches();
      const timeoutPromise = new Promise<UnifiedMatch[]>((_, reject) =>
        setTimeout(() => reject(new Error('getAllMatches timeout')), 7000),
      );
      allMatchesCached = await Promise.race([matchPromise, timeoutPromise]);
    } catch {
      // falls back to empty — tips will still show with synthetic scores
    }

    // Build a FULL real-results map including HT scores, corners, and cards.
    // This is critical so HT-Result, corners, and card markets settle correctly.
    const realResults = new Map<string, { homeScore: number; awayScore: number } & TipMatchData>();
    for (const m of allMatchesCached) {
      if (m.status === 'finished' && m.homeScore != null && m.awayScore != null) {
        realResults.set(String(m.id), {
          homeScore: Number(m.homeScore),
          awayScore: Number(m.awayScore),
          htHomeScore: m.htHomeScore ?? null,
          htAwayScore: m.htAwayScore ?? null,
          corners: m.sportSpecificData?.corners,
          yellowCards: m.sportSpecificData?.yellowCards,
          redCards: m.sportSpecificData?.redCards,
        });
      }
    }

    // Make sure this tipster has tips on real upcoming matches and any
    // tip whose kickoff has passed gets settled — including correcting any
    // previously wrong outcomes (probabilistic or logic errors).
    bootstrapTipsterTipsFromMatches(tipsterId, allMatchesCached);
    // bulkResettleWithRealData corrects ALL tips (pending, prob-settled, wrong-outcome)
    // settleStaleAutoTips handles remaining pending tips without real data
    bulkResettleWithRealData(realResults);
    settleStaleAutoTips(undefined, realResults);

    // Build a matchId → real match index so finished tips can carry the
    // actual score-line into the profile UI.
    const matchIndex = new Map(allMatchesCached.map(m => [String(m.id), m]));

    const tips = listTipsForTipster(tipsterId, 50).map(t =>
      autoTipToRecent(t, matchIndex.get(String(t.matchId))),
    );
    response.recentTips = tips;
  }

  // Always layer in REAL stats from the settled tip ledger — even when tips
  // are not returned (e.g. SEO metadata fetch with includeTips=false).
  // This ensures the SEO title/description always reflects the correct tip count.
  {
    const real = computeRealTipsterStats(tipsterId);
    const realRoi = computeRealRoi(tipsterId);
    const realStreak = computeRealStreak(tipsterId);
    const hasSettled = real.won + real.lost >= 1;
    response.tipster = {
      ...response.tipster,
      roi: realRoi,
      streak: realStreak,
      performanceVerified: real.won + real.lost >= 10,
      ...(hasSettled && {
        winRate: real.winRate,
        wonTips: real.won,
        lostTips: real.lost,
        pendingTips: real.pending,
        // DO NOT override totalTips — keep the catalog/DB value so it matches
        // the tipster list, SEO title, and tip cards everywhere.
      }),
    };
  }

  if (includeStats) {
    response.monthlyStats = generateMonthlyStats(tipster);
    response.sportBreakdown = generateSportBreakdown(tipster.specialties, tipster.totalTips);
    response.marketBreakdown = generateMarketBreakdown(tipsterId, tipster.winRate);
    response.roiSparkline = generateRoiSparkline(tipster.id, tipster.roi);
  }

  return NextResponse.json(response);
  } catch (err) {
    console.error('[tipsters/[id]] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
