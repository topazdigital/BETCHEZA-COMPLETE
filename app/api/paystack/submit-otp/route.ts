/**
 * POST /api/paystack/submit-otp
 *
 * Submits the OTP for a pending Paystack card charge.
 * On success → performs the deferred action (strategy access / wallet credit / competition entry).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { submitOtp } from '@/lib/paystack';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { PendingCardPayment, performAction } from '@/app/api/paystack/charge/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  let body: { otp?: string; reference?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.otp?.trim()) {
    return NextResponse.json({ error: 'Enter the OTP code.' }, { status: 400 });
  }
  if (!body.reference) {
    return NextResponse.json({ error: 'Payment reference missing.' }, { status: 400 });
  }

  // Find the pending card payment
  const pending = fileStoreGet<PendingCardPayment[]>('card-pending', []);
  const payment = pending.find(
    p => p.reference === body.reference && p.userId === user.userId,
  );

  if (!payment) {
    return NextResponse.json(
      { error: 'Payment session not found or expired. Please start over.' },
      { status: 404 },
    );
  }

  const result = await submitOtp(body.otp.trim(), body.reference);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || 'OTP verification failed. Please try again.' },
      { status: 402 },
    );
  }

  // OTP accepted — remove from pending and complete the action
  fileStoreSet(
    'card-pending',
    pending.filter(p => p.reference !== body.reference),
  );

  return performAction({
    userId: user.userId,
    purpose: payment.purpose,
    amount: payment.amount,
    reference: result.result?.reference || body.reference,
    email: payment.email,
    meta: payment.meta,
  });
}
