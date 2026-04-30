import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { mockUsers } from '@/lib/mock-data';
import { getBalance } from '@/lib/wallet-store';
import { isVerified } from '@/lib/email-verification-store';

export async function GET() {
  try {
    const authUser = await getCurrentUser();
    
    if (!authUser) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // In development/preview, use mock data
    const user = mockUsers.find((u) => u.id === authUser.userId);
    
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Wallet balance is the source of truth — fall back to the seeded
    // mock balance only if no wallet ledger exists for this user yet.
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
