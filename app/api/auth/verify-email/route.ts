import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { verifyByCode, verifyByToken } from '@/lib/email-verification-store';
import { mockUsers } from '@/lib/mock-data';
import { onReferralVerified } from '@/lib/referral-store';
import { execute, getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function markDbVerified(userId: number) {
  if (!getPool()) return;
  try {
    await execute('UPDATE users SET is_verified = 1 WHERE id = ?', [userId]);
  } catch (e) {
    console.warn('[verify-email] DB update failed:', e);
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
    const u = mockUsers.find(x => x.id === result.userId);
    if (u) u.is_verified = true;
    await markDbVerified(result.userId);
    // Trigger referral bonus if applicable
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
  const u = mockUsers.find(x => x.id === auth.userId);
  if (u) u.is_verified = true;
  await markDbVerified(auth.userId);
  // Trigger referral bonus if applicable
  onReferralVerified(auth.userId).catch(() => {});
  return NextResponse.json({ success: true, userId: auth.userId });
}
