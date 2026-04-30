import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import {
  applicationStats,
  listApplications,
} from '@/lib/tipster-applications-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET — admin queue of all applications. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || !hasPermission(me.role, 'admin.users.read')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const [applications, stats] = await Promise.all([
    listApplications(),
    applicationStats(),
  ]);
  return NextResponse.json({ applications, stats });
}
