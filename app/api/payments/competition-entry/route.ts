import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { debit, getBalance } from '@/lib/wallet-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PaymentBody {
  method: 'mpesa' | 'card' | 'wallet';
  amount: number;
  currency: string;
  competitionName: string;
  competitionSlug?: string;
  phone?: string;
  cardLast4?: string;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  }

  let body: PaymentBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.method || !body.amount || body.amount <= 0) {
    return NextResponse.json({ success: false, error: 'Method and a positive amount are required.' }, { status: 400 });
  }

  // Wallet method must actually have funds — this used to silently
  // succeed and let users join paid competitions with a zero balance.
  if (body.method === 'wallet') {
    const result = debit(user.userId, body.amount, {
      type: 'competition_entry',
      currency: body.currency,
      method: 'wallet',
      description: `Entry fee · ${body.competitionName}`,
      meta: { competitionSlug: body.competitionSlug },
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          balance: result.balance,
          currency: body.currency,
        },
        { status: 402 },
      );
    }
    return NextResponse.json({
      success: true,
      reference: result.txn.id,
      method: 'wallet',
      amount: body.amount,
      currency: body.currency,
      newBalance: result.newBalance,
      competitionName: body.competitionName,
      paidAt: result.txn.createdAt,
    });
  }

  // M-Pesa / card path: in production this would initiate STK push or
  // a card PaymentIntent. For now we record the intent and return a
  // reference; once a webhook confirms payment we'd credit the wallet
  // (or settle the entry directly).
  const reference = `${body.method.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  return NextResponse.json({
    success: true,
    reference,
    method: body.method,
    amount: body.amount,
    currency: body.currency,
    competitionName: body.competitionName,
    paidAt: new Date().toISOString(),
  });
}

// Small helper for the modal — returns the user's wallet balance so the UI
// can show "Insufficient — top up first" before they even click Pay.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ balance: 0 }, { status: 401 });
  return NextResponse.json({ balance: getBalance(user.userId, 'KES'), currency: 'KES' });
}
