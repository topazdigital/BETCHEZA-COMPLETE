import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listFollowedTipsters } from '@/lib/follows-store';
import { getFakeTipsters } from '@/lib/fake-tipsters';

export const dynamic = 'force-dynamic';

// In-process cache — list is user-aware (followed set) so we cache per userId.
// Anonymous users share the same key. TTL: 5 min.
const CACHE_TTL = 5 * 60_000;
const g = globalThis as { __recTipstersCache?: Map<string, { data: unknown; ts: number }> };
if (!g.__recTipstersCache) g.__recTipstersCache = new Map();

export async function GET() {
  const user = await getCurrentUser();
  const cacheKey = user ? `u:${user.userId}` : 'anon';
  const now = Date.now();
  const cached = g.__recTipstersCache!.get(cacheKey);
  if (cached && now - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

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

  const payload = { tipsters: ranked };
  g.__recTipstersCache!.set(cacheKey, { data: payload, ts: now });
  return NextResponse.json(payload);
}
