/**
 * POST /api/paystack/charge
 *
 * Charges a card via Paystack Direct Charge API.
 * On success   → performs the action (grant strategy / credit wallet / record competition entry).
 * On send_otp  → stores pending and returns { needsOtp: true, reference }.
 * On pending   → polls verifyTransaction up to 3×(2 s); if still pending returns { needsPoll: true, reference }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { chargeCard, isConfiguredAsync, verifyTransaction, PaystackCard } from '@/lib/paystack';
import { credit } from '@/lib/wallet-store';
import { grantStrategyAccess } from '@/app/api/strategy/access/route';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { queryOne } from '@/lib/db';
import { recordDeposit } from '@/lib/affiliate-clicks-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface PendingCardPayment {
  userId: number;
  email: string;
  reference: string;
  purpose: 'strategy' | 'wallet' | 'competition';
  amount: number;
  meta: {
    competitionName?: string;
    competitionSlug?: string;
    currency?: string;
  };
  initiatedAt: string;
}

interface RequestBody {
  card?: {
    number?: string;
    cvv?: string;
    expiry_month?: string;
    expiry_year?: string;
  };
  amount?: number;
  purpose?: 'strategy' | 'wallet' | 'competition';
  currency?: string;
  competitionName?: string;
  competitionSlug?: string;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  if (!await isConfiguredAsync()) {
    return NextResponse.json(
      { error: 'Card payments are not available right now. Please add your Paystack secret key in Admin → Payment Gateways.' },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // Validate card fields
  const { card } = body;
  if (!card?.number || !card?.cvv || !card?.expiry_month || !card?.expiry_year) {
    return NextResponse.json({ error: 'Please fill in all card details.' }, { status: 400 });
  }
  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ error: 'Invalid payment amount.' }, { status: 400 });
  }
  if (!body.purpose) {
    return NextResponse.json({ error: 'Payment purpose is required.' }, { status: 400 });
  }

  const paystackCard: PaystackCard = {
    number: card.number.replace(/\s/g, ''),
    cvv: card.cvv,
    expiry_month: card.expiry_month,
    expiry_year: card.expiry_year,
  };

  // Get user email for Paystack
  let email = `user${user.userId}@betcheza.co.ke`;
  try {
    const row = await queryOne<{ email: string }>(
      'SELECT email FROM users WHERE id = ? LIMIT 1',
      [user.userId],
    );
    if (row?.email) email = row.email;
  } catch { /* fall through */ }

  const result = await chargeCard(email, body.amount, paystackCard, {
    userId: user.userId,
    purpose: body.purpose,
    competitionSlug: body.competitionSlug,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || 'Card charge failed. Please check your card details and try again.' },
      { status: 402 },
    );
  }

  const chargeResult = result.result!;

  const actionParams = {
    userId: user.userId,
    purpose: body.purpose!,
    amount: body.amount!,
    reference: chargeResult.reference,
    email,
    meta: {
      competitionName: body.competitionName,
      competitionSlug: body.competitionSlug,
      currency: body.currency || 'KES',
    },
  };

  // OTP required — store pending so submit-otp route can complete it
  if (chargeResult.status === 'send_otp') {
    storePending(user.userId, email, chargeResult.reference, body);
    return NextResponse.json({
      needsOtp: true,
      reference: chargeResult.reference,
      displayText: chargeResult.displayText || 'Enter the OTP sent to your phone/email.',
    });
  }

  // Pending = bank doing async 3DS authorisation. Poll up to 3×2s then hand off to client.
  if (chargeResult.status === 'pending') {
    for (let i = 0; i < 3; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const v = await verifyTransaction(chargeResult.reference);
      if (v.ok && v.status === 'success') return performAction(actionParams);
      if (v.status === 'failed') {
        return NextResponse.json({ error: 'Your card was declined by the bank.' }, { status: 402 });
      }
    }
    // Still pending after 6 s — store it so the verify endpoint can complete it later
    storePending(user.userId, email, chargeResult.reference, body);
    return NextResponse.json({
      needsPoll: true,
      reference: chargeResult.reference,
      displayText: 'Your bank is processing the payment. Please wait — this usually takes under 30 seconds.',
    });
  }

  // Success — perform the action
  return performAction(actionParams);
}

function storePending(
  userId: number,
  email: string,
  reference: string,
  body: RequestBody,
): void {
  const pending = fileStoreGet<PendingCardPayment[]>('card-pending', []);
  const filtered = pending.filter(
    p => !(p.userId === userId && p.purpose === body.purpose),
  );
  filtered.push({
    userId,
    email,
    reference,
    purpose: body.purpose!,
    amount: body.amount!,
    meta: {
      competitionName: body.competitionName,
      competitionSlug: body.competitionSlug,
      currency: body.currency,
    },
    initiatedAt: new Date().toISOString(),
  });
  fileStoreSet('card-pending', filtered);
}

export async function performAction(params: {
  userId: number;
  purpose: 'strategy' | 'wallet' | 'competition';
  amount: number;
  reference: string;
  email: string;
  meta: { competitionName?: string; competitionSlug?: string; currency?: string };
}): Promise<NextResponse> {
  const { userId, purpose, amount, reference, email, meta } = params;

  if (purpose === 'strategy') {
    grantStrategyAccess(userId, email, reference);
    return NextResponse.json({ success: true, purpose: 'strategy', reference });
  }

  if (purpose === 'wallet') {
    credit(userId, amount, {
      type: 'deposit',
      currency: meta.currency || 'KES',
      method: 'card',
      reference,
      description: 'Card deposit',
    });
    try {
      recordDeposit({ userId, amount, currency: meta.currency || 'KES' });
    } catch { /* non-blocking */ }
    return NextResponse.json({ success: true, purpose: 'wallet', reference });
  }

  if (purpose === 'competition') {
    // Record this as a paid competition entry via card
    const entries = fileStoreGet<{
      userId: number;
      reference: string;
      competitionSlug?: string;
      amount: number;
      currency: string;
      paidAt: string;
    }[]>('competition-card-entries', []);
    entries.push({
      userId,
      reference,
      competitionSlug: meta.competitionSlug,
      amount,
      currency: meta.currency || 'KES',
      paidAt: new Date().toISOString(),
    });
    fileStoreSet('competition-card-entries', entries);
    return NextResponse.json({ success: true, purpose: 'competition', reference });
  }

  return NextResponse.json({ error: 'Unknown payment purpose.' }, { status: 400 });
}
