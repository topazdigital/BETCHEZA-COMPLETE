import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listFollowedTipsters } from '@/lib/follows-store';
import { getFakeTipsters } from '@/lib/fake-tipsters';

export const dynamic = 'force-dynamic';

// Recommended tipsters now come from the real fake-tipster catalogue
// (the same accounts that author the feed posts and competition standings).
// Pick a deterministic top-6 by a composite score so the rail stays stable
// across refreshes but reflects the actual tipster pool.
export async function GET() {
  const user = await getCurrentUser();
  let followed = new Set<number>();
  if (user) {
    try {
      followed = new Set(await listFollowedTipsters(user.userId));
    } catch {}
  }

  const all = getFakeTipsters();
  const ranked = all
    .map(t => ({
      t,
      score: t.winRate * 1.0 + t.roi * 1.6 + t.streak * 1.2 + (t.isVerified ? 5 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ t }) => ({
      id: t.id,
      username: t.username,
      displayName: t.displayName,
      winRate: t.winRate,
      roi: t.roi,
      streak: t.streak,
      followers: t.followersCount,
      isPro: t.isPro,
      specialty: (t.specialties && t.specialties[0]) || 'Multi-sport',
      following: followed.has(t.id),
    }));

  return NextResponse.json({ tipsters: ranked });
}
