/**
 * Poll endpoint for M-Pesa subscription payment status.
 * The frontend polls this after an STK push until payment is confirmed or failed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getPending, updatePendingStatus } from '@/lib/payhero';
import { checkTransactionStatus } from '@/lib/payhero';
import { createSubscription } from '@/lib/subscription-store';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: 'error', error: 'Unauthorized' }, { status: 401 });

  const ref = req.nextUrl.searchParams.get('ref');
  if (!ref) return NextResponse.json({ status: 'error', error: 'Missing ref' }, { status: 400 });

  const tipsterId = Number(id);
  const pending = getPending(ref);
  if (!pending) return NextResponse.json({ status: 'unknown' });

  if (pending.status === 'completed') {
    return NextResponse.json({ status: 'completed' });
  }
  if (pending.status === 'failed') {
    return NextResponse.json({ status: 'failed' });
  }

  // Check PayHero for status
  const txStatus = await checkTransactionStatus(ref);

  if (txStatus === 'completed') {
    updatePendingStatus(ref, 'completed');

    // Look up tipster info
    let tipsterDisplayName = `Tipster #${tipsterId}`;
    let tipsterUsername = String(tipsterId);
    try {
      const r = await query<{ username: string; display_name: string | null }>(
        `SELECT u.username, COALESCE(up.display_name, u.username) AS display_name
         FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id WHERE u.id = ? LIMIT 1`,
        [tipsterId]
      );
      if (r.rows[0]) {
        tipsterUsername = r.rows[0].username;
        tipsterDisplayName = r.rows[0].display_name ?? tipsterUsername;
      }
    } catch { /* ignore */ }

    // Complete the subscription
    await createSubscription({
      userId: user.userId, tipsterId,
      tipsterUsername, tipsterDisplayName,
      price: pending.amount, currency: pending.currency,
      paymentMethod: 'mpesa', paymentRef: ref,
    });

    return NextResponse.json({ status: 'completed', message: 'Payment confirmed! You are now subscribed.' });
  }

  if (txStatus === 'failed') {
    updatePendingStatus(ref, 'failed');
    // Revert the pending DB subscription
    await query(
      `UPDATE tipster_subscriptions SET status='cancelled' WHERE payment_ref=? AND status='pending'`,
      [ref]
    ).catch(() => {});
    return NextResponse.json({ status: 'failed', message: 'Payment was cancelled or failed. Please try again.' });
  }

  return NextResponse.json({ status: 'pending', message: 'Waiting for M-Pesa confirmation...' });
}
