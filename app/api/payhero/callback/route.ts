import { NextRequest, NextResponse } from 'next/server';
import { getPending, updatePendingStatus, deletePending } from '@/lib/payhero';
import { credit, debit } from '@/lib/wallet-store';
import { onReferralDeposit } from '@/lib/referral-store';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { grantStrategyAccess, type PendingPayment as StrategyPendingPayment } from '@/app/api/strategy/access/route';
import { grantJackpotAccess, type JackpotPendingPayment } from '@/app/api/jackpot/access/route';

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

  // PayHero currently wraps Daraja's callback in `response`:
  // { status: true, response: { ExternalReference, Status, ResultCode, Amount } }.
  // Older integrations sent these fields at the top level, so support both.
  const response = body.response && typeof body.response === 'object'
    ? body.response as Record<string, unknown>
    : {};
  const reference = String(
    body.external_reference ||
    body.ExternalReference ||
    response.external_reference ||
    response.ExternalReference ||
    '',
  );
  const status = String(
    body.status_text ||
    body.payment_status ||
    body.status ||
    body.Status ||
    response.status ||
    response.Status ||
    '',
  ).toUpperCase();
  const resultCode =
    response.ResultCode ??
    response.result_code ??
    body.ResultCode ??
    body.result_code;
  const amount = Number(response.Amount ?? body.amount ?? body.Amount) || 0;
  const succeeded = resultCode === 0 || resultCode === '0' || status === 'SUCCESS' || status === 'COMPLETED';

  console.log(`[payhero/callback] ref=${reference} status=${status} resultCode=${String(resultCode ?? '')} amount=${amount}`);

  if (!reference) {
    return NextResponse.json({ ok: false, error: 'Missing reference' }, { status: 400 });
  }

  // ── Strategy access payments (references starting with STRAT-) ──────────
  if (reference.startsWith('STRAT-')) {
    const strategyPending = fileStoreGet<StrategyPendingPayment[]>('strategy-pending', []);
    const stratPending = strategyPending.find(p => p.reference === reference);

    if (stratPending) {
      if (succeeded) {
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

  // Jackpot picks unlock payments
  if (reference.startsWith('JPT-')) {
    const pending = fileStoreGet<JackpotPendingPayment[]>('jackpot-pending', []);
    const item = pending.find(p => p.reference === reference);
    if (item && succeeded) grantJackpotAccess(item.userId, item.phone, reference);
    if (item && !succeeded) fileStoreSet('jackpot-pending', pending.filter(p => p.reference !== reference));
    return NextResponse.json({ ok: true });
  }

  // ── Wallet deposit / withdrawal payments ─────────────────────────────────
  const pending = getPending(reference);
  if (!pending) {
    // Already handled or unknown reference — respond 200 so PayHero doesn't retry
    console.warn(`[payhero/callback] Unknown reference: ${reference}`);
    return NextResponse.json({ ok: true, message: 'Unknown reference, ignoring' });
  }

  if (succeeded) {
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
      try {
        const { logAdminEvent } = await import('@/lib/admin-events-store');
        logAdminEvent('payment_received', `Payment: KES ${depositAmount}`, `User ${pending.userId} deposited via M-Pesa · ${pending.phone}`, { userId: pending.userId, amount: depositAmount, ref: reference });
      } catch { /* non-critical */ }
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
