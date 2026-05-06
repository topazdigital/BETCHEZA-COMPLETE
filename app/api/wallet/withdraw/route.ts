import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { debit, credit } from '@/lib/wallet-store';
import { isConfigured, initiateWithdrawal, storePending, normalizeKenyanPhone } from '@/lib/payhero';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Body {
  amount: number;
  currency?: string;
  method: 'mpesa' | 'bank' | 'paypal' | 'crypto';
  destination?: string;
}

function generateRef(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
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
  if (body.method === 'mpesa' && !/^(\+?254|0)?[17]\d{8}$/.test((body.destination || '').replace(/\s/g, ''))) {
    return NextResponse.json({ success: false, error: 'Enter a valid M-Pesa phone (e.g. 0712345678).' }, { status: 400 });
  }

  // Debit wallet first — PayHero will refund via callback if the transfer fails
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

  // ── M-Pesa via PayHero ────────────────────────────────────────────────────
  if (body.method === 'mpesa' && isConfigured()) {
    const reference = generateRef('BETCHEZA-W');
    const phone = body.destination!;
    const payResult = await initiateWithdrawal(body.amount, phone, reference);

    if (!payResult.ok) {
      // PayHero call failed — refund the user's wallet immediately
      console.error('[wallet/withdraw] PayHero withdrawal failed:', payResult.error);
      credit(user.userId, body.amount, {
        type: 'refund',
        currency: body.currency || 'KES',
        method: 'mpesa',
        reference,
        description: `M-Pesa withdrawal failed — refunded · ${phone}`,
        status: 'completed',
      });
      return NextResponse.json(
        { success: false, error: payResult.error || 'M-Pesa transfer failed. Your balance has been restored.' },
        { status: 502 },
      );
    }

    storePending(reference, {
      userId: user.userId,
      amount: body.amount,
      currency: body.currency || 'KES',
      phone: normalizeKenyanPhone(phone),
      type: 'withdraw',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      transaction: result.txn,
      newBalance: result.newBalance,
      pending: true,
      reference,
      message: `KES ${body.amount.toLocaleString()} is being sent to ${phone} via M-Pesa.`,
    });
  }

  // ── Other methods ─────────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    transaction: result.txn,
    newBalance: result.newBalance,
  });
}
