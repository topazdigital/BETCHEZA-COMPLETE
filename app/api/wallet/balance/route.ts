import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getBalance } from '@/lib/wallet-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const balance = getBalance(user.userId, 'KES');
  return NextResponse.json({ balance, currency: 'KES', userId: user.userId });
}
