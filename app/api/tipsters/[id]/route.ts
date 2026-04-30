import { NextRequest, NextResponse } from 'next/server';
import { listFollowersOfTipster, listFollowedTipsters } from '@/lib/follows-store';
import { getFakeTipsterById, getFakeTipsterByUsername, getFakeTipsterBySlug, type FakeTipster } from '@/lib/fake-tipsters';
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

function generateSportBreakdown(specialties: string[]) {
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
  const out: { sport: string; percentage: number; tips: number }[] = [];
  arr.forEach((sport, i) => {
    const last = i === arr.length - 1;
    const pct = last ? remaining : Math.max(8, Math.floor(remaining / (arr.length - i)));
    remaining -= pct;
    out.push({ sport: sport.charAt(0).toUpperCase() + sport.slice(1), percentage: pct, tips: Math.floor(pct * 3.5) });
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
// We pull the cached upcoming match list and seed any matches the catalogue
// would have this tipster picking. Caller already guards for fake-only.
async function bootstrapTipsterTipsFromMatches(tipsterId: number, target = 12): Promise<void> {
  const existing = listTipsForTipster(tipsterId, 1);
  if (existing.length >= target) return;
  let matches;
  try {
    matches = await getAllMatches();
  } catch {
    return;
  }
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
    roiSparkline?: ReturnType<typeof generateRoiSparkline>;
  } = { tipster };

  if (includeTips) {
    // Make sure this tipster has tips on real upcoming matches and any
    // tip whose kickoff has passed gets a deterministic settled status.
    await bootstrapTipsterTipsFromMatches(tipsterId).catch(() => null);
    settleStaleAutoTips();

    // Build a matchId → real match index so finished tips can carry the
    // actual score-line into the profile UI.
    let matchIndex = new Map<string, UnifiedMatch>();
    try {
      const all = await getAllMatches();
      matchIndex = new Map(all.map(m => [String(m.id), m]));
    } catch {
      // ignore — falls back to deterministic synthetic scores
    }

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
    response.sportBreakdown = generateSportBreakdown(tipster.specialties);
    response.roiSparkline = generateRoiSparkline(tipster.id, tipster.roi);
  }

  return NextResponse.json(response);
}
