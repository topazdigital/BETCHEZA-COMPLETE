import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin-auth';
import { listEmailSubscribers } from '@/lib/notification-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const subs = await listEmailSubscribers();
  return NextResponse.json({ subscribers: subs });
}
