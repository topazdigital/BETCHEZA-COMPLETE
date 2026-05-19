import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listAllAutoTips, getAutoTipsStats, settleByKnownResults, addKnownResult } from '@/lib/auto-tips-store';
import { listActivity } from '@/lib/auto-tip-activity';
import { getFakeTipsters } from '@/lib/fake-tipsters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
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

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    action?: string;
    homeTeam?: string;
    awayTeam?: string;
    homeScore?: number;
    awayScore?: number;
  };

  if (body.action === 'settle-known') {
    // Re-settle all probabilistically-settled tips using known results list
    const fixed = settleByKnownResults();
    return NextResponse.json({ success: true, fixed, message: `Re-settled ${fixed} match(es) using known results` });
  }

  if (body.action === 'add-result' && body.homeTeam && body.awayTeam && typeof body.homeScore === 'number' && typeof body.awayScore === 'number') {
    // Add a specific match result and re-settle matching tips
    const fixed = addKnownResult(body.homeTeam, body.awayTeam, body.homeScore, body.awayScore);
    return NextResponse.json({ success: true, fixed, message: `Fixed ${fixed} tip(s) for ${body.homeTeam} vs ${body.awayTeam} (${body.homeScore}-${body.awayScore})` });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
