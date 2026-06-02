import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { verifyByCode, verifyByToken } from '@/lib/email-verification-store';
import { onReferralVerified } from '@/lib/referral-store';
import { execute } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function markDbVerified(userId: number) {
  try {
    await execute('UPDATE users SET is_verified = 1 WHERE id = ?', [userId]);
  } catch (e) {
    console.error('[verify-email] DB update failed:', e);
  }
}

export async function POST(request: Request) {
  let body: { code?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  // 1. Token (URL-link) flow — works without an active session.
  if (body.token) {
    const result = verifyByToken(body.token);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    await markDbVerified(result.userId);
    onReferralVerified(result.userId).catch(() => {});
    return NextResponse.json({ success: true, userId: result.userId });
  }

  // 2. Code flow — requires the current user.
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Sign in first to verify with a code.' }, { status: 401 });
  }
  if (!body.code) {
    return NextResponse.json({ success: false, error: 'Code is required' }, { status: 400 });
  }
  const result = verifyByCode(auth.userId, body.code);
  if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  await markDbVerified(auth.userId);
  onReferralVerified(auth.userId).catch(() => {});
  return NextResponse.json({ success: true, userId: auth.userId });
}
