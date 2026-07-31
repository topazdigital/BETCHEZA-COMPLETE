import { NextRequest, NextResponse } from 'next/server';
import { getPending, updatePendingStatus, deletePending, checkTransactionStatus } from '@/lib/payhero';
import { credit } from '@/lib/wallet-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Polling endpoint — frontend calls this every few seconds after initiating
 * an STK push. We first check the local pending store (updated by the webhook),
 * and if still pending we directly query the PayHero API as a backup mechanism
 * so payments are always detected even when the webhook callback fails.
 */
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference') || '';
  if (!reference) {
    return NextResponse.json({ error: 'reference required' }, { status: 400 });
  }

  const pending = getPending(reference);

  // Already completed/failed in local store — return immediately
  if (pending?.status === 'completed') {
    deletePending(reference);
    return NextResponse.json({ status: 'completed', reference });
  }
  if (pending?.status === 'failed') {
    deletePending(reference);
    return NextResponse.json({ status: 'failed', reference });
  }

  // If not found in local store at all — the webhook already processed it
  if (!pending) {
    return NextResponse.json({ status: 'completed', reference });
  }

  // Still pending in local store — query PayHero API directly as backup
  // (catches cases where our callback URL is unreachable or webhook was missed)
  try {
    const apiStatus = await checkTransactionStatus(reference);
    if (apiStatus === 'completed') {
      // Credit the wallet and clean up
      if (pending.type === 'deposit') {
        credit(pending.userId, pending.amount, {
          type: 'deposit',
          currency: pending.currency,
          method: 'mpesa',
          reference,
          description: `M-Pesa deposit · ${pending.phone}`,
          status: 'completed',
        });
        console.log(`[payhero/status] Credited KES ${pending.amount} to user ${pending.userId} (API poll)`);
      }
      updatePendingStatus(reference, 'completed');
      deletePending(reference);
      return NextResponse.json({ status: 'completed', reference });
    }
    if (apiStatus === 'failed') {
      if (pending.type === 'withdraw') {
        credit(pending.userId, pending.amount, {
          type: 'refund',
          currency: pending.currency,
          method: 'mpesa',
          reference,
          description: `M-Pesa withdrawal failed — refunded · ${pending.phone}`,
          status: 'completed',
        });
      }
      updatePendingStatus(reference, 'failed');
      deletePending(reference);
      return NextResponse.json({ status: 'failed', reference });
    }
  } catch (e) {
    console.warn('[payhero/status] API poll failed, falling back to local store:', e);
  }

  return NextResponse.json({ status: 'pending', reference });
}
