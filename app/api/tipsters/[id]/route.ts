import { NextRequest, NextResponse } from 'next/server';
import { listFollowersOfTipster, listFollowedTipsters } from '@/lib/follows-store';
import { getFakeTipsterById, getFakeTipsterByUsername, getFakeTipsterBySlug, getFakeTipsters, type FakeTipster } from '@/lib/fake-tipsters';
import {
  listTipsForTipster,
  seedTipsForMatch,
  settleStaleAutoTips,
  computeRealTipsterStats,
  type GeneratedTip,
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
  };
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
function autoTipToRecent(t: GeneratedTip, realMatch?: UnifiedMatch) {
  let homeScore: number | null = null;
  let awayScore: number | null = null;
  if (realMatch?.homeScore != null && realMatch?.awayScore != null) {
    homeScore = Number(realMatch.homeScore);
    awayScore = Number(realMatch.awayScore);
  } else if (t.status === 'won') {
    homeScore = 2; awayScore = 1;
  } else if (t.status === 'lost') {
    homeScore = 1; awayScore = 2;
  } else if (t.status === 'void') {
    // Void usually means the market resolved to a push (e.g. AH 0 with 1-1)
    // — show the score-line if we have it, otherwise leave null.
    homeScore = realMatch?.homeScore != null ? Number(realMatch.homeScore) : null;
    awayScore = realMatch?.awayScore != null ? Number(realMatch.awayScore) : null;
  }
  return {
    id: t.id,
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
  const { id } = await context.params;

  // Resolve tipster from the fake-tipster catalogue (id 1000+) or @username.
  const fake = getFakeTipsterById(id) || getFakeTipsterByUsername(id) || getFakeTipsterBySlug(id);
  if (!fake) {
    return NextResponse.json({ error: 'Tipster not found' }, { status: 404 });
  }

  const baseTipster = fakeToShape(fake);

  // Compute rank based on sorted position among all fake tipsters by win rate
  if (baseTipster.rank === 0) {
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
    let allMatchesCached: UnifiedMatch[] = [];
    try {
      allMatchesCached = await getAllMatches();
    } catch {
      // falls back to empty — tips will still show with synthetic scores
    }

    // Make sure this tipster has tips on real upcoming matches and any
    // tip whose kickoff has passed gets a deterministic settled status.
    bootstrapTipsterTipsFromMatches(tipsterId, allMatchesCached);
    settleStaleAutoTips();

    // Build a matchId → real match index so finished tips can carry the
    // actual score-line into the profile UI.
    const matchIndex = new Map(allMatchesCached.map(m => [String(m.id), m]));

    const tips = listTipsForTipster(tipsterId, 25).map(t =>
      autoTipToRecent(t, matchIndex.get(String(t.matchId))),
    );
    response.recentTips = tips;

    // Layer in REAL settled stats — once a tipster has actual settled tips on
    // real matches, the profile header should reflect those numbers (not the
    // deterministic catalogue defaults). We keep the catalogue numbers as a
    // floor so brand-new tipsters still look established.
    const real = computeRealTipsterStats(tipsterId);
    if (real.won + real.lost >= 5) {
      response.tipster = {
        ...response.tipster,
        winRate: real.winRate,
        wonTips: real.won,
        lostTips: real.lost,
        pendingTips: real.pending,
        totalTips: real.totalSettled + real.pending,
      };
    }
  }

  if (includeStats) {
    response.monthlyStats = generateMonthlyStats(tipster);
    response.sportBreakdown = generateSportBreakdown(tipster.specialties, tipster.totalTips);
    response.marketBreakdown = generateMarketBreakdown(tipsterId, tipster.winRate);
    response.roiSparkline = generateRoiSparkline(tipster.id, tipster.roi);
  }

  return NextResponse.json(response);
}
