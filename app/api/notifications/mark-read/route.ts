import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { markNotificationsRead } from '@/lib/notification-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  let body: { ids?: number[]; all?: boolean } = {};
  try { body = await req.json(); } catch {}
  const ids = Array.isArray(body.ids) && body.ids.length > 0
    ? body.ids.map(n => Number(n)).filter(n => Number.isFinite(n))
    : undefined;
  const count = await markNotificationsRead(user.userId, ids);
  return NextResponse.json({ success: true, marked: count });
}
