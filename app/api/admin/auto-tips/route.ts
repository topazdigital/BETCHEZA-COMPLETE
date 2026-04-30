import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listAllAutoTips, getAutoTipsStats } from '@/lib/auto-tips-store';
import { listActivity } from '@/lib/auto-tip-activity';
import { getFakeTipsters } from '@/lib/fake-tipsters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const tipsters = getFakeTipsters().map((t) => ({
    id: t.id,
    displayName: t.displayName,
    username: t.username,
    avatar: t.avatar ?? null,
    winRate: t.winRate,
    isPro: !!t.isPro,
    specialties: t.specialties,
  }));
  return NextResponse.json({
    stats: getAutoTipsStats(),
    recent: listAllAutoTips(50),
    activity: listActivity(100),
    tipsters,
  });
}
