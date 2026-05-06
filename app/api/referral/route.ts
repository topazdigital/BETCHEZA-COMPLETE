import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getReferralStats, getReferralCode, getReferrerByCode } from '@/lib/referral-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const stats = await getReferralStats(authUser.userId, authUser.email.split('@')[0]);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    return NextResponse.json({
      ...stats,
      referralUrl: `${appUrl}/register?ref=${stats.code}`,
    });
  } catch (e) {
    console.error('[referral] GET error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { code?: string };
    if (!body.code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

    const referrerId = await getReferrerByCode(body.code);
    if (!referrerId) return NextResponse.json({ valid: false, error: 'Invalid referral code' });

    return NextResponse.json({ valid: true, referrerId });
  } catch (e) {
    console.error('[referral] POST error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
