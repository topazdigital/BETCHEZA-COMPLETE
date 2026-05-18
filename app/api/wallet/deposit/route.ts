import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { credit } from '@/lib/wallet-store';
import { recordDeposit } from '@/lib/affiliate-clicks-store';
import { isConfigured, initiateStkPush, storePending } from '@/lib/payhero';

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
    return NextResponse.json({ success: false, error: 'Pick a payment method.' }, { status: 400 });
  }
  if (body.method === 'mpesa' && !/^(\+?254|0)?[17]\d{8}$/.test((body.phone || '').replace(/\s/g, ''))) {
    return NextResponse.json({ success: false, error: 'Enter a valid M-Pesa phone (e.g. 0712345678).' }, { status: 400 });
  }

  // ── M-Pesa via PayHero STK push ──────────────────────────────────────────
  if (body.method === 'mpesa' && isConfigured()) {
    const reference = generateRef('BETCHEZA-D');
    const result = await initiateStkPush(body.amount, body.phone!, reference);

    if (!result.ok) {
      console.error('[wallet/deposit] PayHero STK push failed:', result.error);
      return NextResponse.json({ success: false, error: result.error || 'M-Pesa prompt failed. Try again.' }, { status: 502 });
    }

    storePending(reference, {
      userId: user.userId,
      amount: body.amount,
      currency: body.currency || 'KES',
      phone: body.phone!,
      type: 'deposit',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      pending: true,
      reference,
      checkoutRequestId: result.checkoutRequestId,
      message: 'M-Pesa prompt sent. Enter your PIN on your phone to complete.',
    });
  }

  // ── M-Pesa without PayHero configured — block rather than fake-credit ──
  if (body.method === 'mpesa') {
    return NextResponse.json(
      { success: false, error: 'M-Pesa payments are temporarily unavailable. Please try again later or use another payment method.' },
      { status: 503 },
    );
  }

  // ── Other methods (card, bank, crypto) ──
  const txn = credit(user.userId, body.amount, {
    type: 'deposit',
    currency: body.currency || 'KES',
    method: body.method,
    reference: body.reference,
    description:
      body.method === 'card'
        ? `Deposit via Card · ****${body.cardLast4 || ''}`
        : body.method === 'bank'
          ? 'Deposit via Bank Transfer'
          : 'Deposit via Crypto',
  });

  try {
    recordDeposit({
      userId: user.userId,
      amount: body.amount,
      currency: body.currency || 'KES',
    });
  } catch (e) {
    console.error('[wallet/deposit] affiliate attribution failed — referral credit may be lost for user', user.userId, ':', e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ success: true, transaction: txn });
}
