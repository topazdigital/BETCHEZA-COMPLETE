import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listTxns } from '@/lib/wallet-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  }

  const allTxns = listTxns(user.userId, 200);
  const prizes = allTxns
    .filter((t) => t.type === 'prize_payout' && t.status === 'completed' && t.amount > 0)
    .map((t) => ({
      id: t.id,
      amount: t.amount,
      currency: t.currency,
      createdAt: t.createdAt,
      competitionId: (t.meta?.competitionId as number) ?? null,
      competitionName: (t.meta?.competitionName as string) ?? t.description ?? 'Competition Prize',
      place: (t.meta?.place as string) ?? null,
      rank: (t.meta?.rank as number) ?? null,
      description: t.description ?? null,
    }));

  return NextResponse.json({ success: true, prizes });
}
