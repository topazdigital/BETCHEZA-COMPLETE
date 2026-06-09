import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { getFakeTipsters, regenerateFakeTipsters } from '@/lib/fake-tipsters';
import { query, getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface TipsterRow {
  id: number;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  countryCode: string;
  winRate: number;
  roi: number;
  totalTips: number;
  wonTips: number;
  lostTips: number;
  pendingTips: number;
  avgOdds: number;
  streak: number;
  followers: number;
  isPro: boolean;
  subscriptionPrice: number;
  isVerified: boolean;
  joinedAt: string;
  isFake: boolean;
  status: string;
}

async function getRealTipsters(): Promise<TipsterRow[]> {
  if (!getPool()) return [];
  try {
    const r = await query<{
      id: number; username: string; display_name: string | null; avatar_url: string | null;
      role: string; is_verified: number | null; created_at: string;
      total_tips: number | null; win_rate: number | null; followers_count: number | null;
      bio: string | null; subscription_price: number | null;
    }>(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.role, u.is_verified, u.created_at,
              tp.total_tips, tp.win_rate, tp.followers_count, tp.bio, tp.subscription_price
       FROM users u
       LEFT JOIN tipster_profiles tp ON tp.user_id = u.id
       WHERE u.role = 'tipster'
       ORDER BY COALESCE(tp.followers_count, 0) DESC LIMIT 500`
    );
    return r.rows.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name || u.username,
      avatar: u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`,
      bio: u.bio || '',
      countryCode: 'KE',
      winRate: Number(u.win_rate ?? 0),
      roi: 0,
      totalTips: Number(u.total_tips ?? 0),
      wonTips: 0,
      lostTips: 0,
      pendingTips: 0,
      avgOdds: 0,
      streak: 0,
      followers: Number(u.followers_count ?? 0),
      isPro: false,
      subscriptionPrice: Number(u.subscription_price ?? 0),
      isVerified: !!u.is_verified,
      joinedAt: new Date(u.created_at).toISOString(),
      isFake: false,
      status: 'active',
    }));
  } catch (e) {
    // tipster_profiles might not exist yet — fall back to users with role=tipster
    try {
      const r2 = await query<{
        id: number; username: string; display_name: string | null; avatar_url: string | null;
        is_verified: number | null; created_at: string;
      }>(
        `SELECT id, username, display_name, avatar_url, is_verified, created_at
         FROM users WHERE role = 'tipster' ORDER BY created_at DESC LIMIT 500`
      );
      return r2.rows.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name || u.username,
        avatar: u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`,
        bio: '',
        countryCode: 'KE',
        winRate: 0,
        roi: 0,
        totalTips: 0,
        wonTips: 0,
        lostTips: 0,
        pendingTips: 0,
        avgOdds: 0,
        streak: 0,
        followers: 0,
        isPro: false,
        subscriptionPrice: 0,
        isVerified: !!u.is_verified,
        joinedAt: new Date(u.created_at).toISOString(),
        isFake: false,
        status: 'active',
      }));
    } catch {
      console.warn('[admin/tipsters] DB query failed:', (e as Error).message);
      return [];
    }
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, 'admin.tipsters.read')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter');
  const search = (searchParams.get('search') || '').toLowerCase();

  const fake = getFakeTipsters().map(t => ({
    id: t.id,
    username: t.username,
    displayName: t.displayName,
    avatar: t.avatar,
    bio: t.bio,
    countryCode: t.countryCode,
    winRate: t.winRate,
    roi: t.roi,
    totalTips: t.totalTips,
    wonTips: t.wonTips,
    lostTips: t.lostTips,
    pendingTips: t.pendingTips,
    avgOdds: t.avgOdds,
    streak: t.streak,
    followers: t.followersCount,
    isPro: t.isPro,
    subscriptionPrice: t.subscriptionPrice,
    isVerified: t.isVerified,
    joinedAt: t.joinedAt,
    isFake: true,
    status: 'active',
  }));

  const real = await getRealTipsters();

  let combined: typeof fake = [...real, ...fake];
  if (filter === 'fake') combined = combined.filter(t => t.isFake);
  if (filter === 'real') combined = combined.filter(t => !t.isFake);
  if (search) {
    combined = combined.filter(t =>
      t.username.toLowerCase().includes(search) ||
      (t.displayName || '').toLowerCase().includes(search),
    );
  }

  return NextResponse.json({
    success: true,
    tipsters: combined,
    counts: {
      total: real.length + fake.length,
      real: real.length,
      fake: fake.length,
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, 'admin.tipsters.fake')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const action = body.action as string | undefined;

  if (action === 'regenerate') {
    const count = Math.min(500, Math.max(10, Number(body.count) || 100));
    const seed = body.seed != null ? Number(body.seed) : undefined;
    const list = regenerateFakeTipsters(count, seed);
    return NextResponse.json({ success: true, count: list.length });
  }

  return NextResponse.json({ success: false, error: 'unknown action' }, { status: 400 });
}
