import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUnreadCount } from '@/lib/admin-events-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ count: 0 });
  }
  return NextResponse.json({ count: getUnreadCount() });
}
