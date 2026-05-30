import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listNotifications, getUnreadCount } from '@/lib/notification-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ notifications: [], unreadCount: 0, authenticated: false });
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 30), 100);
  const unreadOnly = req.nextUrl.searchParams.get('unread') === '1';
  const [items, unreadCount] = await Promise.all([
    listNotifications(user.userId, { limit, unreadOnly }),
    getUnreadCount(user.userId),
  ]);
  return NextResponse.json({ notifications: items, unreadCount, authenticated: true });
}
