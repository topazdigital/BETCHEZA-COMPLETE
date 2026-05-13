import { NextRequest, NextResponse } from 'next/server';
import { getPending, updatePendingStatus, deletePending } from '@/lib/payhero';
import { credit, debit } from '@/lib/wallet-store';
import { onReferralDeposit } from '@/lib/referral-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PayHero posts to this endpoint when a payment is confirmed or fails.
// Payload shape (STK push & withdrawal):
// {
//   "status": "SUCCESS" | "FAILED" | "CANCELLED",
//   "external_reference": "BETCHEZA-...",
//   "amount": 100,
//   "phone_number": "254712345678",
//   "transaction_reference": "MXN...",
//   "provider": "m-pesa"
// }
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const reference = (body.external_reference as string) || '';
  const status = ((body.status as string) || '').toUpperCase();
  const amount = Number(body.amount) || 0;

  console.log(`[payhero/callback] ref=${reference} status=${status} amount=${amount}`);

  if (!reference) {
    return NextResponse.json({ ok: false, error: 'Missing reference' }, { status: 400 });
  }

  const pending = getPending(reference);
  if (!pending) {
    // Already handled or unknown reference — respond 200 so PayHero doesn't retry
    console.warn(`[payhero/callback] Unknown reference: ${reference}`);
    return NextResponse.json({ ok: true, message: 'Unknown reference, ignoring' });
  }

  if (status === 'SUCCESS') {
    if (pending.type === 'deposit') {
      const depositAmount = amount || pending.amount;
      credit(pending.userId, depositAmount, {
        type: 'deposit',
        currency: pending.currency,
        method: 'mpesa',
        reference,
        description: `M-Pesa deposit · ${pending.phone}`,
        status: 'completed',
      });
      // Trigger referral deposit check (friend's KES 50 + referrer unlock progress)
      onReferralDeposit(pending.userId, depositAmount).catch(() => {});
      console.log(`[payhero/callback] Credited KES ${depositAmount} to user ${pending.userId}`);
    } else {
      // Withdrawal was already debited from wallet; just mark complete
      console.log(`[payhero/callback] Withdrawal confirmed for user ${pending.userId}`);
    }
    updatePendingStatus(reference, 'completed');
    deletePending(reference);
  } else {
    // FAILED or CANCELLED
    if (pending.type === 'withdraw') {
      // Refund the wallet since we debited it when initiating
      credit(pending.userId, pending.amount, {
        type: 'refund',
        currency: pending.currency,
        method: 'mpesa',
        reference,
        description: `M-Pesa withdrawal failed — refunded · ${pending.phone}`,
        status: 'completed',
      });
      console.log(`[payhero/callback] Refunded KES ${pending.amount} to user ${pending.userId} (withdrawal failed)`);
    }
    updatePendingStatus(reference, 'failed');
    deletePending(reference);
  }

  return NextResponse.json({ ok: true });
}
