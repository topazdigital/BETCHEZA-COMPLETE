import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAdminEvents, markAllRead, clearAdminEvents, getUnreadCount } from '@/lib/admin-events-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const type = url.searchParams.get('type') as Parameters<typeof getAdminEvents>[0]['type'] | undefined;
  const limit = Math.min(200, Number(url.searchParams.get('limit') || 100));
  const events = getAdminEvents({ limit, type: type || undefined });
  const unread = getUnreadCount();
  return NextResponse.json({ events, unread });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { action } = await request.json();
  if (action === 'mark_read') { markAllRead(); return NextResponse.json({ ok: true }); }
  if (action === 'clear') { clearAdminEvents(); return NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
