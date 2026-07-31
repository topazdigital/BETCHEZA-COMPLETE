import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getFakeTipsters, type FakeTipster } from '@/lib/fake-tipsters';
import { getCurrentUser } from '@/lib/auth';
import { getFollowedTipsters } from '@/lib/follows-store';
import { computeRealTipsterStats, computeRealRoi, computeRealStreak } from '@/lib/auto-tips-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function fakeAsPublic(t: FakeTipster) {
  return {
    id: t.id, username: t.username, displayName: t.displayName, avatar: t.avatar,
    bio: t.bio, winRate: t.winRate, roi: t.roi, totalTips: t.totalTips,
    wonTips: t.wonTips, lostTips: t.lostTips, pendingTips: t.pendingTips,
    avgOdds: t.avgOdds, streak: t.streak, rank: 0, followers: t.followersCount,
    isPro: t.isPro, subscriptionPrice: t.subscriptionPrice, verified: t.isVerified,
    countryCode: t.countryCode, joinedAt: t.joinedAt,
    isOnline: t.isOnline ?? false, lastSeen: t.lastSeen ?? null,
    isFake: true,
  };
}

interface DbTipster {
  user_id: number; username: string; display_name: string | null;
  avatar_url: string | null; bio: string | null; country_code: string | null;
  win_rate: number | null; roi: number | null; total_tips: number | null;
  won_tips: number | null; lost_tips: number | null; pending_tips: number | null;
  avg_odds: number | null; streak: number | null; rank: number | null;
  followers_count: number | null; is_pro: number | null;
  subscription_price: number | null; is_verified: number | null;
  created_at: Date | string | null;
}

interface PublicTipster {
  id: number; username: string; displayName: string; avatar: string | null;
  bio: string | null; winRate: number; roi: number; totalTips: number;
  wonTips: number; lostTips: number; pendingTips: number; avgOdds: number;
  streak: number; rank: number; followers: number; isPro: boolean;
  subscriptionPrice: number | null; verified: boolean; countryCode: string | null;
  joinedAt: string | null; performanceVerified: boolean;
  activeToday?: boolean; isFake?: boolean;
}

function shape(row: DbTipster): PublicTipster {
  return {
    id: row.user_id, username: row.username,
    displayName: row.display_name || row.username, avatar: row.avatar_url,
    bio: row.bio, winRate: Number(row.win_rate ?? 0), roi: Number(row.roi ?? 0),
    totalTips: Number(row.total_tips ?? 0), wonTips: Number(row.won_tips ?? 0),
    lostTips: Number(row.lost_tips ?? 0), pendingTips: Number(row.pending_tips ?? 0),
    avgOdds: Number(row.avg_odds ?? 0), streak: Number(row.streak ?? 0),
    rank: Number(row.rank ?? 0), followers: Number(row.followers_count ?? 0),
    isPro: !!row.is_pro, subscriptionPrice: row.subscription_price !== null ? Number(row.subscription_price) : null,
    verified: !!row.is_verified, countryCode: row.country_code,
    joinedAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    performanceVerified: false,
    isFake: false,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get('search') || '').trim();
  const filter = searchParams.get('filter');
  const sortBy = searchParams.get('sortBy') || 'rank';
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

  // ── 1. Fetch real tipsters from DB ──────────────────────────────────
  const where: string[] = ["u.role = 'tipster'"];
  const params: unknown[] = [];

  if (search) {
    where.push('(u.username LIKE ? OR u.display_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (filter === 'pro') where.push('t.is_pro = 1');
  else if (filter === 'free') where.push('(t.is_pro = 0 OR t.is_pro IS NULL)');
  else if (filter === 'verified') where.push('u.is_verified = 1');

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  let followedIds: number[] = [];
  try {
    const user = await getCurrentUser();
    if (user) followedIds = await getFollowedTipsters(user.userId);
  } catch {}

  let realRows: DbTipster[] = [];
  try {
    const list = await query<DbTipster>(
      `SELECT u.id AS user_id, u.username, u.display_name, u.avatar_url, u.bio,
              u.country_code, u.is_verified, u.created_at,
              t.win_rate, t.roi, t.total_tips, t.won_tips, t.lost_tips, t.pending_tips,
              t.avg_odds, t.streak, t.rank_position AS rank, t.followers_count, t.is_pro, t.subscription_price
         FROM users u
         LEFT JOIN tipster_profiles t ON t.user_id = u.id
         ${whereClause}
         ORDER BY COALESCE(t.rank_position, 999999) ASC
         LIMIT 500`,
      params,
    );
    realRows = list.rows;
  } catch {
    realRows = [];
  }

  // Which real tipsters posted tips in the last 24 hours?
  const activeTodayIds = new Set<number>();
  try {
    const activeRows = await query<{ user_id: number }>(
      `SELECT DISTINCT user_id FROM tips WHERE created_at >= NOW() - INTERVAL 24 HOUR`,
      [],
    );
    for (const r of activeRows.rows) activeTodayIds.add(Number(r.user_id));
  } catch { /* tips table may not exist */ }

  // Shape real tipsters — show all approved tipsters (role='tipster') even if
  // they haven't posted tips yet, so newly-approved tipsters appear immediately
  const realShaped = realRows
    .map(row => ({ ...shape(row), activeToday: activeTodayIds.has(row.user_id) }));

  // Collect real tipster IDs so we don't duplicate them with fake ones
  const realIds = new Set(realShaped.map(t => t.id));

  // ── 2. Always include fake tipsters alongside real ones ──────────────
  let fakeTipsters = getFakeTipsters()
    .filter(f => !realIds.has(f.id)) // never collide with a real user id
    .map(f => {
      const pub = fakeAsPublic(f);
      // Layer in real auto-tip stats if they exist
      const real = computeRealTipsterStats(f.id);
      const hasSettled = real.won + real.lost >= 1;
      const hasTips = real.won + real.lost + real.pending >= 1;
      return {
        ...pub,
        roi: computeRealRoi(f.id),
        streak: computeRealStreak(f.id),
        performanceVerified: real.won + real.lost >= 10,
        ...(hasSettled && {
          winRate: real.winRate,
          wonTips: real.won,
          lostTips: real.lost,
          pendingTips: real.pending,
        }),
        ...(!hasSettled && hasTips && {
          winRate: 0,
          pendingTips: real.pending,
        }),
      };
    });

  // Apply search/filter to fake tipsters
  if (search) {
    const q = search.toLowerCase();
    fakeTipsters = fakeTipsters.filter(t =>
      t.username.toLowerCase().includes(q) || (t.displayName || '').toLowerCase().includes(q)
    );
  }
  if (filter === 'pro') fakeTipsters = fakeTipsters.filter(t => t.isPro);
  else if (filter === 'free') fakeTipsters = fakeTipsters.filter(t => !t.isPro);
  else if (filter === 'verified') fakeTipsters = fakeTipsters.filter(t => t.verified);

  // ── 3. Merge real and fake tipsters into one pool — ranked purely by performance ──
  let combined: PublicTipster[] = [...realShaped, ...fakeTipsters];

  // ── 4. Sort the combined pool ─────────────────────────────────────────
  const sortFn = (a: PublicTipster, b: PublicTipster): number => {
    // Followed tipsters always bubble up for the current user
    const aFollowed = followedIds.includes(a.id) ? 0 : 1;
    const bFollowed = followedIds.includes(b.id) ? 0 : 1;
    if (aFollowed !== bFollowed) return aFollowed - bFollowed;

    // Tipsters with zero tips always sink to the bottom regardless of real/fake status
    const aNoTips = a.totalTips === 0 ? 1 : 0;
    const bNoTips = b.totalTips === 0 ? 1 : 0;
    if (aNoTips !== bNoTips) return aNoTips - bNoTips;

    switch (sortBy) {
      case 'roi':       return b.roi - a.roi;
      case 'followers': return b.followers - a.followers;
      case 'streak':    return b.streak - a.streak;
      case 'totalTips': return b.totalTips - a.totalTips;
      case 'winRate':
      case 'rank':
      default:          return b.winRate - a.winRate || b.roi - a.roi || b.totalTips - a.totalTips;
    }
  };

  combined.sort(sortFn);

  // ── 5. Assign fresh ranks based on sorted position ────────────────────
  combined = combined.map((t, i) => ({ ...t, rank: i + 1 }));

  const total = combined.length;
  const tipsters = combined.slice(offset, offset + limit);

  const res = NextResponse.json({
    tipsters,
    pagination: { total, limit, offset, hasMore: offset + limit < total },
    stats: {
      totalTipsters: total,
      proTipsters: tipsters.filter((t) => t.isPro).length,
      avgWinRate: tipsters.length > 0
        ? Math.round((tipsters.reduce((s, t) => s + t.winRate, 0) / tipsters.length) * 10) / 10
        : 0,
      totalTips: tipsters.reduce((s, t) => s + t.totalTips, 0),
    },
  });
  res.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
  return res;
}
