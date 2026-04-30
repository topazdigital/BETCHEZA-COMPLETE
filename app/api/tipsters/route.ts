import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getFakeTipsters, type FakeTipster } from '@/lib/fake-tipsters';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Fallback used when the DB has no tipsters yet (or no DB at all). The
// `is_fake` flag is stripped here — public consumers never see it.
function fakeAsPublic(t: FakeTipster) {
  return {
    id: t.id,
    username: t.username,
    displayName: t.displayName,
    avatar: t.avatar,
    bio: t.bio,
    winRate: t.winRate,
    roi: t.roi,
    totalTips: t.totalTips,
    wonTips: t.wonTips,
    lostTips: t.lostTips,
    pendingTips: t.pendingTips,
    avgOdds: t.avgOdds,
    streak: t.streak,
    rank: 0,
    followers: t.followersCount,
    isPro: t.isPro,
    subscriptionPrice: t.subscriptionPrice,
    verified: t.isVerified,
    countryCode: t.countryCode,
    joinedAt: t.joinedAt,
  };
}

interface DbTipster {
  user_id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country_code: string | null;
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
  is_verified: number | null;
  created_at: Date | string | null;
}

interface PublicTipster {
  id: number;
  username: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
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
  isPro: boolean;
  subscriptionPrice: number | null;
  verified: boolean;
  countryCode: string | null;
  joinedAt: string | null;
}

function shape(row: DbTipster): PublicTipster {
  return {
    id: row.user_id,
    username: row.username,
    displayName: row.display_name || row.username,
    avatar: row.avatar_url,
    bio: row.bio,
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
    isPro: !!row.is_pro,
    subscriptionPrice: row.subscription_price !== null ? Number(row.subscription_price) : null,
    verified: !!row.is_verified,
    countryCode: row.country_code,
    joinedAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get('search') || '').trim();
  const filter = searchParams.get('filter');
  const sortBy = searchParams.get('sortBy') || 'rank';
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

  const sortColumn: Record<string, string> = {
    rank: 't.rank ASC',
    winRate: 't.win_rate DESC',
    roi: 't.roi DESC',
    followers: 't.followers_count DESC',
    streak: 't.streak DESC',
    totalTips: 't.total_tips DESC',
  };
  const orderBy = sortColumn[sortBy] || 't.rank ASC';

  const where: string[] = ["u.role IN ('tipster','admin')"];
  const params: unknown[] = [];

  if (search) {
    where.push('(u.username LIKE ? OR u.display_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (filter === 'pro') where.push('t.is_pro = 1');
  else if (filter === 'free') where.push('(t.is_pro = 0 OR t.is_pro IS NULL)');
  else if (filter === 'verified') where.push('u.is_verified = 1');

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  let rows: DbTipster[] = [];
  let total = 0;
  try {
    const list = await query<DbTipster>(
      `SELECT u.id AS user_id, u.username, u.display_name, u.avatar_url, u.bio,
              u.country_code, u.is_verified, u.created_at,
              t.win_rate, t.roi, t.total_tips, t.won_tips, t.lost_tips, t.pending_tips,
              t.avg_odds, t.streak, t.rank, t.followers_count, t.is_pro, t.subscription_price
         FROM users u
         LEFT JOIN tipster_profiles t ON t.user_id = u.id
         ${whereClause}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    rows = (list as unknown as { rows?: DbTipster[] }).rows ?? (list as unknown as DbTipster[]);

    const c = await query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM users u
       LEFT JOIN tipster_profiles t ON t.user_id = u.id ${whereClause}`,
      params,
    );
    const cRows = (c as unknown as { rows?: { n: number }[] }).rows ?? (c as unknown as { n: number }[]);
    total = Number(cRows?.[0]?.n ?? 0);
  } catch {
    rows = [];
    total = 0;
  }

  let tipsters = rows.map(shape);

  // ── Fallback: when the DB returns nothing (no DB connection, fresh
  // install, or empty tipster_profiles table) drop in the catalogue of
  // ~100 fake tipsters so the site never looks empty. The is_fake flag
  // is stripped — admins still see the real/fake split via the admin API.
  if (tipsters.length === 0) {
    let fake = getFakeTipsters().map(fakeAsPublic);

    if (search) {
      const q = search.toLowerCase();
      fake = fake.filter(t =>
        t.username.toLowerCase().includes(q) ||
        (t.displayName || '').toLowerCase().includes(q),
      );
    }
    if (filter === 'pro') fake = fake.filter(t => t.isPro);
    else if (filter === 'free') fake = fake.filter(t => !t.isPro);
    else if (filter === 'verified') fake = fake.filter(t => t.verified);

    fake.sort((a, b) => {
      switch (sortBy) {
        case 'winRate': return b.winRate - a.winRate;
        case 'roi': return b.roi - a.roi;
        case 'followers': return b.followers - a.followers;
        case 'streak': return b.streak - a.streak;
        case 'totalTips': return b.totalTips - a.totalTips;
        default: return b.winRate - a.winRate; // sensible default for "rank"
      }
    });
    fake = fake.map((t, i) => ({ ...t, rank: i + 1 }));

    total = fake.length;
    tipsters = fake.slice(offset, offset + limit);
  }

  return NextResponse.json({
    tipsters,
    pagination: { total, limit, offset, hasMore: offset + limit < total },
    stats: {
      totalTipsters: total,
      proTipsters: tipsters.filter((t) => t.isPro).length,
      avgWinRate:
        tipsters.length > 0
          ? Math.round(
              (tipsters.reduce((s, t) => s + t.winRate, 0) / tipsters.length) * 10,
            ) / 10
          : 0,
      totalTips: tipsters.reduce((s, t) => s + t.totalTips, 0),
    },
  });
}
