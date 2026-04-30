import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { credit } from '@/lib/wallet-store';
import { recordDeposit } from '@/lib/affiliate-clicks-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Body {
  amount: number;
  currency?: string;
  method: 'mpesa' | 'card' | 'bank' | 'crypto';
  phone?: string;
  cardLast4?: string;
  reference?: string;
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
    return NextResponse.json({ success: false, error: 'Pick a payment method.' }, { status: 400 });
  }
  if (body.method === 'mpesa' && !/^(\+?254|0)?7\d{8}$/.test((body.phone || '').replace(/\s/g, ''))) {
    return NextResponse.json({ success: false, error: 'Enter a valid M-Pesa phone (e.g. 0712345678).' }, { status: 400 });
  }

  // In production, this is where we'd call:
  //   - Daraja STK push for M-Pesa
  //   - Stripe PaymentIntent / Flutterwave / Paystack for card
  //   - bank transfer / crypto webhook
  // For now we credit the wallet immediately so the rest of the app
  // (competition entry, ledger UI) can be exercised end-to-end.
  const txn = credit(user.userId, body.amount, {
    type: 'deposit',
    currency: body.currency || 'KES',
    method: body.method,
    reference: body.reference,
    description:
      body.method === 'mpesa'
        ? `Deposit via M-Pesa · ${body.phone}`
        : body.method === 'card'
          ? `Deposit via Card · ****${body.cardLast4 || ''}`
          : body.method === 'bank'
            ? 'Deposit via Bank Transfer'
            : 'Deposit via Crypto',
  });

  // Roll the deposit into the bookmaker funnel if this user is
  // attributed to one (i.e. they signed up via an affiliate click).
  // Silently no-ops when no attribution exists.
  try {
    recordDeposit({
      userId: user.userId,
      amount: body.amount,
      currency: body.currency || 'KES',
    });
  } catch (e) {
    console.warn('[wallet/deposit] affiliate attribution failed:', e);
  }

  return NextResponse.json({
    success: true,
    transaction: txn,
  });
}
