import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { debit } from '@/lib/wallet-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Body {
  amount: number;
  currency?: string;
  method: 'mpesa' | 'bank' | 'paypal' | 'crypto';
  destination?: string;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ success: false, error: 'Enter a positive amount.' }, { status: 400 });
  }
  if (!body.method) {
    return NextResponse.json({ success: false, error: 'Pick a payout method.' }, { status: 400 });
  }
  if (!body.destination) {
    return NextResponse.json({ success: false, error: 'Enter a payout destination.' }, { status: 400 });
  }

  const result = debit(user.userId, body.amount, {
    type: 'withdraw',
    currency: body.currency || 'KES',
    method: body.method,
    description: `Withdraw via ${body.method.toUpperCase()} · ${body.destination}`,
    meta: { destination: body.destination },
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, balance: result.balance },
      { status: 402 },
    );
  }

  return NextResponse.json({
    success: true,
    transaction: result.txn,
    newBalance: result.newBalance,
  });
}
