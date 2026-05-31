import { NextRequest, NextResponse } from 'next/server';
import {
  listAllAutoTips,
  seedTipsForMatch,
  computeRealTipsterStats,
  getAutoTipsStats,
} from '@/lib/auto-tips-store';
import { getFakeTipsterById, getFakeTipsters } from '@/lib/fake-tipsters';
import { getAllMatches } from '@/lib/api/unified-sports-api';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface DbTipster {
  user_id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country_code: string | null;
  win_rate: number | null;
  roi: number | null;
  total_tips: number | null;
  won_tips: number | null;
  lost_tips: number | null;
  pending_tips: number | null;
  is_pro: number | null;
  is_verified: number | null;
  subscription_price: number | null;
}

interface NormalisedTipster {
  id: number;
  displayName: string;
  username: string;
  avatar: string | null;
  countryCode: string | null;
  winRate: number;
  roi: number;
  totalTips: number;
  isPro: boolean;
  isVerified: boolean;
  isReal: boolean;
}

// Cache real tipsters in memory for 5 minutes to avoid hammering the DB on every request
const g = globalThis as {
  __realTipstersCache?: { data: NormalisedTipster[]; ts: number };
};

async function getRealTipsters(): Promise<NormalisedTipster[]> {
  const CACHE_MS = 5 * 60 * 1000;
  if (g.__realTipstersCache && Date.now() - g.__realTipstersCache.ts < CACHE_MS) {
    return g.__realTipstersCache.data;
  }

  try {
    const result = await query<DbTipster>(
      `SELECT u.id AS user_id, u.username, u.display_name, u.avatar_url, u.country_code,
              u.is_verified,
              t.win_rate, t.roi, t.total_tips, t.won_tips, t.lost_tips, t.pending_tips,
              t.is_pro, t.subscription_price
         FROM users u
         LEFT JOIN tipster_profiles t ON t.user_id = u.id
        WHERE u.role IN ('tipster','admin')
        ORDER BY t.win_rate DESC
        LIMIT 200`,
      [],
    );
    const rows = (result as unknown as { rows?: DbTipster[] }).rows ?? (result as unknown as DbTipster[]);
    if (!rows || rows.length === 0) return [];

    const normalised: NormalisedTipster[] = rows.map(r => ({
      id: r.user_id,
      displayName: r.display_name || r.username,
      username: r.username,
      avatar: r.avatar_url,
      countryCode: r.country_code,
      winRate: Number(r.win_rate ?? 0),
      roi: Number(r.roi ?? 0),
      totalTips: Number(r.total_tips ?? 0),
      isPro: !!r.is_pro,
      isVerified: !!r.is_verified,
      isReal: true,
    }));

    g.__realTipstersCache = { data: normalised, ts: Date.now() };
    return normalised;
  } catch {
    return [];
  }
}

// Also fetch real tips from the DB (submitted by real tipsters)
interface DbTip {
  id: number;
  user_id: number;
  match_id: string;
  selection: string;
  market_id: string | null;
  odds_value: number | null;
  stake: number | null;
  status: string;
  analysis: string | null;
  created_at: Date | string;
  // joined from matches if available
  home_team: string | null;
  away_team: string | null;
  league_name: string | null;
  sport_name: string | null;
  kickoff_time: Date | string | null;
  // joined from users
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country_code: string | null;
  is_verified: number | null;
  // joined from tipster_profiles
  win_rate: number | null;
  roi: number | null;
  total_tips: number | null;
  is_pro: number | null;
}

async function getRealDbTips(day: 'today' | 'tomorrow' | 'upcoming'): Promise<DbTip[]> {
  try {
    let dateFilter = '';
    if (day === 'today') {
      dateFilter = `AND DATE(t.created_at) = CURDATE()`;
    } else if (day === 'tomorrow') {
      dateFilter = `AND DATE(t.created_at) = CURDATE() + INTERVAL 1 DAY`;
    } else {
      dateFilter = `AND t.created_at >= CURDATE() + INTERVAL 2 DAY`;
    }

    const result = await query<DbTip>(
      `SELECT t.id, t.user_id, t.match_id, t.selection, t.market_id,
              t.odds_value, t.stake, t.status, t.analysis, t.created_at,
              NULL AS home_team, NULL AS away_team, NULL AS league_name,
              NULL AS sport_name, NULL AS kickoff_time,
              u.username, u.display_name, u.avatar_url, u.country_code, u.is_verified,
              tp.win_rate, tp.roi, tp.total_tips, tp.is_pro
         FROM tips t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN tipster_profiles tp ON tp.user_id = t.user_id
        WHERE u.role IN ('tipster','admin')
          ${dateFilter}
        ORDER BY t.created_at DESC
        LIMIT 200`,
      [],
    );
    return (result as unknown as { rows?: DbTip[] }).rows ?? (result as unknown as DbTip[]);
  } catch {
    return [];
  }
}

function getDayBucket(kickoff: string | undefined | null): 'today' | 'tomorrow' | 'upcoming' {
  if (!kickoff) return 'today';
  const k = new Date(kickoff);
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
  if (k <= todayEnd) return 'today';
  if (k <= tomorrowEnd) return 'tomorrow';
  return 'upcoming';
}

/** Seed tips for live/upcoming matches when the in-memory store is cold. */
async function ensureSeedIfEmpty(): Promise<void> {
  const stats = getAutoTipsStats();
  if (stats.total > 0) return;

  try {
    const matches = await getAllMatches();
    const now = Date.now();
    const relevant = matches.filter(m => {
      const t = new Date(m.kickoffTime).getTime();
      const isLive = ['live', 'halftime'].includes(m.status);
      const isSoon = m.status === 'scheduled' && t > now - 3 * 60 * 60 * 1000 && t < now + 3 * 24 * 60 * 60 * 1000;
      return isLive || isSoon;
    }).slice(0, 80);

    for (const m of relevant) {
      const markets = (m.markets as Array<{ key?: string; name: string; selections?: Array<{ label: string; odds: number }> }> | undefined)
        ?.filter(mk => mk.selections && mk.selections.length > 0) ?? [];

      seedTipsForMatch({
        matchId: m.id,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        league: m.league.name,
        sport: m.sport.name,
        kickoff: m.kickoffTime instanceof Date ? m.kickoffTime.toISOString() : String(m.kickoffTime),
        leagueTier: m.league.tier ?? 3,
        popularity: (m.league.tier ?? 3) <= 2 ? 1.2 : 0.8,
        markets,
      });
    }
  } catch (e) {
    console.warn('[tips/feed] ensureSeedIfEmpty failed:', e);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const day = (searchParams.get('day') || 'today') as 'today' | 'tomorrow' | 'upcoming';
  const sport = (searchParams.get('sport') || '').toLowerCase();
  const minOdds = parseFloat(searchParams.get('minOdds') || '1');
  const maxOdds = parseFloat(searchParams.get('maxOdds') || '99');

  // Fetch real tipsters from DB in parallel with seeding
  const [realTipsters, dbTips] = await Promise.all([
    getRealTipsters(),
    getRealDbTips(day),
  ]);

  // Build a lookup map: tipster id → normalised tipster
  const realTipsterMap = new Map<number, NormalisedTipster>(realTipsters.map(t => [t.id, t]));

  // Boot the auto-tips store if cold
  await ensureSeedIfEmpty();

  // --- Build real DB tips ---
  const realDbTipsMapped = dbTips.map(tip => {
    const t = realTipsterMap.get(tip.user_id);
    const displayName = tip.display_name || tip.username;
    return {
      id: `db-${tip.id}`,
      matchId: tip.match_id,
      homeTeam: tip.home_team ?? '',
      awayTeam: tip.away_team ?? '',
      league: tip.league_name ?? '',
      sport: tip.sport_name ?? 'Football',
      kickoff: tip.kickoff_time ? new Date(tip.kickoff_time).toISOString() : null,
      prediction: tip.selection,
      market: tip.market_id ?? 'h2h',
      odds: Number(tip.odds_value ?? 1.5),
      confidence: Math.min(95, 50 + (Number(tip.stake ?? 1) - 1) * 10),
      status: tip.status,
      likes: 0,
      comments: 0,
      analysis: tip.analysis ?? '',
      isPremium: false,
      createdAt: new Date(tip.created_at).toISOString(),
      isReal: true,
      tipster: {
        id: tip.user_id,
        displayName,
        username: tip.username,
        avatar: tip.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${tip.username}`,
        countryCode: tip.country_code ?? 'KE',
        winRate: t?.winRate ?? Number(tip.win_rate ?? 0),
        roi: t?.roi ?? Number(tip.roi ?? 0),
        totalTips: t?.totalTips ?? Number(tip.total_tips ?? 0),
        profit: ((t?.roi ?? Number(tip.roi ?? 0)) * 10).toFixed(1),
        isPro: !!tip.is_pro,
        isVerified: !!tip.is_verified,
        isReal: true,
      },
    };
  });

  // --- Build auto-tips (from real match data, attributed to real or fake tipsters) ---
  const allAutoTips = listAllAutoTips(3000);

  const today_count = allAutoTips.filter(t => getDayBucket(t.kickoff) === 'today').length + (day === 'today' ? realDbTipsMapped.length : 0);
  const tomorrow_count = allAutoTips.filter(t => getDayBucket(t.kickoff) === 'tomorrow').length;
  const upcoming_count = allAutoTips.filter(t => getDayBucket(t.kickoff) === 'upcoming').length;

  let filteredAuto = allAutoTips.filter(t => getDayBucket(t.kickoff) === day);
  if (sport) filteredAuto = filteredAuto.filter(t => t.sport?.toLowerCase() === sport);
  filteredAuto = filteredAuto.filter(t => t.odds >= minOdds && (maxOdds >= 99 || t.odds <= maxOdds));
  filteredAuto.sort((a, b) => b.confidence - a.confidence);

  const autoTipsMapped = filteredAuto.slice(0, 100).map(tip => {
    // Prefer a real tipster if one exists with this ID; fall back to fake
    const realTipster = realTipsterMap.get(Number(tip.tipsterId));
    const fakeTipster = realTipster ? null : getFakeTipsterById(tip.tipsterId);
    if (!realTipster && !fakeTipster) return null;

    const realStats = computeRealTipsterStats(tip.tipsterId);
    const tipsterData = realTipster
      ? {
          id: realTipster.id,
          displayName: realTipster.displayName,
          username: realTipster.username,
          avatar: realTipster.avatar ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${realTipster.username}`,
          countryCode: realTipster.countryCode ?? 'KE',
          winRate: realStats?.winRate ?? realTipster.winRate,
          roi: realStats?.roi ?? realTipster.roi,
          totalTips: realStats?.total ?? realTipster.totalTips,
          profit: realStats
            ? (realStats.won * 0.9 - realStats.lost).toFixed(1)
            : (realTipster.roi * 10).toFixed(1),
          isPro: realTipster.isPro,
          isVerified: realTipster.isVerified,
          isReal: true,
        }
      : {
          id: fakeTipster!.id,
          displayName: fakeTipster!.displayName,
          username: fakeTipster!.username,
          avatar: fakeTipster!.avatar,
          countryCode: fakeTipster!.countryCode,
          winRate: realStats?.winRate ?? fakeTipster!.winRate,
          roi: realStats?.roi ?? fakeTipster!.roi,
          totalTips: realStats?.total ?? fakeTipster!.totalTips,
          profit: realStats
            ? (realStats.won * 0.9 - realStats.lost).toFixed(1)
            : (fakeTipster!.roi * 10).toFixed(1),
          isPro: fakeTipster!.isPro,
          isVerified: fakeTipster!.isVerified,
          isReal: false,
        };

    return {
      id: tip.id,
      matchId: tip.matchId,
      homeTeam: tip.homeTeam,
      awayTeam: tip.awayTeam,
      league: tip.league ?? '',
      sport: tip.sport ?? 'Football',
      kickoff: tip.kickoff ?? null,
      prediction: tip.prediction,
      market: tip.market,
      odds: tip.odds,
      confidence: tip.confidence,
      status: tip.status,
      likes: tip.likes,
      comments: tip.comments,
      analysis: tip.analysis,
      isPremium: tip.isPremium,
      createdAt: tip.createdAt,
      isReal: !!realTipster,
      tipster: tipsterData,
    };
  }).filter(Boolean);

  // Merge: real DB tips first (they're most authentic), then auto tips
  const tips = [...realDbTipsMapped, ...autoTipsMapped];

  const bestTip = tips.find(t => t!.status === 'pending') ?? tips[0] ?? null;

  // Top tipsters: prefer real DB tipsters, fall back to fake
  let topTipsters: {
    id: number; displayName: string; username: string; avatar: string | null;
    countryCode: string | null; winRate: number; totalTips: number; roi: number;
    profit: string; isPro: boolean; isVerified: boolean; rank: number; isReal: boolean;
  }[] = [];

  if (realTipsters.length > 0) {
    topTipsters = realTipsters
      .map(t => {
        const s = computeRealTipsterStats(t.id);
        return {
          id: t.id,
          displayName: t.displayName,
          username: t.username,
          avatar: t.avatar,
          countryCode: t.countryCode,
          winRate: s?.winRate ?? t.winRate,
          totalTips: s?.total ?? t.totalTips,
          roi: s?.roi ?? t.roi,
          profit: s ? ((s.won * 0.9 - s.lost) * 10).toFixed(0) : (t.roi * 100).toFixed(0),
          isPro: t.isPro,
          isVerified: t.isVerified,
          isReal: true,
        };
      })
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 5)
      .map((t, i) => ({ ...t, rank: i + 1 }));
  } else {
    topTipsters = getFakeTipsters()
      .map(t => {
        const s = computeRealTipsterStats(t.id);
        return {
          id: t.id,
          displayName: t.displayName,
          username: t.username,
          avatar: t.avatar,
          countryCode: t.countryCode,
          winRate: s?.winRate ?? t.winRate,
          totalTips: s?.total ?? t.totalTips,
          roi: s?.roi ?? t.roi,
          profit: s ? ((s.won * 0.9 - s.lost) * 10).toFixed(0) : (t.roi * 100).toFixed(0),
          isPro: t.isPro,
          isVerified: t.isVerified,
          isReal: false,
        };
      })
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 5)
      .map((t, i) => ({ ...t, rank: i + 1 }));
  }

  const sports = Array.from(new Set(allAutoTips.map(t => t.sport).filter(Boolean))) as string[];

  return NextResponse.json({
    tips,
    bestTip,
    topTipsters,
    sports,
    counts: { today: today_count, tomorrow: tomorrow_count, upcoming: upcoming_count },
  });
}
