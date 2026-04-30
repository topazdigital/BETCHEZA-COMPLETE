import { NextResponse } from 'next/server';
import { setAuthCookie } from '@/lib/auth';
import { mockUsers } from '@/lib/mock-data';
import { verifyTwoFactor, issueTwoFactorChallenge } from '@/lib/two-factor-store';

export const dynamic = 'force-dynamic';

/**
 * Step 2 of two-factor login: exchange a successful one-time code for a real
 * auth cookie. Also handles `?resend=1` to re-issue a code under the same
 * email (a fresh challenge id is returned in that case).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }
    const { challengeId, code, resend, email } = body as {
      challengeId?: string;
      code?: string;
      resend?: boolean;
      email?: string;
    };

    if (resend && email) {
      const user = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
      if (!user) {
        return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
      }
      const challenge = await issueTwoFactorChallenge({ userId: user.id, email: user.email });
      return NextResponse.json({
        success: true,
        challengeId: challenge.challengeId,
        channel: challenge.channel,
        deliveredTo: challenge.deliveredTo,
        warning: challenge.warning,
      });
    }

    if (!challengeId || !code) {
      return NextResponse.json(
        { success: false, error: 'Missing verification code' },
        { status: 400 }
      );
    }

    const result = verifyTwoFactor(challengeId, code);
    if (!result.ok || !result.userId) {
      return NextResponse.json({ success: false, error: result.error }, { status: 401 });
    }

    const user = mockUsers.find((u) => u.id === result.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    await setAuthCookie({ userId: user.id, email: user.email, role: user.role });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        role: user.role,
        balance: user.balance,
      },
    });
  } catch (error) {
    console.error('[Auth] verify-2fa error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
