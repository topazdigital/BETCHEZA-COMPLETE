import { NextRequest, NextResponse } from 'next/server';
import { getPending, updatePendingStatus, deletePending } from '@/lib/payhero';
import { credit, debit } from '@/lib/wallet-store';
import { onReferralDeposit } from '@/lib/referral-store';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { grantStrategyAccess, type PendingPayment as StrategyPendingPayment } from '@/app/api/strategy/access/route';

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

  // ── Strategy access payments (references starting with STRAT-) ──────────
  if (reference.startsWith('STRAT-')) {
    const strategyPending = fileStoreGet<StrategyPendingPayment[]>('strategy-pending', []);
    const stratPending = strategyPending.find(p => p.reference === reference);

    if (stratPending) {
      if (status === 'SUCCESS') {
        console.log(`[payhero/callback] granting strategy access for user ${stratPending.userId} ref=${reference}`);
        grantStrategyAccess(stratPending.userId, stratPending.phone, reference);
      } else {
        // Failed/cancelled — refund any wallet contribution
        console.log(`[payhero/callback] strategy payment failed for user ${stratPending.userId} ref=${reference}`);
        if (stratPending.walletContribution && stratPending.walletContribution > 0) {
          credit(stratPending.userId, stratPending.walletContribution, {
            type: 'refund',
            currency: 'KES',
            description: 'Refund — M-Pesa payment failed for 3 Daily Odds Strategy',
          });
        }
        fileStoreSet('strategy-pending', strategyPending.filter(p => p.reference !== reference));
      }
      return NextResponse.json({ ok: true });
    }

    // Strategy reference not in pending list (may have already been granted)
    console.log(`[payhero/callback] strategy ref ${reference} not in pending list — may already be granted`);
    return NextResponse.json({ ok: true });
  }

  // ── Wallet deposit / withdrawal payments ─────────────────────────────────
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
