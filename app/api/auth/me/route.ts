import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { mockUsers } from '@/lib/mock-data';
import { queryOne, getPool } from '@/lib/db';
import { getBalance } from '@/lib/wallet-store';
import { isVerified } from '@/lib/email-verification-store';

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
  if (getPool()) {
    try {
      const u = await queryOne<DbUser>(
        'SELECT id, email, username, display_name, avatar_url, role, balance, is_verified FROM users WHERE id = ? LIMIT 1',
        [id]
      );
      if (u) return u;
    } catch (err) {
      console.warn('[auth/me] DB lookup failed, falling back to mock:', err);
    }
  }
  const mock = mockUsers.find((u) => u.id === id);
  if (!mock) return null;
  return {
    id: mock.id,
    email: mock.email,
    username: mock.username,
    display_name: mock.display_name,
    avatar_url: mock.avatar_url,
    role: mock.role,
    balance: mock.balance,
    is_verified: !!mock.is_verified,
  };
}

export async function GET() {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await findUserById(authUser.userId);

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const walletBalance = getBalance(user.id, 'KES');
    const balance = walletBalance > 0 ? walletBalance : user.balance;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        role: user.role,
        balance,
        isEmailVerified: !!user.is_verified || isVerified(user.id),
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
