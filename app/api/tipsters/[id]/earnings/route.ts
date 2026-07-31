import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getTipsterEarningsSummary, getSubscriberCount } from '@/lib/subscription-store';
import { getBalance } from '@/lib/wallet-store';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tipsterId = Number(id);
  // Only the tipster themselves or an admin can see earnings
  if (user.userId !== tipsterId && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [earnings, subscribers, walletBalance] = await Promise.all([
    getTipsterEarningsSummary(tipsterId),
    getSubscriberCount(tipsterId),
    Promise.resolve(getBalance(tipsterId, 'KES')),
  ]);

  return NextResponse.json({
    tipsterId,
    totalSubscribers: subscribers,
    walletBalance,
    monthlyRevenue: earnings.monthlyRevenue,
    allTimeRevenue: earnings.allTimeRevenue,
    currency: earnings.currency,
    shareRate: 0.80,
  });
}
