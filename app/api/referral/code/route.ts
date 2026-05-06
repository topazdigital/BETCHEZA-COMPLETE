import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getReferralCode } from '@/lib/referral-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const username = authUser.email.split('@')[0];
    const code = await getReferralCode(authUser.userId, username);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    return NextResponse.json({
      code,
      referralUrl: `${appUrl}/register?ref=${code}`,
    });
  } catch (e) {
    console.error('[referral/code] GET error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
