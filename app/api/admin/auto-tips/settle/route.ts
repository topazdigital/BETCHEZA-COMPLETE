import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin-auth';
import { settleStaleAutoTips, getAutoTipsStats } from '@/lib/auto-tips-store';
import { pushActivity } from '@/lib/auto-tip-activity';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const before = getAutoTipsStats();
  settleStaleAutoTips();
  const after = getAutoTipsStats();
  const settled = before.pending - after.pending;
  pushActivity(
    settled > 0 ? 'success' : 'info',
    settled > 0
      ? `Settled ${settled} stale tip${settled === 1 ? '' : 's'} (Won: ${after.won - before.won}, Lost: ${after.lost - before.lost}).`
      : 'No stale tips to settle right now.',
  );
  return NextResponse.json({ before, after, settled });
}
