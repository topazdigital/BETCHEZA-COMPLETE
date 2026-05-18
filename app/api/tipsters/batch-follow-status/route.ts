import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getFollowedTipsters } from '@/lib/follows-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ statuses: {} });

  let ids: number[] = [];
  try {
    const body = await req.json();
    ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
  } catch {
    return NextResponse.json({ statuses: {} });
  }

  if (ids.length === 0) return NextResponse.json({ statuses: {} });

  const followedIds = await getFollowedTipsters(user.userId);
  const followedSet = new Set(followedIds);
  const statuses: Record<number, boolean> = {};
  for (const id of ids) {
    statuses[id] = followedSet.has(id);
  }
  return NextResponse.json({ statuses });
}
