import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getWallet } from '@/lib/wallet-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  }
  const w = getWallet(user.userId);
  return NextResponse.json({
    success: true,
    balances: w.balances,
    transactions: w.txns.slice(0, 50),
  });
}
