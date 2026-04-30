import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { getFakeTipsters, regenerateFakeTipsters } from '@/lib/fake-tipsters';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Admin-only tipsters listing. Returns BOTH real tipsters (from the DB, when
 * available) and the seeded fake ones — each row includes `isFake` so the
 * admin UI can show a clear badge. Public consumers never see this flag.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, 'admin.tipsters.read')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter'); // 'real' | 'fake' | null
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

  // Real tipsters would come from DB here. We keep the array empty when no
  // DB connection is available so the admin can clearly see what's seed-data
  // vs real signups.
  const real: typeof fake = [];

  let combined = [...real, ...fake];
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

/**
 * POST { action: 'regenerate', count?, seed? }
 * Wipes the in-memory fake-tipster catalogue and rebuilds it.
 */
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
