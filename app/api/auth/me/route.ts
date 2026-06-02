import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { getBalance } from '@/lib/wallet-store';
import { isVerified } from '@/lib/email-verification-store';
import { getProfile } from '@/lib/user-profile-store';

export const dynamic = 'force-dynamic';

interface DbUser {
  id: number;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: 'user' | 'tipster' | 'admin';
  balance: number;
  is_verified: boolean;
}

async function findUserById(id: number): Promise<DbUser | null> {
  return queryOne<DbUser>(
    'SELECT id, email, username, display_name, avatar_url, role, balance, is_verified FROM users WHERE id = ? LIMIT 1',
    [id]
  );
}

export async function GET() {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Try DB lookup — if DB is unavailable, fall back to JWT payload so the
    // user stays logged in during DB outages or server restarts.
    let user: DbUser | null = null;
    try {
      user = await findUserById(authUser.userId);
    } catch {
      // DB unreachable — serve session from JWT payload
    }

    if (!user) {
      // Check if we have enough from the JWT to keep the session alive
      if (!authUser.userId || !authUser.email) {
        return NextResponse.json({ user: null }, { status: 401 });
      }
      // Return minimal user from JWT — keeps session alive even when DB is down
      return NextResponse.json({
        user: {
          id: authUser.userId,
          email: authUser.email,
          username: authUser.email.split('@')[0],
          displayName: authUser.email.split('@')[0],
          avatarUrl: null,
          role: authUser.role ?? 'user',
          balance: 0,
          isEmailVerified: false,
          _fromJwtFallback: true,
        },
      });
    }

    const walletBalance = getBalance(user.id, 'KES');
    const balance = walletBalance > 0 ? walletBalance : user.balance;

    // Overlay user_profiles overrides (avatar, displayName, etc.)
    const profile = await getProfile(user.id).catch(() => null);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: profile?.username || user.username,
        displayName: profile?.displayName || user.display_name,
        avatarUrl: profile?.avatarUrl || user.avatar_url,
        role: user.role,
        balance,
        isEmailVerified: !!user.is_verified || isVerified(user.id),
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
